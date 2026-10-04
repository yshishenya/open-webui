# Chat selection and active task contracts

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/chat-selection-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-selection-contracts-2026-10-04-001.json
- Created: 2026-10-04

## Context

The general frontend quality gate reports implicit arrays in Chat selection state and the derived MessageInput model selection. Child input props already require string IDs. Active backend task IDs are UUID strings; no task is represented by null.

## Goal / Acceptance Criteria

- [x] Existing model/tool/skill/filter ID lists accept empty and multiple string IDs; numeric IDs are rejected.
- [x] Task state accepts null, empty and multiple string IDs.
- [x] Complete client and server JavaScript for both components is byte identical before and after annotations.
- [x] All frontend tests pass; no added type or lint diagnostic, with removed diagnostics counted.
- [ ] Source, verification, SDD and branch log committed and pushed for review against airis_b2c.

## Scope and non-goals

Only annotate existing selections in Chat and MessageInput and the existing selected-model reduction accumulator. Preserve defaults, reactive statements, draft restoration, request payloads, task reconciliation, cancellation, model availability, all APIs and dependencies. No database or production configuration changes.

## Traced contracts

- Chat selects model IDs from Model.id and selectedModels; MessageInput derives the same list.
- Tool defaults come from ModelMeta.toolIds, authenticated tools, settings and query string split; draft JSON restores the same fields. MessageInput binds string ID props to its existing menu.
- Skills use ModelMeta.skillIds and active skill IDs. Filters use ModelMeta.defaultFilterIds and matching filter IDs.
- Backend tasks.py uses str(uuid4()); main.py returns task_ids from those IDs. Chat restores pending IDs, appends task_ids/task_id, and passes taskIds to all input paths. stopTask takes a string.

## Upstream impact

Chat.svelte and MessageInput.svelte receive type-only declaration edits; no moved code, formatting cleanup or new helper. Reuse existing contract tests and verify whole-component compiler output; no new runtime module.

## Verification

Docker Compose frontend tests; full npm run check and npm run lint:frontend compared with accepted baseline. Strict Prettier checks on changed files. Complete Svelte client/server compile equality. Backend, migration and live UI checks do not need repetition if compiled code and backend hashes remain unchanged.

## Risks / Rollback

Narrowing an array may reveal a previously hidden incompatible caller. Compare diagnostic multisets and do not suppress additions. Revert only the annotations if necessary.

## Verified result

- All 480 frontend tests pass in 72 files through Docker Compose.
- Type errors: 3967 -> 3934; warnings remain 164. Removed 33 diagnostics, added 0. Six pre-existing diagnostics retain their exact location and describe the same issue using the new string array type: tools/tool-ids query assignments and four chat-variable helper calls. No assertion or suppression added.
- ESLint: 1419 -> 1419, exact full diagnostic list unchanged.
- Complete Chat and MessageInput client/server JavaScript is byte identical after compilation. An isolated strict compiler probe accepts empty/multiple string IDs and nullable tasks, rejects all six numeric ID assignments.
- MessageInput and new Markdown formatting pass. Chat has the same pre-existing whole-file formatting differences; formatting both versions and removing only our annotations gives identical text. No unrelated upstream formatting edits.
- npm run preflight is absent in package.json. Actual test, type, lint and format checks were run directly; global frontend checks still fail on the documented existing debt. Backend and migration source unchanged; no deployment needed for type erasure alone.
- SDD 3/3 completed. Full goal and real pilot acceptance remain open.
