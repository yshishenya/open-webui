# Work Item: SDD Lifecycle Hardening (Create -> Update -> Close)

## Meta

- Type: docs
- Status: active
- Owner: Codex
- Branch: head-no-branch
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

A repeat audit found gaps between documented SDD lifecycle rules and actual implementation:

1. CI workflow used invalid `sdd validate --all` command.
2. Docs described cross-linking, but not a strict close procedure for SDD specs.
3. Several existing SDD specs were missing mandatory `metadata.work_item_spec`.
4. SDD artifact READMEs used generic `specs/...` paths and raw `sdd` commands instead of repo wrapper and `meta/` paths.

## Scope

1. SDD CI validation workflow.
2. Lifecycle documentation in Memory Bank and SDD docs.
3. Existing SDD JSON metadata consistency.
4. SDD artifact README path/command consistency.

## Changes

1. Reworked `.github/workflows/sdd-validate.yml`:
   - Validate all specs via explicit file iteration.
   - Ensure `jsonschema` is installed in SDD runtime during CI.
   - Parse JSON output and gate on total `errors == 0` and `warnings == 0`.
   - Avoid relying on `sdd validate` exit code when warnings are present.
2. Added explicit create/update/close lifecycle rules:
   - `meta/sdd/README.md`
   - `meta/memory_bank/guides/task_updates.md`
   - `meta/memory_bank/specs/README.md`
   - `meta/memory_bank/README.md`
   - `meta/memory_bank/workflows/new_feature.md`
   - `meta/memory_bank/workflows/bug_fix.md`
   - `meta/memory_bank/workflows/refactoring.md`
3. Added missing `metadata.work_item_spec` in existing SDD specs.
4. Fixed SDD artifact READMEs to use repository paths and wrapper:
   - `meta/sdd/specs/.backups/README.md`
   - `meta/sdd/specs/.reports/README.md`
   - `meta/sdd/specs/.reviews/README.md`
   - `meta/sdd/specs/.fidelity-reviews/README.md`
5. Normalized warning-producing legacy SDD data:
   - Updated non-standard `spec_id` values to recommended `...-NNN` suffix.
   - Removed `metadata.file_path` from a `decision` task node where it is discouraged.
   - Fixed schema-incompatible `metadata.changes` array values in Telegram completed spec.

## Risks

1. Low: docs/process-only changes plus CI command correction.
2. Medium: metadata normalization may surface latent historical mismatches (now visible and traceable).

## Done Criteria

1. SDD CI workflow uses valid command flow.
2. Docs explicitly define SDD close step before task `Done`.
3. All current SDD specs have `metadata.work_item_spec`.
4. SDD README command/path examples are repo-correct (`meta/tools/sdd`, `meta/sdd/...`).
5. Full local SDD validate pass returns `total_errors=0` and `total_warnings=0`.

## Additional Follow-up (Filename/ID Alignment)

1. Renamed completed SDD JSON files so filename equals normalized `spec_id`:
   - `billing-coverage-gate-hardenin-2026-02-12-102.json`
   - `telegram-authentication-2026-02-05-039.json`
   - `yandex-oauth-login-2026-02-05-722.json`
2. Updated all repository references from old IDs/path fragments to new values.
3. Verified all current SDD JSON specs satisfy `basename == spec_id`.

## Additional Follow-up (Best-Practice Alignment)

1. Made SDD CI validation self-contained and runner-independent:
   - `.github/workflows/sdd-validate.yml` now validates specs directly via JSON Schema + repo policy checks.
   - Removed hard dependency on preinstalled `sdd` binary in CI.
2. Pinned validation dependency for reproducibility:
   - `jsonschema==4.26.0` in SDD workflow.
3. Fixed doc inconsistency in strict validation examples:
   - `meta/sdd/README.md` loop example now gates on both errors and warnings.
4. Unified non-integration branch rules across docs:
   - Added consistent branch set (`feature/*`, `bugfix/*`, `refactor/*`, `docs/*`, `codex/*`).
5. Unified mandatory fields for branch updates consolidation:
   - Required fields now include `Spec`, `Owner`, `Summary`, and `Done`/`Started`.

## Additional Follow-up (Cross-link Backfill)

1. Backfilled missing `SDD Spec:` backlinks in legacy work item specs referenced by `metadata.work_item_spec`:
   - `2026-02-05__feature__billing-scenarios-e2e-tests.md`
   - `2026-02-06__bugfix__chat-direct-ack-billing-block-modal.md`
   - `2026-02-05__feature__telegram-auth-login-widget.md`
   - `2026-02-05__bugfix__welcome-pricing-rate-cards.md`
2. Re-ran bidirectional cross-link audit: no missing backlinks remain.

## Additional Follow-up (Terminology Consistency)

1. Updated branch terminology drift in core docs:
   - `AGENTS.md`: task updates wording now uses `non-integration branches` instead of partial branch subset examples.
   - `meta/memory_bank/README.md`: branch policy wording now explicitly includes `codex/*` alongside other non-integration branch families.
2. Goal: prevent ambiguous interpretation of where `current_tasks.md` edits are allowed.

## Additional Follow-up (Legacy Meta Normalization)

1. Normalized legacy work item metadata blocks to the current template fields:
   - Added/standardized `Type`, `Status`, `Owner`, `Branch`, `Created`, `Updated`, and `SDD Spec` where missing.
2. This removed parser ambiguity for automation that validates documentation structure.
3. Re-ran docs-structure and SDD strict checks after normalization; both are clean.
