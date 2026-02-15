# Skip Frontend Static Sync When Target Is Git-Tracked Static (Source Checkout)

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/static-sync-skip-git-tracked
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

At import time, `backend/open_webui/config.py` wipes `STATIC_DIR` (unlinking files) and then copies
`FRONTEND_BUILD_DIR/static/**` into it.

In a **source checkout** (where `.git/` exists), the default `STATIC_DIR` points to
`backend/open_webui/static`, which is **git-tracked** in this repo. This creates two problems:

1. Running app startup/tests can mutate git-tracked files (noisy diffs, reduced confidence).
2. When `FRONTEND_BUILD_DIR/static` is missing, the wipe step can delete static assets and break dev runs.

We already route Docker dev/test to a data volume via `STATIC_DIR=/app/backend/data/static`, but local
source runs still have the foot-gun.

## Goal / Acceptance Criteria

- [ ] In a source checkout, frontend static sync does **not** wipe/copy into `backend/open_webui/static` by default.
- [ ] If `FRONTEND_BUILD_DIR/static` does not exist, we do **not** wipe `STATIC_DIR`.
- [ ] Docker dev/test behavior remains unchanged (still syncs into the configured data path).

## Non-goals

- Refactor the overall config import-time side effects (keep diff minimal).
- Change production docker behavior.

## Scope (what changes)

- Backend:
  - Add a small, testable guard helper in `backend/open_webui/utils/airis/` that decides whether to run
    the frontend static sync.
  - Use the guard in `backend/open_webui/config.py` to skip sync when the target directory is the
    git-tracked static dir in a source checkout, and to skip when build static is missing.
- Tests:
  - Add unit tests for the guard helper (no import-time config side effects).

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/config.py` (small guard)
- Fork-owned additions:
  - `backend/open_webui/utils/airis/static_sync.py`
  - `backend/open_webui/test/util/test_static_sync_guard.py`

## Verification

- Backend tests (targeted): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_static_sync_guard.py"`
- Full backend: `npm run docker:test:backend` (ensures no import errors/regressions)

## Risks / Rollback

- Risk:
  - Developers who relied on syncing build static into `backend/open_webui/static` in a git checkout
    will now need to set `STATIC_DIR` explicitly to a non-tracked directory (e.g. `backend/data/static`).
- Rollback:
  - Revert this work item commit(s).
