# Security Gates: skip dependency-review on fork repositories

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/ci-remote-run-2026-02-16
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

Remote CI for PR #61 failed in `dependency-review` with:
`Dependency review is not supported on this repository`.
The repository is a fork (`yshishenya/open-webui`), and this action is unsupported for fork repositories.

## Goal / Acceptance Criteria

- [x] `Security Gates` workflow does not fail on fork repos because of unsupported `dependency-review`.
- [x] Dependency review still runs for non-fork repositories.
- [x] Change remains minimal and isolated to CI workflow logic.

## Non-goals

- Fix unrelated failing checks (`Lint Backend`, `Lint Frontend`, `migration-check`).
- Change dependency policies or security scanning scope beyond this compatibility guard.

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
  - Add a fork guard to `dependency-review` job condition in `security.yml`.

## Implementation Notes

- Key files/entrypoints:
  - `.github/workflows/security.yml`
- API changes:
  - None.
- Edge cases:
  - For non-fork repositories, `dependency-review` behavior is unchanged.
  - For fork repositories, job is skipped instead of failing unsupported.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `.github/workflows/security.yml`
- Why unavoidable:
  - `dependency-review` failure originates in this workflow definition.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Single-line `if` condition guard + one explanatory comment; no unrelated workflow refactors.

## Verification

- CI evidence:
  - `gh run view 22052548130 --job 63713465922 --log-failed` showed unsupported dependency review on this fork repository.
- Local tests:
  - N/A (CI workflow logic change only).

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][CI]** Skip unsupported dependency-review on fork repositories
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__security-gates-skip-dependency-review-on-fork.md`
  - Owner: Codex
  - Branch: `codex/ci-remote-run-2026-02-16`
  - Done: 2026-02-16
  - Summary: Guard `dependency-review` with `!github.event.repository.fork` so Security Gates no longer fails on unsupported fork repos.
  - Tests: `N/A (workflow-only fix; verification through GitHub Actions run logs)`
  - Risks: Low (non-fork behavior preserved)

## Risks / Rollback

- Risks:
  - On fork repos, dependency-review is skipped (intended due platform limitation).
- Rollback plan:
  - Revert the conditional guard in `.github/workflows/security.yml`.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
