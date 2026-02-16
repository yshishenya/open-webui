- [x] **[BUG][WORKFLOW][SDD]** Align workflow + SDD docs and state consistency
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__workflow-sdd-consistency-and-command-alignment.md`
  - Owner: Codex
  - Branch: `HEAD`
  - Done: 2026-02-16
  - Summary: Harmonized mandatory workflow rules, corrected SDD CLI docs, and fixed inconsistent SDD metadata/state in completed specs.
  - Tests: `meta/tools/sdd list-specs --json`, `meta/tools/sdd progress yandex-oauth-login-2026-02-05-722 --json`, `jq -e` JSON checks
  - Risks: Low (process/docs metadata only)

## 2026-02-16 - Full CI pipeline hardening for airis_b2c

Spec: meta/memory_bank/specs/work_items/2026-02-16__infra__full-ci-pipeline-hardening-airis-b2c.md

### Completed

- Activated disabled quality gates by renaming:
  - .github/workflows/lint-backend.disabled -> .github/workflows/lint-backend.yml
  - .github/workflows/lint-frontend.disabled -> .github/workflows/lint-frontend.yml
  - .github/workflows/integration-test.disabled -> .github/workflows/integration-test.yml
- Added branch policy enforcement workflow:
  - .github/workflows/airis-branch-policy.yml
- Added blocking SDD validation workflow:
  - .github/workflows/sdd-validate.yml
- Added security gates workflow:
  - .github/workflows/security.yml
- Added migration safety workflow:
  - .github/workflows/migration-check.yml
- Updated PR template to enforce airis_b2c + required checks:
  - .github/pull_request_template.md

### Notes

- CODEOWNERS remains single-owner setup as requested.

## 2026-02-16 - SDD lifecycle hardening (create/update/close)

Spec: meta/memory_bank/specs/work_items/2026-02-16__docs__sdd-lifecycle-create-update-close-hardening.md

### Completed

- Fixed `.github/workflows/sdd-validate.yml` to validate all SDD specs via explicit iteration and gate on aggregated JSON `errors == 0`.
- Added explicit SDD lifecycle rules (`create -> update -> close`) to:
  - `meta/sdd/README.md`
  - `meta/memory_bank/guides/task_updates.md`
  - `meta/memory_bank/specs/README.md`
  - `meta/memory_bank/README.md`
  - `meta/memory_bank/workflows/new_feature.md`
  - `meta/memory_bank/workflows/bug_fix.md`
  - `meta/memory_bank/workflows/refactoring.md`
- Fixed repository-specific command/path guidance in SDD artifact docs:
  - `.backups/.reports/.reviews/.fidelity-reviews` READMEs now use `meta/tools/sdd` and `meta/sdd/specs/...`.
- Added missing `metadata.work_item_spec` links in existing SDD JSON specs (completed + pending entries found during audit).

### Notes

- This change is process/CI/docs hardening; no runtime product behavior changed.

### Additional completion (SDD warnings cleanup)

- Installed `jsonschema` in local SDD toolkit runtime to enable real schema checks.
- Fixed warning-causing SDD metadata/spec_id issues in completed specs.
- Fixed schema violations in `telegram-authentication` completed spec (`metadata.changes` arrays -> strings).
- Updated CI SDD gate to require both `errors == 0` and `warnings == 0`.
- Updated `meta/sdd/README.md` with strict validation dependency and gate guidance.

### Verification

- Full SDD pass: `total_errors=0`, `total_warnings=0` across all specs.

### Additional completion (SDD filename/spec_id alignment)

- Renamed SDD completed spec files to match normalized `spec_id` values.
- Updated all in-repo references to old IDs/paths.
- Verified no `basename != spec_id` mismatches remain across `meta/sdd/specs/*/*.json`.
- Re-validated all specs: `total_errors=0`, `total_warnings=0`.

### Additional completion (docs best-practice alignment)

- Reworked `sdd-validate` CI to be self-contained (schema+policy validation, no required preinstalled `sdd` on runner).
- Pinned workflow dependency: `jsonschema==4.26.0`.
- Fixed strict validation docs example to gate on both `errors` and `warnings`.
- Unified non-integration branch rules across AGENTS/Memory Bank docs (`feature/*`, `bugfix/*`, `refactor/*`, `docs/*`, `codex/*`).
- Unified required consolidation fields in task updates (`Spec`, `Owner`, `Summary`, `Done/Started`).

### Additional completion (SDD backlink cleanup)

- Added missing `SDD Spec:` fields in 4 legacy work item specs that were referenced by SDD JSON metadata.
- Re-checked bidirectional cross-link integrity: no missing backlinks.
- Re-checked strict SDD schema/policy validation: `errors=0`, `warnings=0`.

### Additional completion (branch terminology cleanup)

- Unified branch terminology in AGENTS/Memory Bank docs to `non-integration branches` and explicitly included `codex/*` in branch policy wording.
- Result: no drift between task-tracking policy statements across top-level guidance docs.

### Additional completion (legacy meta normalization)

- Standardized legacy work item specs to include full `Meta` fields and explicit `SDD Spec` entries (`N/A` where appropriate).
- Re-checked work item structure + SDD linkage: no issues.
- Re-checked strict SDD schema/policy validation: `errors=0`, `warnings=0`.
