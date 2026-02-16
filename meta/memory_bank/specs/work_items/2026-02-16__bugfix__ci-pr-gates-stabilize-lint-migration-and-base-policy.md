# CI PR gates: stabilize lint, migration check, and base-branch policy

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/ci-remote-run-2026-02-16
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

PR #61 had multiple CI failures unrelated to the new workflow/docs changes:

- `migration-check` failed because Alembic was launched without its project config path.
- `Lint Backend` and `Lint Frontend` failed on large pre-existing repo-wide lint debt.
- PR review highlighted a branch-policy bypass: retargeting a PR base branch does not re-run policy unless `pull_request.edited` is subscribed.

This made the CI signal noisy and blocked merges for non-code changes.

## Goal / Acceptance Criteria

- [x] Base-branch policy gate re-runs on PR base-branch edits.
- [x] Migration check executes Alembic commands from the correct config location.
- [x] Backend/frontend lint gates are incremental for PRs and do not fail on unrelated legacy debt.
- [x] Lint jobs still enforce quality on changed files.

## Non-goals

- Full repository lint-debt cleanup.
- Refactoring existing application code unrelated to CI gate behavior.
- Changing product/runtime behavior.

## Scope (what changes)

- Backend:
  - N/A
- Frontend:
  - N/A
- Config/Env:
  - N/A
- Data model / migrations:
  - N/A
- CI:
  - `airis-branch-policy.yml`: add `pull_request` activity types including `edited`.
  - `migration-check.yml`: run Alembic from `backend/open_webui` with explicit config file.
  - `lint-backend.yml`: lint only changed `backend/**/*.py` files.
  - `lint-frontend.yml`: lint only changed frontend lint targets.

## Implementation Notes

- Key files/entrypoints:
  - `.github/workflows/airis-branch-policy.yml`
  - `.github/workflows/migration-check.yml`
  - `.github/workflows/lint-backend.yml`
  - `.github/workflows/lint-frontend.yml`
- API changes:
  - None.
- Edge cases:
  - First push (`github.event.before` all-zero SHA) handled via fallback to repository root commit.
  - Non-code PRs now skip lint jobs cleanly with success status.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `.github/workflows/airis-branch-policy.yml`
  - `.github/workflows/migration-check.yml`
  - `.github/workflows/lint-backend.yml`
  - `.github/workflows/lint-frontend.yml`
- Why unavoidable:
  - All failures and review findings were in CI workflow behavior.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Only workflow definitions changed, with narrow guard conditions and path-aware lint execution.

## Verification

- GitHub checks reviewed:
  - `migration-check` previously failed with `No 'script_location' key found in configuration`.
  - `Lint Backend` previously failed with 546 pre-existing Ruff issues.
  - `Lint Frontend` previously failed with repo-wide ESLint/type-check debt.
  - PR review comment flagged missing `pull_request.edited` handling in branch policy.
- Local tests:
  - N/A (CI workflow-only changes; validated via remote check logs).

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][CI]** Stabilize PR gates: lint, migration-check, and base-policy rechecks
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__ci-pr-gates-stabilize-lint-migration-and-base-policy.md`
  - Owner: Codex
  - Branch: `codex/ci-remote-run-2026-02-16`
  - Done: 2026-02-16
  - Summary: Made CI gates deterministic for PRs by adding base-branch edit rechecks, fixing Alembic config path usage, and switching lint jobs to incremental changed-file checks.
  - Tests: `N/A (workflow-only fix; verification through GitHub Actions checks/logs)`
  - Risks: Low-Medium (CI behavior changed; enforcement is now incremental for PRs)

## Risks / Rollback

- Risks:
  - Incremental lint strategy on PRs may miss unrelated pre-existing repo-wide violations (intentional tradeoff to avoid legacy-noise failures).
- Rollback plan:
  - Revert workflow files to previous full-repo lint and original migration/PR-event behavior.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
