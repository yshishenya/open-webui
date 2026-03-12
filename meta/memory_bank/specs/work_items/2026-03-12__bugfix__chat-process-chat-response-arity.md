# Fix chat `process_chat_response` arity mismatch

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

LLM chat requests fail at runtime with `process_chat_response() takes 2 positional arguments but 8 were given`
even when billing balance is available. The failure happens after request preprocessing, when
`backend/open_webui/main.py` still calls the pre-refactor `process_chat_response(...)` signature,
while `backend/open_webui/utils/middleware.py` now expects `(response, ctx)`.

## Goal / Acceptance Criteria

- [x] Non-streaming chat completion requests no longer fail because of the arity mismatch.
- [x] `main.py` uses the middleware-owned context builder/helper instead of duplicating context wiring.
- [x] Targeted verification covers the `/chat/completions` flow that reaches `process_chat_response`.

## Non-goals

- Reworking chat billing behavior
- Refactoring middleware response handlers beyond the compatibility fix
- Changing provider integrations

## Scope (what changes)

- Backend:
  - Restore the current `process_chat_response(response, ctx)` contract at the chat entrypoint.
  - Add/update targeted regression coverage for chat completion routing.
- Frontend:
  - No changes.
- Config/Env:
  - No changes.
- Data model / migrations:
  - No changes.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/main.py`
  - `backend/open_webui/utils/middleware.py`
  - `backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py`
- API changes:
  - None. Internal compatibility fix only.
- Edge cases:
  - Keep streaming and non-streaming chat paths using the same context contract.
  - Do not widen the diff in upstream-owned files beyond the minimum import/call fix.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/main.py`
  - `backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py`
- Why unavoidable:
  - The arity mismatch is at the upstream chat entrypoint; regression coverage belongs with the affected route tests.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Reuse existing `build_chat_response_context(...)` helper from middleware; change only the import and call site in `main.py`.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py -q -k test_payg_success_creates_hold_charge_usage_event"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/main.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py"`
- Frontend tests: N/A
- Frontend typecheck: N/A
- Frontend lint: N/A
- E2E (when relevant): N/A

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][CHAT][LLM]** Fix `process_chat_response` arity mismatch
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__chat-process-chat-response-arity.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Started: 2026-03-12
  - Summary: Restore the current `process_chat_response(response, ctx)` contract in the main chat entrypoint so LLM requests stop crashing after payload processing.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py -q -k test_payg_success_creates_hold_charge_usage_event"`
  - Risks: Low-Medium (touches core chat completion path; minimized to an import/call-site compatibility fix).

## Risks / Rollback

- Risks:
  - Core chat completion path regression if the context object is incomplete.
- Rollback plan:
  - Revert the `main.py` compatibility patch and restore the previous known-good main/middleware pair together.

## Completion Checklist

- [x] No SDD spec linked for this task (`N/A`)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
