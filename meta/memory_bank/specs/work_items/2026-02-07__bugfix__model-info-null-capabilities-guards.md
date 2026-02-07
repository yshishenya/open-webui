# [BUG] Guard Against null model.info/meta/capabilities In Chat Middleware

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: bugfix/chat-direct-ack-billing-block
- Created: 2026-02-07
- Updated: 2026-02-07

## Context

Production chat requests for some models (e.g. lead magnet / Gemini) fail in the
background task with:

`AttributeError: 'NoneType' object has no attribute 'get'`

Traceback points to `open_webui/utils/middleware.py` where we read nested model
capabilities via `.get(..., {})` chains. In production DB, some nested fields
are explicit JSON `null` (e.g. `model.info`, `model.info.meta`, or
`model.info.meta.capabilities`), so `.get()` is invoked on `None`.

Dev works because its DB data does not contain these `null` values.

## Goal / Acceptance Criteria

- [ ] Chat requests do not crash when `model.info` (or nested fields) is `null`.
- [ ] Lead magnet model requests complete without background task failure.
- [ ] No behavior change when these fields are proper dicts.

## Non-goals

- Changing model schema/migrations or backfilling production DB records.
- Altering lead magnet business rules or billing enforcement.

## Scope (what changes)

- Backend:
  - Add safe nested-get helpers to tolerate JSON `null` in model metadata.
  - Use helpers in the chat middleware when reading:
    - `model.info.meta.knowledge`
    - `model.info.meta.capabilities.builtin_tools`
    - `model.info.meta.capabilities.file_context`
    - MCP server connection `info.id`
- Frontend: N/A
- Config/Env: N/A
- Data model / migrations: N/A

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/middleware.py` (chat pipeline)
  - `backend/open_webui/utils/airis/safe_get.py` (Airis-owned helper)
- Edge cases:
  - Intermediate nodes are `null` (JSON) rather than absent.
  - Leaf values stored as strings/ints (defensive; default to prior behavior).

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/middleware.py`
- Why unavoidable:
  - The exception originates in upstream middleware code while reading model
    metadata. We need a small guard to tolerate production DB nulls.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep logic in additive Airis helper (`utils/airis/safe_get.py`) and call it
    from middleware at the few read sites only (no refactors / no reformatting).

## Verification

- Backend tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_safe_get.py"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Guard chat middleware against `null` model capabilities
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__bugfix__model-info-null-capabilities-guards.md`
  - Owner: Codex
  - Branch: `bugfix/chat-direct-ack-billing-block`
  - Started: 2026-02-07
  - Summary: Prevent `NoneType.get` in background chat task when model `info/meta/capabilities` contains JSON nulls in prod DB.
  - Tests: `pytest -q open_webui/test/util/test_safe_get.py (docker)`
  - Risks: Low (read-path only; defaults preserve existing behavior).

## Risks / Rollback

- Risks:
  - Low: slight behavior change only when fields are malformed (null/non-bool).
- Rollback plan:
  - Revert the middleware guard commits; production will return to previous crash behavior for affected DB records.
