# Group form and membership contracts

## Meta

- Type: bugfix + refactor
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/group-form-contracts`
- SDD Spec: `meta/sdd/specs/completed/airis-group-form-contracts-2026-10-03-319.json`
- Created: 2026-10-03

## Context

Integration base24a0458908f95b1ec62a25a4d289ad6bfc9106f0; current frontend check4442 errors/179 warnings and ESLint1546. Prior diagnostics: EditGroupModal7, General5, Users11 errors; two existing unused-property warnings. GroupModel accepts nullable dictionaries; user-list returns integer last_active_at and string group IDs. Creation caller includes only general/permissions; existing-group caller includes users/preview. Callbacks catch mutation failure and return void, so the modal closes and discards edits after failed create/update/default-permission writes. Missing group IDs must not reach membership APIs.

## Acceptance

- [x] Baseline tests preserve partial/null data and permissions, true/false/global defaults, stock-default immutability, member add/remove/list refresh and input retention; unsaved sharing edits do not mutate the stored group.
- [x] A failed create/update/default write leaves the modal open, preserves inputs, releases loading, reports the error, and permits retry; success closes once and refreshes state. Avoid treating a post-write refresh failure as a failed committed write.
- [x] Members and preview cannot request an absent group ID. No production group data is changed for acceptance.
- [x] All changed components/helpers/tests/callers have zero type errors and lint errors; no new diagnostics elsewhere; rules and dependencies unchanged.
- [x] Full frontend suite passes on exact source; required CI passes and PR targets airis_b2c.
- [x] Compiled changes classified; runtime changes require frozen candidate, browser acceptance and guarded production release with backup, unchanged backend/configuration and hash verification.
- [x] SDD complete, work item/branch record done, private acceptance/goal/quality updated; overall goal remains active until all A/B criteria pass.

## Approach

Describe real group payloads, nullable stored data and member list fields in fork-owned types. Reuse existing permission contracts and helpers when appropriate. Mutation callbacks report success/failure explicitly; keep external legacy callbacks returning void compatible. Fix the submit boundary with try/finally and retain edits on failure. Prevent membership rendering without a saved group. Keep API access policy, routes, validation, user roles and database schema unchanged. Add safety-net tests before implementation; add failing error tests as reproduction.

## Upstream impact

EditGroupModal, General, Users, GroupItem and Groups: minimal typed boundaries and explicit mutation result. Fork-owned helpers/types/tests isolate reusable logic. Existing upstream markup/layout retained. No dependency or backend changes planned. If lint reveals required caller fixes, document each instead of suppressing checks.

## Dependency compatibility

Use pinned Svelte5.56.0/TypeScript5.9.3 with the already-read official legacy-prop/type documentation and prior registry proof5.57.1/7.0.2. Existing compiler supports mapped types, nullable unions and typed events. No new integration or dependency; upgrades remain a separate compatibility work item.

## Risks

Rights editing is sensitive: partial settings and explicit false must remain exact; API failure must not lose edits. A successful mutation followed by failed list refresh must not invite a duplicate write. A runtime guard/error-handling change requires an actual release; type checks alone do not establish production acceptance. G14 and real pilot gates remain open.

## Reproduction and implementation

Before fixes, six lifecycle tests failed: failed create/update/default/delete closed the form; post-create refresh rejection left it busy; unsaved groups exposed membership/preview. Two additional reproductions demonstrated a checked checkbox after rejected membership and sharing data mutation before save. Evidence logs are retained privately; no live group mutations were used.

`performGroupMutation` returns an explicit boolean, handles a null result, and catches refresh failure separately from committed writes. Modal uses guarded operations and finally to release loading, retaining legacy void callbacks. Membership blocks concurrent changes, reflects committed membership on refresh failure and remounts the locally stateful checkbox from confirmed state. The modal clones stored data before editing. No API routes, authorization checks or backend code changed.

Verification so far: full frontend236/236 (49 files), including23 group scenarios; all nine changed code/test files pass ESLint and Prettier. Full ESLint1540 versus1546. PR191 exact source09431cbd10fb7d0968a724df0e71bc4b17e1faf8 passed10 actual CI checks and merged0953de341eab7ad3205a5365c89c16be7524aaca. Guarded production release accepted on the exact checked source. Strict check4419/177 versus4442/179:23 errors and2 warnings removed, zero new diagnostics by file/severity/first message line. Whole-project check remains red.

Candidate browser acceptance: actual frozen image, API mocks,1440/390 widths, failed create/update/delete retain edits, create retry closes, unsaved users/preview hidden, rejected membership resets its checkbox. Zero browser runtime errors and zero live group mutations. Candidate5759 frontend hashes match frozen build,477 backend hashes unchanged; Pyodide preserved.

## Production acceptance

Registry digest `sha256:fe404b342340ad43a572a5ca06533278856e58048d37c090028568769f3f84f5` is installed. Verified PostgreSQL and application-data backup, hard migration gate and database revision q1c020261002. All 5759 installed frontend file hashes and476 immutable backend file hashes match the frozen candidate. Runtime manifest matches the verified frontend copy. Environment, mounts, networks, ports and commands are preserved; all13 neighboring container identities are unchanged; restart count0. Public health and frontend version match the checked source.

A second browser acceptance loads production static files while mocking every API request: failed create/update/delete retain inputs, retry succeeds, unsaved membership tabs are hidden, rejected membership restores the checkbox. Desktop1440 and browser width390 have zero runtime errors and zero horizontal overflow. No production group writes were made. SDD4/4 is complete. Global quality checks and real product/pilot criteria remain open.
