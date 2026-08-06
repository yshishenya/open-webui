# Chat loader error recovery

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/chat-loader-error-recovery-2026-08-05-001.json`
- Created: 2026-08-05
- Updated: 2026-08-05

## Context

Opening an existing chat could leave the frontend spinner running forever, and sending a message did nothing. Production logs showed the chat GET returning `200`, but the browser did not continue to the tags/tasks requests. The shared `getChatById` helper swallowed response parsing errors as `null`, while the navigation path had no final loading-state recovery.

## Goal / Acceptance Criteria

- [x] Chat load errors remain observable and do not become a successful `null` result.
- [x] Chat navigation always clears the loading state after a failure.
- [x] Existing chat loading and message submission work after deployment.
- [x] Production rollout preserves PostgreSQL data and has a verified rollback image.

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

## Result

- Fixed in commit `020f83e03`; built as `airis:020f83e03` for `linux/amd64` and deployed to `airis`.
- The first health-gated attempt rolled back automatically because the fresh image was still warming its embedding cache; the second guarded rollout completed successfully.
- Backup `/opt/backups/airis/20260805T203839Z-020f83e03/` passed SHA256, `pg_restore --list`, and data-archive verification.
- The hard Alembic gate passed without changing the schema. Production remains on `a91c0d8e4f62`; PostgreSQL and the persistent `open-webui_airis` volume were retained.
- Production verification: public `/health` is healthy, version marker is `020f83e03`, app restarts are `0`, public chat GET returns `200` with the existing chat and 2 messages, and no new application traceback/error was logged.

## Upstream impact

- Upstream-owned files touched: `src/lib/apis/chats/index.ts`, `src/lib/components/chat/Chat.svelte`.
- Why unavoidable: the failure is in the shared upstream chat loading path.
- Minimization strategy: two localized changes; no API or data-model contract changes.

## Risks / Rollback

- Risk: short application-container recreate during rollout.
- Rollback: retain the previous image and use `scripts/deploy_guarded.sh`; do not downgrade the database automatically.
