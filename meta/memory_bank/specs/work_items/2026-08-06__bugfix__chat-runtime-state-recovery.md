# Chat runtime state recovery

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/chat-runtime-state-recovery-2026-08-06-001.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The previous loader recovery exposed the actual client-side failures. In an authenticated production browser, opening an existing chat redirects back to the home page and submitting a message stops before any API request. Browser console evidence identifies undeclared `messageQueue` and `pendingOAuthTools` references in `Chat.svelte`.

## Goal / Acceptance Criteria

- [x] Existing chats open without a runtime `ReferenceError`.
- [x] Message submission reaches the chat API instead of stopping in the client.
- [x] OAuth tool state and message queues use the current upstream state model.
- [x] Production deployment preserves PostgreSQL and persistent volumes.

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

- Focused Vitest regression check passed: `Chat.runtime-state.test.ts` (1/1).
- Full frontend Vitest suite passed: 22 files, 93 tests.
- Fresh `linux/amd64` image `airis:c7c200151` built locally and matched the transferred server image by config/rootfs hash.
- Guarded production deployment completed with backup `/opt/backups/airis/20260806T044320Z-c7c200151/`; dump, globals and data tar checksums passed.
- PostgreSQL counts remained 81 users and 108 chats; Alembic stayed at `a91c0d8e4f62`.
- Authenticated production browser opened an existing chat and submitted a controlled message in chat `9d61b3c3-629c-4a6f-a947-a282fbda919f`.
- `/api/chat/completions` returned 200 with no client runtime exception; generation then stopped through the expected insufficient-funds flow for a zero balance.
- Application and PostgreSQL containers are healthy; application restart count is zero.

## Risks / Rollback

- Risk: shared chat navigation/submission state and production app recreation.
- Rollback: retain the current immutable image and verified database/data backup; never remove volumes.

## Completion Checklist

- [x] `meta/tools/sdd check-complete chat-runtime-state-recovery-2026-08-06-001 --json`
- [x] `meta/tools/sdd complete-spec chat-runtime-state-recovery-2026-08-06-001 --json`
- [x] Move the current task entry to completed.
