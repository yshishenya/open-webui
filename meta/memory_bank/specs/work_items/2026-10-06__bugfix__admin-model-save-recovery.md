# Admin model persistence recovery

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/admin-model-save-recovery
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/active/airis-admin-model-save-recovery-2026-10-06-001.json

## Context
Actual admin upsert and inline editor callback swallow rejected create/update requests, close the editor, and reload over unsaved fields. Every shared caller was traced: four batches, individual visibility, and editor submit. The separate optimistic enabled switch also swallows a failed create. API clients can return null on transport errors; null must not count as successful persistence.

## Goal / Acceptance Criteria
- [ ] Rejected and null create/update preserve editor identity, name, description, instructions and retry; exactly one error and zero success notifications.
- [ ] Successful retry persists and closes the editor; helper performs no premature reload that unmounts it.
- [ ] Four batch actions wait for every mutation before refreshing; partial failure produces one error and zero unconditional success messages; local values reflect authoritative persisted state.
- [ ] Individual visibility failure leaves local values unchanged; enabled-switch failure restores its previous value and reports an error.
- [ ] Actual handler checks fail before and pass after; compiled admin refusal/retry cases pass in Chromium and Firefox.
- [ ] Docker frontend suite passes; changed component lint passes and mapped diagnostics introduce zero errors.
- [ ] Exact source CI and merge tree accepted; immutable frontend overlay from the current production digest passes guarded backup/Alembic/CAS/health/env/byte checks.

## Scope
Only admin Models.svelte behavior and meaningful regression checks. Existing API, data schema, translations and dependencies retained. Shared ModelEditor already catches thrown parent failures. Errors propagate from the mutation helper; user-action boundaries report them. Promise.allSettled waits for all batch responses and refreshes persisted state after mixed results. No new API, provider calls or permission changes.

## Upstream impact
src/lib/components/admin/Settings/Models.svelte owns the state and all affected handlers, with no existing extension point for these outcomes. Remove swallowed failures and premature optimistic changes there. Keep surrounding markup and unrelated behavior intact; only mandatory changed-file lint cleanup is allowed and verified separately.

## Verification
Docker Compose frontend Vitest, check and lint; actual extracted component handlers; compiled browser tests using isolated fixture/API interception. Frontend-only scope requires no backend code changes. CI read through Code Review connector only. Existing production digest is refreshed before packaging/release; retained rollback and verified backup required.

## Risks / Rollback
Partial batch persistence is possible: finish all requests, show one error and reload authoritative state. Preserve production backend/env/static assets/neighbors. Rollback is the previously accepted immutable image. Full onboarding goal and all external acceptance remain active; this fix alone closes no numbered plan item.
