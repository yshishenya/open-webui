# Optimize Docker Build Caching (Faster, Safer Iteration)

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/docker-build-cache
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-07
- Updated: 2026-02-07

## Context

Docker image builds are taking too long. The most likely causes are:

- Build cache invalidation (e.g., copying too much into build stages) causing dependency reinstall/download.
- Scripts that aggressively prune Docker images, which can destroy intermediate layers and reduce cache reuse.

We need a safe speed-up that preserves correctness and reproducibility (same inputs -> same deps), while minimizing upstream-fork diff.

## Goal / Acceptance Criteria

- [x] Rebuilding the image after backend-only changes should not trigger a frontend rebuild step.
- [x] Building via helper scripts should not destroy Docker build cache by default.
- [x] Docker build context should not include `.git` (reduces context size and prevents unnecessary cache busting).
- [x] Changing `BUILD_HASH` should not force re-installing frontend dependencies or re-downloading Pyodide packages (only the final Vite build should be invalidated).
- [x] No runtime behavior changes; changes are limited to build/infra ergonomics.

## Non-goals

- Changing application runtime logic.
- Changing dependency versions or adding new dependencies.
- Reworking CI; GitHub Actions already uses registry cache.

## Scope (what changes)

- Backend:
  - N/A (no application code changes).
- Frontend:
  - N/A (no application code changes).
- Config/Env:
  - Docker build context (`.dockerignore`) adjustments.
  - Docker build recipe (`Dockerfile`) cache-friendly COPY structure (frontend build stage).
  - Local run scripts: avoid cache-destructive pruning by default.
- Data model / migrations:
  - N/A

## Implementation Notes

- Key files/entrypoints:
  - `Dockerfile` (frontend build stage COPY granularity)
  - `.dockerignore` (exclude `.git`)
  - `package.json` (add a dedicated `build:vite` script so Dockerfile can run Vite build without re-running Pyodide fetch)
  - `run.sh` / `run-ollama-docker.sh` (remove or gate `docker image prune -f`)
- Edge cases:
  - `svelte.config.js` uses `git rev-parse HEAD`; when `.git` is excluded this should fall back to `package.json` version or timestamp.

## Upstream impact

- Upstream-owned files touched:
  - `Dockerfile`
  - `.dockerignore`
  - `package.json`
  - `svelte.config.js`
  - `run.sh`
  - `run-ollama-docker.sh`
- Why unavoidable:
  - Build caching and helper scripts live in these top-level upstream-managed files.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep diffs minimal and strictly build-related.
  - Prefer additive/gated behavior (e.g., pruning behind a flag) over changing defaults that might surprise users.

## Verification

- Build (local):
  - `docker build -t airis:cache-test --build-arg BUILD_HASH=cache-test .`
  - Repeat the same command after a backend-only edit and confirm frontend build stage is cached.

## Task Entry (for branch_updates/current_tasks)

- [x] **[DEV][DOCKER]** Speed up Docker builds by fixing cache busting + avoiding cache-destructive pruning
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__refactor__docker-build-cache-speed.md`
  - Owner: Codex
  - Branch: `codex/refactor/docker-build-cache`
  - Done: 2026-02-07
  - Summary: Reduce unnecessary rebuilds/downloads by narrowing frontend build COPY inputs, splitting Pyodide fetch, and preserving Docker caches in helper scripts.
  - Tests: `docker build --target build ...` (cache checks: repeat build is cached; changing `BUILD_HASH` keeps `npm ci` + `pyodide:fetch` cached)
  - Risks: Low (build-time only; no runtime logic changes)

## Risks / Rollback

- Risks:
  - Older Docker setups without caching expectations may observe different (faster) behavior; no functional change expected.
  - If any file required for frontend build is omitted from `COPY`, build could fail (covered by local build).
- Rollback plan:
  - Revert the affected build files (`Dockerfile`, `.dockerignore`, scripts) to previous versions.
