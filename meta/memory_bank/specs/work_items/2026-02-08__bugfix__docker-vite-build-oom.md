# Fix Docker Frontend Build OOM During Vite Build

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/docker-vite-build-oom
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-08
- Updated: 2026-02-08

## Context

Docker builds can fail during the frontend `vite build` step with:

- `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`

This blocks `docker compose up -d --build` and any image build that relies on the Dockerfile frontend stage.

The most likely trigger is memory-heavy sourcemap generation: `vite.config.ts` forces `build.sourcemap: true`,
which increases peak memory usage substantially during bundling/minification.

## Goal / Acceptance Criteria

- [x] Default Docker image build succeeds without Vite OOM on typical Docker Desktop memory budgets.
- [x] Sourcemap generation is configurable (so developers can opt back in when needed).
- [x] Keep changes minimal and confined to build tooling (no runtime logic changes).

## Non-goals

- Changing application runtime behavior.
- Fixing existing frontend lint/a11y warnings emitted during build.

## Scope (what changes)

- Frontend build tooling:
  - Make Vite sourcemaps configurable via `AIRIS_VITE_SOURCEMAP`.
- Docker build recipe:
  - Disable sourcemaps by default in Docker builds (overrideable via build-arg).

## Implementation Notes

- `vite.config.ts`:
  - `enableSourcemap` defaults to `true` unless `AIRIS_VITE_SOURCEMAP=false`.
- `Dockerfile`:
  - Adds `ARG AIRIS_VITE_SOURCEMAP=false` right before the Vite build step.
  - Runs `vite build` with `AIRIS_VITE_SOURCEMAP` set from the build-arg.
  - Override example:
    - `docker build --build-arg AIRIS_VITE_SOURCEMAP=true ...`

## Upstream impact

- Upstream-owned files touched:
  - `Dockerfile`
  - `vite.config.ts`
- Why unavoidable:
  - The issue is within the frontend build step and its configuration, which lives in these files.
- Minimization strategy:
  - Keep defaults backward-compatible outside Docker builds (sourcemaps remain enabled unless explicitly disabled).
  - Keep Docker default safe (sourcemaps disabled to avoid OOM).

## Verification

- `docker build --target build --build-arg BUILD_HASH=oom-fix-test .` (frontend build completes)
- Confirm BuildKit logs show `AIRIS_VITE_SOURCEMAP=false` for the Vite build step.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][DEV][DOCKER]** Fix frontend Vite build OOM in Docker builds
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__docker-vite-build-oom.md`
  - Owner: Codex
  - Branch: `codex/bugfix/docker-vite-build-oom`
  - Done: 2026-02-08
  - Summary: Disable Vite sourcemaps by default in Docker builds (overrideable) to reduce peak memory and avoid Node heap OOM.
  - Tests: `docker build --target build ...`
  - Risks: Low (build-time only; sourcemap output changes in Docker images).

## Risks / Rollback

- Risks:
  - Docker images will no longer include sourcemaps by default (reduced debugging visibility, but smaller output and less memory use).
  - Developers can opt back in via `--build-arg AIRIS_VITE_SOURCEMAP=true`.
- Rollback plan:
  - Revert `vite.config.ts` and the `AIRIS_VITE_SOURCEMAP` changes in `Dockerfile`.

