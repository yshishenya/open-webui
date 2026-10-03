# Group form and membership contracts

## Meta

- Type: bugfix + refactor
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/group-form-contracts`
- SDD Spec: `meta/sdd/specs/active/airis-group-form-contracts-2026-10-03-319.json`
- Created: 2026-10-03

## Context

Integration base24a0458908f95b1ec62a25a4d289ad6bfc9106f0; current frontend check4442 errors/179 warnings and ESLint1546. Prior diagnostics: EditGroupModal7, General5, Users11 errors; two existing unused-property warnings. GroupModel accepts nullable dictionaries; user-list returns integer last_active_at and string group IDs. Creation caller includes only general/permissions; existing-group caller includes users/preview. Callbacks catch mutation failure and return void, so the modal closes and discards edits after failed create/update/default-permission writes. Missing group IDs must not reach membership APIs.

## Acceptance

- [ ] Baseline tests preserve partial/null data and permissions, true/false/global defaults, stock-default immutability, member add/remove/list refresh and input retention; unsaved sharing edits do not mutate the stored group.
- [ ] A failed create/update/default write leaves the modal open, preserves inputs, releases loading, reports the error, and permits retry; success closes once and refreshes state. Avoid treating a post-write refresh failure as a failed committed write.
- [ ] Members and preview cannot request an absent group ID. No production group data is changed for acceptance.
- [ ] All changed components/helpers/tests/callers have zero type errors and lint errors; no new diagnostics elsewhere; rules and dependencies unchanged.
- [ ] Full frontend suite passes on exact source; required CI passes and PR targets airis_b2c.
- [ ] Compiled changes classified; runtime changes require frozen candidate, browser acceptance and guarded production release with backup, unchanged backend/configuration and hash verification.
- [ ] SDD complete, work item/branch record done, private acceptance/goal/quality updated; overall goal remains active until all A/B criteria pass.

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

Verification so far: full frontend236/236 (49 files), including23 group scenarios; all nine changed code/test files pass ESLint and Prettier. Full ESLint1540 versus1546. Final exact-source CI and runtime release pending. Strict check4419/177 versus4442/179:23 errors and2 warnings removed, zero new diagnostics by file/severity/first message line. Whole-project check remains red.
