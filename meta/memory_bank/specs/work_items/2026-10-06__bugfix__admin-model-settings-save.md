# Admin model settings save recovery

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/admin-model-settings-save
- SDD Spec: meta/sdd/specs/active/airis-admin-model-settings-sav-2026-10-06-0616.json
- Created: 2026-10-06

## Cause and scope

Actual saveModelsSettings retains its busy flag after child save rejects. saveModelOrder does the same on post-write getModels refusal. ModelDefaultsPanel.save reports two errors for one failed configuration write, does not await parent initialization, and can overwrite a newly saved order with its stale initial configuration. All callers: shared bottom Save button; panel is only mounted by Models. No new dependency, endpoint or schema.

## Measurable acceptance

- [x] Actual handler regression fails before and passes after: busy flags false after each refusal; exactly one safe error, zero success for a failed step; unsaved input retained and retry permitted.
- [x] False/null API outcomes stop subsequent writes; successful retry persists entered values.
- [x] Defaults save preserves latest server order/selected/pinned models; parent refresh rejection is handled, never detached.
- [x] Post-write refresh refusal remains distinguishable from full save success; pending changes remain retryable, without claiming a transaction rollback.
- [x] Docker frontend suite, changed-file format/lint and no new mapped global diagnostics.
- [ ] Compiled Chromium and Firefox tests cover actual Save refusal, retained values, retry and backend confirmation, page errors zero.
- [ ] Exact-source CI and merged tree accepted before current-base immutable overlay, verified backup and guarded production rollout.

## Implementation and upstream impact

Use existing try/catch/finally at shared save boundaries and existing safe translated error. Change only Models.svelte and its child save handler because these own local flags and writes. Await refresh before success and clearing dirty; keep input state on rejected writes. Re-read current config for the child metadata write to preserve order and independent model selection. No abstraction or dependencies.

## Verification / limits

Reuse actual-source handler tests and disposable compiled onboarding fixture. Existing whole-project diagnostics are tracked separately; this bug does not close G14 or any human/pilot gate. Production acceptance requires current base digest/CAS, matching frontend/backend files, environment, Alembic, health and unchanged neighboring containers. Retain previous image and backups for rollback.

## Source verification

Actual handler checks13/13, full Docker frontend619/619 across88files; type3493/warnings157 and lint1330 retain existing debt, zero added mapped findings. Existing child template accessibility findings remain tracked under G14. Initial test run used an unsupported matcher and the full concurrent run was killed for memory; retained as unaccepted evidence. Corrected matcher and sequential full run pass. No dependency/backend/schema changes.
