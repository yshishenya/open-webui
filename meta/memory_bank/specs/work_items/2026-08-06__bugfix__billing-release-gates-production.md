# Billing release gates and production rollout

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/billing-release-gates`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/billing-release-gates-and-prod-2026-08-06-001.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

Billing hardening PR #89 was merged into `airis_b2c` while backend and billing confidence checks were red. Billing critical, frontend, and E2E suites pass, but one billing test mutates shared table singletons and the repository-wide backend suite contains stale tests for async APIs. Production must not be updated until the release gates are green and the guarded rollout is verified.

## Goal / Acceptance Criteria

- [x] Billing tests restore shared singleton methods without weakening coverage thresholds.
- [x] Repository backend CI passes; `release-heavy` passes on GitHub or through the documented exact-command outage exception.
- [x] Focused follow-up PRs are merged into `airis_b2c`.
- [x] The merged immutable image is built for `linux/amd64` and verified.
- [x] Guarded production deployment creates verified backups and passes the migration and health gates.
- [x] Production billing health/canary checks pass after rollout.

## Non-goals

- Changing billing product behavior or production secrets.
- Enabling subscription sales.
- Removing or weakening tests, coverage thresholds, backups, or rollback gates.

## Scope (what changes)

- Backend: update stale tests for current async APIs and restore isolation of shared billing test doubles.
- Frontend: no product changes.
- Test infrastructure: align the Playwright E2E image with the version resolved in `package-lock.json`.
- Config/Env: no production secret changes.
- Data model / migrations: use the already-merged billing migration; no additional schema change expected.
- Operations: build an immutable image, deploy through `scripts/deploy_guarded.sh`, and verify production.

## Implementation Notes

- Keep fixes in tests unless a real runtime defect is found.
- Make primary-admin lookup deterministic when users share a creation timestamp.
- Keep the Playwright browser image at `1.62.1`, matching the lockfile-resolved test runner.
- Preserve existing line/branch coverage thresholds.
- Use `airis_b2c` as the PR base and guarded deployment with backup and automatic image rollback.

## Upstream impact

- Upstream-owned files touched: backend tests and one deterministic ordering clause in the user model.
- Why unavoidable: tests still target removed synchronous/config/network APIs; primary-admin selection was nondeterministic on timestamp ties.
- Minimization strategy: update mocks at their trust boundaries, restore shared doubles through pytest, and add one stable secondary sort key; no new framework or dependency.

## Verification

- Targeted failing backend tests: 62 passed across focused runs.
- Repository backend Docker CI: 370 passed locally.
- PR #90: all seven required checks passed; merged as `ef9a41f6a7499b3bac2ac39153bc6945b454ff9b`.
- Post-merge `merge-medium`: critical 93 passed, coverage 195 passed, frontend 8 passed, E2E 9 passed; exposed only the unchanged utils line gate at 84.72%.
- PR #91: one direct test restored coverage without runtime changes; merged as `7dc6239898096de4a126dcc6610ba5ce50d8b380`.
- GitHub Actions then reported a partial system outage and canceled queued jobs before any step ran. Exact local gates passed: coverage 196 tests at utils line/branch 85.26%/75.55%, full pack 214 tests, frontend 8 tests, and E2E 9 tests.
- Immutable image: `yshishenya/yshishenya:7dc6239898096de4a126dcc6610ba5ce50d8b380`, `linux/amd64`; transferred archive SHA256 `79c261984e8116529b9b9942f12817f4be3224fe08267be83b499a039bb9f8e5`.
- Guarded deploy backup: `/opt/backups/airis/20260806T190345Z-7dc6239898096de4a126dcc6610ba5ce50d8b380`.
- Production: application and PostgreSQL healthy; Alembic `b4c5d6e7f8a9`; pricing config and rate cards return HTTP 200 valid JSON; side-effect-free mock canary passed with live payments disabled.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][BILLING][RELEASE]** Restore release gates and deploy billing hardening
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-release-gates-production.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-release-gates`
  - Started: 2026-08-06
  - Summary: Repaired release gates, merged PRs #90/#91, and deployed immutable merge SHA `7dc62398` through the guarded production workflow.
  - Tests: Backend 370; billing coverage 196 at 85.26% utils line; release full pack 214; frontend 8; E2E 9; production health/pricing/mock canary green.
  - Risks: GitHub Actions outage exception documented; no runtime change in PR #91 and no coverage threshold reduction.

## Risks / Rollback

- Risks:
  - Test-only fixes could hide a runtime mismatch if mocks diverge from current APIs.
  - Billing migration changes production schema during deployment.
- Rollback plan:
  - CI fixes are reverted through a follow-up commit.
  - Guarded deploy retains the previous image and verified database/application backups; database restore requires an explicit incident decision.

## Completion Checklist

- [x] `meta/tools/sdd check-complete billing-release-gates-and-prod-2026-08-06-001 --json`
- [x] `meta/tools/sdd complete-spec billing-release-gates-and-prod-2026-08-06-001 --json`
- [x] Branch update entry moved to Done with CI, deploy, backup, and smoke evidence.
