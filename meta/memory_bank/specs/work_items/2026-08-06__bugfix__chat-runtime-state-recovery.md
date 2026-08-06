# Chat runtime state recovery

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/chat-runtime-state-recovery-2026-08-06-0730.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The previous loader recovery exposed the actual client-side failures. In an authenticated production browser, opening an existing chat redirects back to the home page and submitting a message stops before any API request. Browser console evidence identifies undeclared `messageQueue` and `pendingOAuthTools` references in `Chat.svelte`.

## Goal / Acceptance Criteria

- [ ] Existing chats open without a runtime `ReferenceError`.
- [ ] Message submission reaches the chat API instead of stopping in the client.
- [ ] OAuth tool state and message queues use the current upstream state model.
- [ ] Production deployment preserves PostgreSQL and persistent volumes.

## Non-goals

- No database schema changes.
- No provider or Ollama configuration changes.
- No broader chat component refactor.

## Scope

- Frontend: restore OAuth pending state and remove stale local queue references from `Chat.svelte`.
- Tests: focused static/regression checks plus frontend tests and authenticated browser verification.
- Deployment: local `linux/amd64` image build and guarded production rollout.

## Implementation Notes

- Reuse upstream's existing `pendingOAuthTools` state and `chatRequestQueues` store.
- Do not add a second queue implementation.
- Keep the diff limited to the broken state transitions.

## Upstream impact

- Upstream-owned file touched: `src/lib/components/chat/Chat.svelte`.
- Why unavoidable: the broken references are in the shared upstream chat component.
- Minimization strategy: restore the corresponding current upstream lines only.

## Verification

- Focused check rejecting undeclared chat runtime state.
- Frontend Vitest suite and production image build.
- Authenticated browser: open an existing chat and submit a controlled message.
- Guarded backup/migration/health deployment checks.

## Risks / Rollback

- Risk: shared chat navigation/submission state and production app recreation.
- Rollback: retain the current immutable image and verified database/data backup; never remove volumes.

## Completion Checklist

- [ ] `meta/tools/sdd check-complete chat-runtime-state-recovery-2026-08-06-0730 --json`
- [ ] `meta/tools/sdd complete-spec chat-runtime-state-recovery-2026-08-06-0730 --json`
- [ ] Move the current task entry to completed.
