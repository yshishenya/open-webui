# Chat loader error recovery

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/chat-loader-error-recovery-2026-08-05-2311.json`
- Created: 2026-08-05
- Updated: 2026-08-05

## Context

Opening an existing chat could leave the frontend spinner running forever, and sending a message did nothing. Production logs showed the chat GET returning `200`, but the browser did not continue to the tags/tasks requests. The shared `getChatById` helper swallowed response parsing errors as `null`, while the navigation path had no final loading-state recovery.

## Goal / Acceptance Criteria

- [ ] Chat load errors remain observable and do not become a successful `null` result.
- [ ] Chat navigation always clears the loading state after a failure.
- [ ] Existing chat loading and message submission work after deployment.
- [ ] Production rollout preserves PostgreSQL data and has a verified rollback image.

## Non-goals

- No schema or database migration.
- No changes to chat data or persistent volumes.
- No Ollama configuration changes; its connection errors are unrelated background noise.

## Scope

- Backend: none.
- Frontend: `getChatById` error propagation and `Chat.svelte` loading recovery.
- Tests: frontend regression coverage for successful and malformed chat responses.
- Deployment: rebuild from current `airis_b2c` sources and guarded rollout.

## Implementation Notes

- Preserve the existing API contract and authentication headers.
- Keep tags/tasks best-effort behavior unchanged.
- Build a fresh `linux/amd64` image locally because the production host cannot compile it.

## Verification

- `npm run test:frontend`
- Targeted lint/build checks for changed frontend paths.
- Guarded production backup, migration gate, health checks, DB counts/revision, and post-deploy chat API checks.

## Upstream impact

- Upstream-owned files touched: `src/lib/apis/chats/index.ts`, `src/lib/components/chat/Chat.svelte`.
- Why unavoidable: the failure is in the shared upstream chat loading path.
- Minimization strategy: two localized changes; no API or data-model contract changes.

## Risks / Rollback

- Risk: short application-container recreate during rollout.
- Rollback: retain the previous image and use `scripts/deploy_guarded.sh`; do not downgrade the database automatically.
