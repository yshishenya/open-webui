# Workflow + SDD consistency and command alignment

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: HEAD
- SDD Spec (JSON, required for non-trivial): N/A (workflow/docs consistency update)
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

Workflow and SDD documentation had conflicting requirements and stale command examples.
This caused process drift: different documents prescribed different mandatory steps.

## Goal / Acceptance Criteria

- [x] Align work item + SDD mandatory rules across `AGENTS.md`, Memory Bank guides, and workflows.
- [x] Fix stale SDD CLI example(s) to match the real `meta/tools/sdd` interface.
- [x] Resolve inconsistent SDD metadata/state in affected completed specs.
- [x] Ensure SDD schema accepts existing historical `spec_id` values.
- [x] Keep verification/documentation guidance coherent for `sdd validate` warning behavior.

## Non-goals

- Rewriting historical task journals beyond consistency fixes.
- Changing product/runtime behavior outside workflow/process docs and SDD metadata.

## Scope (what changes)

- Backend:
  - N/A
- Frontend:
  - N/A
- Config/Env:
  - N/A
- Data model / migrations:
  - N/A
- Docs/process:
  - `AGENTS.md`
  - `meta/memory_bank/README.md`
  - `meta/memory_bank/guides/task_updates.md`
  - `meta/memory_bank/guides/coding_standards.md`
  - `meta/memory_bank/specs/README.md`
  - `meta/memory_bank/workflows/new_feature.md`
  - `meta/memory_bank/workflows/bug_fix.md`
  - `meta/memory_bank/workflows/refactoring.md`
  - `meta/memory_bank/workflows/code_review.md`
  - `meta/sdd/README.md`
  - `meta/sdd/schema/sdd-spec-schema.json`
  - `meta/sdd/specs/completed/telegram-authentication-2026-02-05-039.json`
  - `meta/sdd/specs/completed/yandex-oauth-login-2026-02-05-722.json`

## Implementation Notes

- Unified wording so work item spec creation is required on non-integration branches.
- Kept SDD mandatory only for non-trivial work, with explicit two-way cross-linking.
- Fixed SDD command docs to use positional `task-info <spec_id> <task_id>`.
- Normalized inconsistent completed-spec state in Yandex OAuth SDD record.

## Upstream impact

- Upstream-owned files touched:
  - None
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Additive documentation and metadata-only updates.

## Verification

- `meta/tools/sdd list-specs --json` (checked progress/status consistency).
- `meta/tools/sdd progress yandex-oauth-login-2026-02-05-722 --json` (100% after fix).
- `jq -e . meta/sdd/schema/sdd-spec-schema.json`
- `jq -e . meta/sdd/specs/completed/telegram-authentication-2026-02-05-039.json`
- `jq -e . meta/sdd/specs/completed/yandex-oauth-login-2026-02-05-722.json`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][WORKFLOW][SDD]** Align workflow + SDD docs and state consistency
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__workflow-sdd-consistency-and-command-alignment.md`
  - Owner: Codex
  - Branch: `HEAD`
  - Done: 2026-02-16
  - Summary: Harmonized mandatory workflow rules, corrected SDD CLI docs, and fixed inconsistent SDD spec metadata/state.
  - Tests: `meta/tools/sdd list-specs --json`, `meta/tools/sdd progress yandex-oauth-login-2026-02-05-722 --json`, `jq -e` JSON checks
  - Risks: Low (process/docs metadata only)

## Risks / Rollback

- Risks:
  - Historical spec semantics may differ from new normalized status interpretation.
- Rollback plan:
  - Revert touched workflow/docs and restore previous SDD metadata in the two edited specs.
