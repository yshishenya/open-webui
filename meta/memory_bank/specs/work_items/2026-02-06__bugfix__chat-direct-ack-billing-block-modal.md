# Work Item: Chat direct-ack crash + billing blocked modal for websocket/task errors

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/chat-direct-ack-billing-block
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/chat-billing-direct-guards-2026-02-06-001.json`
- Created: 2026-02-06
- Updated: 2026-02-06

## Summary

Two user-visible issues:

1. Chat sometimes fails with a raw error: `'NoneType' object has no attribute 'get'`.
2. When wallet billing blocks a request (e.g. 402 `insufficient_funds`) in async task/websocket mode, UI shows raw `402: {...}` instead of prompting top-up.

## Goals / Acceptance Criteria

- [x] Direct connections path must never crash due to ack payload being `None` or non-dict.
- [x] For billing blocks (`insufficient_funds`, `daily_cap_exceeded`, `max_reply_cost_exceeded`) in task/websocket mode, chat opens BillingBlockedModal and shows a user-friendly inline error.
- [x] No secrets are logged or sent in error payloads.

## Non-Goals

- Redesign billing, pricing, or wallet flows.
- Add new dependencies.

## Root Cause (Repo-Grounded)

- Backend `generate_direct_chat_completion()` in `backend/open_webui/utils/chat.py` called `res.get(...)` without validating that Socket.IO ack returned a dict.
  - Depending on provider / client handler behavior, the ack can be `null`/`None` (valid JSON), or a non-dict payload, leading to `NoneType.get` crash.
- Billing blocks were raised as `HTTPException(status_code=402, detail=dict)` by wallet preflight.
  - In async task mode, exceptions were stringified (`str(e)`) and delivered to the UI via websocket `chat:message:error`.
  - The chat websocket handler treated these as generic errors and did not map billing-block details to the recovery UX (BillingBlockedModal).

## Approach

- Prefer additive Airis helpers and thin hooks to minimize upstream sync conflicts.
- Backend:
  - Normalize/validate direct Socket.IO ack payload before calling `.get(...)`.
  - For task/websocket errors, include structured fields (status + detail) where possible to avoid brittle string parsing.
- Frontend:
  - Detect billing-block errors in websocket `chat:message:error` and open BillingBlockedModal (parity with sync HTTP path).

## Upstream Impact

We kept upstream diffs minimal and additive wherever possible.

- Upstream-owned touched (thin hooks):
  - `backend/open_webui/utils/chat.py`
  - `backend/open_webui/main.py`
  - `src/lib/components/chat/Chat.svelte`
- Fork-owned added (Airis helpers):
  - `backend/open_webui/utils/airis/direct_ack.py`
  - `backend/open_webui/utils/airis/task_error_payload.py`
  - `src/lib/utils/airis/ws_billing_block.ts`

## Verification

Docker Compose-first (targeted):

- Backend: `pytest` (targeted) for chat direct-ack + billing router coverage.
- Frontend: `vitest` (targeted) for websocket billing-block parsing helper.

Manual:

- Trigger insufficient funds in task/websocket mode and confirm modal + CTA appears (no raw `402: {...}` string in chat history).

## Task Entry (for current_tasks)

- [x] **[BUG]** Chat: direct ack crash + wallet billing blocked modal in task/websocket mode
  - Spec: `meta/memory_bank/specs/work_items/2026-02-06__bugfix__chat-direct-ack-billing-block-modal.md`
  - Owner: Codex
  - Branch: `bugfix/chat-direct-ack-billing-block`
  - Done: 2026-02-06
  - Summary: Harden direct Socket.IO ack contract to avoid `NoneType.get` crashes; show BillingBlockedModal for billing blocks delivered via websocket errors.
  - Tests: `pytest (targeted)` + `vitest (targeted)`
  - Risks: Medium (touches chat UX + error propagation); minimized via additive Airis helpers and thin hooks.
