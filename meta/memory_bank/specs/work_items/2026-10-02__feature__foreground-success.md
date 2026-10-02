# Durable foreground chat success

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/foreground-success
- SDD Spec: meta/sdd/specs/active/airis-foreground-success-2026-10-02-0343.json
- Created: 2026-10-02
- Updated: 2026-10-02

## Goal and measured acceptance

The server records actual completed foreground results independently of optional analytics consent. Success means a nonempty visible answer or an available supported artifact; it does not prove business usefulness. One human generation counts once across models and repeated completion delivery. Explicit regeneration/continuation is a new operation. Errors, interrupted/incomplete streams, reasoning-only output, tool-call-only output, internal agents, timers and automations count zero.

- [x] Ordinary and temporary chat, API and stream/non-stream use common success rules.
- [x] Unique (user_id, operation_id, kind), account foreign key, first/count/last indices; concurrent inserts produce exactly one row.
- [x] No prompt, response, email, IP, model output or authentication data in success records/checkpoints.
- [x] Server-owned checkpoint is committed with saved response; bounded reconciliation repairs missing journal entries, with no old-content inference or client marker import.
- [x] Temporary/API completion awaits bounded async journal attempts before closing; exhausted failures are logged, answers remain usable. A total database outage cannot guarantee recording a temporary result; no invented success on recovery.
- [x] Stream failure/cancellation and content-free continuation produce zero success; one multi-model operation counts once even when output forms differ.
- [x] Artifact-only success verifies a displayed owned server file is locally present; unsupported/external URLs are conservatively excluded instead of fetched.
- [x] Client analytics remain optional, consent-bound funnel observations; documentation clarifies they are not authoritative activation or useful-task counts.
- [ ] SQLite/PostgreSQL, retry/recovery, concurrency, request paths and migration checks pass; checked source merged and production accepted.

## Design and reused components

Use one fork-owned success table with user_id, operation_id, fixed kind=foreground_chat, completed_at and source=saved_chat/temporary_chat/api. Reuse async SQLAlchemy sessions, dialect ON CONFLICT, ChatMessage persistence and existing scheduler. An additive nullable JSON column holding pending checkpoints on chat_message stores only server-created operation/kind/time/source. ChatMessages.upsert receives checkpoint through an explicit server-only keyword, never from client message JSON; ordinary imports/edits preserve this column but cannot create it. The checkpoint commits with the dual-written normalized response, allowing the scheduler to reconcile exact proof rather than infer success from arbitrary done=true/history. Success records survive chat deletion and are removed with the account. Repeated completion uses the unique key and earliest completion time. Pending continuation proofs append under a message row lock and are removed atomically with journal insertion. Reconciliation uses small batches of pending proofs; failures log sanitized error classes.

The UI submits a fresh operation UUID per explicit request. Server hashes its UUID or legacy assistant IDs together with the authenticated user scope; it does not accept client metadata as proof. The operation remains shared across per-model fanout. Legacy request without IDs gets a server UUID; a client that needs HTTP replay idempotency supplies the same operation_id. Repeated completion callbacks use unchanged metadata. Continuation compares final visible text/artifact URLs to initial result, so old content cannot activate a new empty continuation.

Reuse repository-pinned SQLAlchemy 2.0.50 / Alembic 1.18.4 and existing Svelte/native crypto. Official async ORM/migration docs reviewed for the prior consent work and applicable APIs reused. Compatibility constraint and upgrade path remain the same shared lockfile baseline; no dependency introduced/replaced. No email enablement, broker, new event bus or generic workflow framework.

## Upstream impact

Thin hooks in main metadata, response terminal handlers, ChatMessages/Chats checkpoint keyword, account deletion and scheduler. One native crypto field in Chat.svelte. Model, success rules, migration, documentation and regression checks are fork-owned. Do not reformat upstream-owned files.

## Verification / rollout

Compose-first backend and frontend checks, new targeted SQLite and PostgreSQL checks, migration upgrade/downgrade/reupgrade on a restored disposable copy, lint/type baseline comparison. Confirm candidate hashes, preserved current production configuration and other containers, guard disk >=10 GiB, compatible migration rollback. Real ordinary/temporary responses must create journal rows; error/cancel and internal controls must not. Never enable email sequence in this change.

## Local verification

- Backend: 514 pass / two PostgreSQL-only skips, covered by dedicated PostgreSQL checks. PostgreSQL: 93 pass, including concurrent checkpoint append/clear. SQLite and PostgreSQL upgrade, account foreign key, downgrade/reupgrade and idempotent upgrade pass.
- Frontend: 147 pass. Baseline and current diagnostics are identical: 8360 errors / 224 warnings, zero added or removed. Existing failures are not reported as green.
- Ruff baseline comparison adds no findings; one inherited unused import is resolved by the required Response type annotation. New model/rules/migration/test files pass Ruff/Black. Thin changed ranges are formatted without reformatting upstream files.
- Controlled paths cover stream/nonstream/temp/API, cancellation, failure hidden by a filter, reasoning-only/tool-call-only output, local owned artifact availability, continuation without new content, all saved modes, concurrent replay, 12 PostgreSQL checkpoint appends and recovery after exhausted writes.
- Native Node 22 build succeeds; frozen-SHA rebuild, CI, compatible rollback and production acceptance remain pending. Email sequence remains off.
