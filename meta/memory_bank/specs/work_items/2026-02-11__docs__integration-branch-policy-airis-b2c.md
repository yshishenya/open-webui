# Enforce Integration Branch Policy (`airis_b2c`)

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-history-filters-not-working
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

The repository docs were inconsistent about branch targets: some places already referenced the integration branch
`airis_b2c`, while others still implied completion by merging to `main`. This causes PR target mistakes and
operational confusion.

## Goal / Acceptance Criteria

- [x] Core process docs explicitly define `airis_b2c` as the default integration branch for regular work.
- [x] Docs explicitly state that direct feature/bugfix/refactor/docs work should not target `main`.
- [x] Workflow checklists (new feature / bug fix / refactor / review) reflect the same PR target policy.
- [x] Consolidation guide explicitly states this policy applies on the integration branch and should be propagated during consolidation.

## Non-goals

- Change git branch protection settings in remote hosting.
- Modify CI/CD workflow logic.
- Rewrite unrelated process documentation.

## Scope (what changes)

- Backend:
  - N/A
- Frontend:
  - N/A
- Config/Env:
  - N/A
- Data model / migrations:
  - N/A
- Documentation:
  - `AGENTS.md`
  - `meta/memory_bank/README.md`
  - `meta/docs/guides/development.md`
  - `meta/memory_bank/workflows/new_feature.md`
  - `meta/memory_bank/workflows/bug_fix.md`
  - `meta/memory_bank/workflows/refactoring.md`
  - `meta/memory_bank/workflows/code_review.md`
  - `meta/memory_bank/tech_stack.md`
  - `meta/memory_bank/guides/task_updates.md`

## Implementation Notes

- Added an explicit branch policy line in core docs and workflow checklists.
- Updated checklist completion steps to target PRs to `airis_b2c`.
- Kept `meta/memory_bank/current_tasks.md` unchanged on this non-integration branch per worktree-safe rule;
  status wording can be updated when consolidating on `airis_b2c`.

## Upstream impact

- Upstream-owned files touched:
  - None (docs-only process files in Airis meta/ and root instructions)
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - N/A

## Verification

Docker Compose-first commands are not required for docs-only updates.

- Validation command: `rg -n "airis_b2c|do not.*main|PR target|integration branch" AGENTS.md meta/memory_bank/README.md meta/docs/guides/development.md meta/memory_bank/workflows/new_feature.md meta/memory_bank/workflows/bug_fix.md meta/memory_bank/workflows/refactoring.md meta/memory_bank/workflows/code_review.md meta/memory_bank/tech_stack.md meta/memory_bank/guides/task_updates.md`

## Task Entry (for branch_updates/current_tasks)

- [x] **[DOCS][PROCESS]** Enforce integration branch policy (`airis_b2c`, no direct work to `main`)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__docs__integration-branch-policy-airis-b2c.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-history-filters-not-working`
  - Done: 2026-02-11
  - Summary: Unified branch policy across AGENTS and Memory Bank workflows to keep regular work on `airis_b2c` and avoid direct PRs to `main`.
  - Tests: N/A (docs-only)
  - Risks: Low (process documentation alignment)

## Risks / Rollback

- Risks:
  - Contributors accustomed to `main` may need a brief transition reminder.
- Rollback plan:
  - Revert this docs-only commit if branch policy changes in the future.
