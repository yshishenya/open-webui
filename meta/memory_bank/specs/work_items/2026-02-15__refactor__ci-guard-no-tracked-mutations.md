# CI Guard: Fail If Tests Mutate Git-Tracked Files

## Meta

- Type: refactor
- Status: in_progress
- Owner: codex (gpt-5.3-codex)
- Branch: codex/refactor/ci-no-tracked-mutations
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

Some test/startup paths run containers with bind mounts (e.g. `docker-compose.dev.yaml` mounting `./backend`).
If container startup scripts write into those mounts, they can mutate **git-tracked** files in the working tree.

This is exactly the class of regression we want to prevent (e.g., static sync clobbering tracked assets).

## Goal / Acceptance Criteria

- [ ] CI fails if any git-tracked file content changes during test workflows.
- [ ] Works for both PR and push workflows on `airis_b2c`.
- [ ] The failure output includes `git status`/`git diff` to make triage fast.

## Scope (what changes)

- GitHub Actions:
  - Add a post-test guard step `git diff --exit-code` to:
    - `.github/workflows/backend-tests-airis-b2c.yml`
    - `.github/workflows/billing-confidence.yml`

## Verification

- Open a PR and ensure workflows pass when repo remains clean.
- (Optional) Force a local repro of a tracked mutation to see the guard fail with actionable output.

## Risks / Rollback

- Risk: Low; should only fail when there is a real tracked-file mutation.
- Rollback: Revert the workflow step additions.

