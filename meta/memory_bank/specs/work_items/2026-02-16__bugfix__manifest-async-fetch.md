# Make external manifest fetch async-safe and fault-tolerant

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/manifest-async-fetch
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

`/manifest.json` is an async route but currently fetches external manifest via synchronous
`requests.get(...)`. This can block the event loop under provider latency and degrade unrelated
API responsiveness.

## Goal / Acceptance Criteria

- [x] Replace sync HTTP call with async fetch in manifest path.
- [x] Add explicit timeout + user-safe error contract for external failures.
- [x] Add regression tests for success and failure paths.

## Non-goals

- No changes to default local manifest payload.
- No broad refactor of other async routes in this PR.

## Scope (what changes)

- Backend:
  - Add fork-owned async helper for external manifest retrieval.
  - Update `/manifest.json` route to use helper.
  - Add focused unit tests for helper behavior.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/airis/manifest.py` (new)
  - `backend/open_webui/main.py`
  - `backend/open_webui/test/util/test_manifest_fetch.py` (new)
- API changes:
  - `/manifest.json` now returns `502` on external manifest fetch/validation errors instead of
    bubbling raw exceptions.
- Edge cases:
  - External non-2xx response.
  - Network/request exceptions.
  - Non-object JSON payload from external source.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/main.py`
- Why unavoidable:
  - Route entrypoint lives in `main.py`.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep route diff minimal by delegating behavior to new Airis helper module.

## Verification

Docker Compose-first commands (adjust if needed):

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_manifest_fetch.py"` ✅
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/utils/airis/manifest.py backend/open_webui/test/util/test_manifest_fetch.py"` ✅

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][ASYNC][MANIFEST]** Replace sync manifest fetch with async helper
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__manifest-async-fetch.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/manifest-async-fetch`
  - Started: 2026-02-16
  - Summary: Prevent event-loop blocking in `/manifest.json` when external manifest URL is used.
  - Tests: pending
  - Risks: Low (localized route helper integration).

## Risks / Rollback

- Risks:
  - Low; only external manifest path is affected.
- Rollback plan:
  - Revert helper integration in `main.py` and remove helper/tests.
