# Prevent Docker Dev/Test Runs From Mutating Git-Tracked Static

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/docker-static-dir-no-clobber
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

`docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run ... airis ...` mounts `./backend` into the container.
At import time, `backend/open_webui/config.py` wipes `STATIC_DIR` and copies files from `FRONTEND_BUILD_DIR/static` into it.
With default config (`STATIC_DIR` = `backend/open_webui/static`), this write-back mutates **git-tracked** files on the host during tests/startup.

This lowers confidence in tests (side effects in the repo), creates noisy diffs, and can break local/manual verification.

## Goal / Acceptance Criteria

- [ ] Running backend tests via Docker Compose does **not** modify any git-tracked files in `backend/open_webui/static/`.
- [ ] `STATIC_DIR` inside the dev/test container points to a **data volume path**, not the repository path.
- [ ] CI workflows that run backend tests via Docker Compose remain green.

## Non-goals

- Refactoring `backend/open_webui/config.py` static sync implementation (keep the diff minimal; configuration fix is sufficient).
- Changing production Docker behavior.

## Scope (what changes)

- Config/Env:
  - Set `STATIC_DIR=/app/backend/data/static` for the `airis` service in `docker-compose.dev.yaml` so dev/test runs write only to the data volume.
- Repo hygiene:
  - Ignore local `.gha-artifacts/` directory (downloaded GitHub Actions artifacts).
- Dev UX (optional but recommended):
  - Align `npm run docker:test:backend` with CI by installing the same test-only Python deps before running `pytest`.

## Implementation Notes

- Key files/entrypoints:
  - `docker-compose.dev.yaml` (dev overlay and also used by CI test runs)
  - `backend/open_webui/config.py` (static sync side effect; **not modified** in this work item)
  - `package.json` (docker test script)
  - `.gitignore`
- Manual verification:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -c 'import open_webui.config as c; print(c.STATIC_DIR)'"` prints `/app/backend/data/static`.
  - Running `npm run docker:test:backend` keeps `git status` clean.

## Upstream impact

- Upstream-owned files touched:
  - `docker-compose.dev.yaml`
  - `package.json`
  - `.gitignore`
- Why unavoidable:
  - CI/dev test harness uses the dev overlay compose file; static clobber happens due to env defaults + bind mount.
- Minimization strategy:
  - Config-only fix (env var in compose) to avoid rewriting upstream static sync logic.

## Verification

- Backend tests: `npm run docker:test:backend`
- Backend lint (ruff): `npm run docker:lint:backend`
- Billing confidence (quick): `npm run billing:confidence:pr-fast`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Prevent Docker dev/test from mutating git-tracked static
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__docker-dev-static-dir-no-clobber.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/docker-static-dir-no-clobber`
  - Started: 2026-02-15
  - Summary: Route static sync output to a data volume path to keep repo clean during docker test runs.
  - Tests: `npm run docker:test:backend` (+ CI)
  - Risks: Low; dev-only env var in compose overlay.

## Risks / Rollback

- Risks:
  - If some endpoints rely on files that only exist in `backend/open_webui/static`, they may not be present in the new `STATIC_DIR` in dev/test until sync runs.
- Rollback plan:
  - Revert the `STATIC_DIR` env var in `docker-compose.dev.yaml`.
