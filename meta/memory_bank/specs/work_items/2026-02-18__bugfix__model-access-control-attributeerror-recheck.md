# Recheck and Regression Fix for model.access_control AttributeError

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): meta/sdd/specs/completed/model-access-control-2026-02-18-001.json
- Created: 2026-02-18
- Updated: 2026-02-18

## Context

User reported that free model requests fail with `"ModelModel" object has no attribute "access_control"` for one account, while admin account worked.

## Goal / Acceptance Criteria

- [x] Reproduce the failing access-check path.
- [x] Verify whether recreating the user fixes root cause.
- [x] Confirm access-check fix works for user paths without breaking billing/public pricing behavior.
- [x] Run targeted regression tests for touched routers.

## Non-goals

- Full backend test suite execution.
- Refactoring access-control subsystem architecture.

## Scope (what changes)

- Backend:
  - Guard access checks in `openai`, `ollama`, and `models` routers to fallback to `access_grants` only when `access_control` attribute is absent.
  - Keep legacy/public semantics when `access_control` exists and is `None`.
  - Fix public pricing filter fallback behavior in billing router.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/openai.py`
  - `backend/open_webui/routers/ollama.py`
  - `backend/open_webui/routers/models.py`
  - `backend/open_webui/routers/billing.py`
- API changes:
  - None.
- Edge cases:
  - Object missing `access_control` attribute.
  - Public model path with `access_control=None` and empty grants should remain accessible for read.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/openai.py`
  - `backend/open_webui/routers/ollama.py`
  - `backend/open_webui/routers/models.py`
  - `backend/open_webui/routers/billing.py`
- Why unavoidable:
  - Crash and access checks occur in these upstream router paths.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal guarded changes only in access-check call sites.
  - No contract changes and no broad refactor.

## Verification

- `python -m py_compile backend/open_webui/routers/openai.py backend/open_webui/routers/ollama.py backend/open_webui/routers/models.py backend/open_webui/routers/billing.py`
- `DATABASE_URL=sqlite:////tmp/openwebui_test_recheck.db .venv/bin/python -m pytest backend/open_webui/test/apps/webui/routers/test_models.py backend/open_webui/test/apps/webui/routers/test_billing_public_pricing.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][ACCESS]** Recheck and fix model access AttributeError on free model path
  - Spec: `meta/memory_bank/specs/work_items/2026-02-18__bugfix__model-access-control-attributeerror-recheck.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-02-18
  - Summary: Reproduced `access_control` AttributeError on user path, confirmed recreating user does not fix root cause, and applied guarded fallback fix with regression validation.
  - Tests: `py_compile` (routers), targeted `pytest` (14 passed)
  - Risks: Low-Medium (shared access checks in critical request paths).

## Risks / Rollback

- Risks:
  - Shared access-check behavior can affect model visibility/authorization edges.
- Rollback plan:
  - Revert the four router file changes and re-run the same targeted regression suite.
