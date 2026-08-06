# Billing release gates and production rollout

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/billing-release-gates`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/billing-release-gates-and-prod-2026-08-06-1818.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

Billing hardening PR #89 was merged into `airis_b2c` while backend and billing confidence checks were red. Billing critical, frontend, and E2E suites pass, but one billing test mutates shared table singletons and the repository-wide backend suite contains stale tests for async APIs. Production must not be updated until the release gates are green and the guarded rollout is verified.

## Goal / Acceptance Criteria

- [x] Billing tests restore shared singleton methods without weakening coverage thresholds.
- [ ] Repository backend CI and billing `release-heavy` confidence checks pass on GitHub.
- [ ] A focused follow-up PR is merged into `airis_b2c`.
- [ ] The merged immutable image is built for `linux/amd64` and verified.
- [ ] Guarded production deployment creates verified backups and passes the migration and health gates.
- [ ] Production billing health/canary checks pass after rollout.

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
- Local billing `pr-fast`: backend and frontend stages passed; the E2E image build was blocked before tests by repeated PyPI SSL timeouts while installing `uv`, so GitHub CI is the authoritative E2E gate.
- Playwright E2E image `1.62.1` built locally and launched the lockfile-matched Chromium successfully; rebuilding the separate application image remained blocked by the same PyPI `uv` timeout.
- Billing confidence `pr-fast`, `merge-medium`, and manual `release-heavy`.
- Migration check, backend/frontend lint, SDD validation.
- Guarded production backup, migration, health, billing smoke, and canary.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][BILLING][RELEASE]** Restore release gates and deploy billing hardening
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-release-gates-production.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-release-gates`
  - Started: 2026-08-06
  - Summary: Repair stale async tests and cross-file billing coverage isolation, merge a green follow-up PR, and complete guarded production rollout.
  - Tests: In progress.
  - Risks: Critical financial release; production changes only after green CI and verified backups.

## Risks / Rollback

- Risks:
  - Test-only fixes could hide a runtime mismatch if mocks diverge from current APIs.
  - Billing migration changes production schema during deployment.
- Rollback plan:
  - CI fixes are reverted through a follow-up commit.
  - Guarded deploy retains the previous image and verified database/application backups; database restore requires an explicit incident decision.

## Completion Checklist

- [ ] `meta/tools/sdd check-complete billing-release-gates-and-prod-2026-08-06-1818 --json`
- [ ] `meta/tools/sdd complete-spec billing-release-gates-and-prod-2026-08-06-1818 --json`
- [ ] Branch update entry moved to Done with CI, deploy, backup, and smoke evidence.
