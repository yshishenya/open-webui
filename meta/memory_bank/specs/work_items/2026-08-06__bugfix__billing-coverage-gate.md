# Billing coverage gate follow-up

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/billing-coverage-gate`
- Parent: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-release-gates-production.md`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The post-merge `merge-medium` billing run passed 195 backend tests, frontend tests, and nine wallet E2E tests, but stopped because `open_webui/utils/billing.py` line coverage was 84.72% against the unchanged 85% release threshold.

## Goal / Acceptance Criteria

- [x] Cover an existing untested billing service path without changing runtime behavior or lowering thresholds.
- [x] Billing coverage for `open_webui/utils/billing.py` is at least 85%.
- [x] Follow-up PR is merged before `release-heavy` and production rollout.

## Scope

- Add one direct regression test for resuming a scheduled subscription cancellation.
- No production code, dependency, schema, configuration, or threshold changes.

## Upstream impact

- Upstream-owned runtime files touched: none.
- Test-only addition to the fork billing suite.

## Verification

- Billing service extended suite: 10 passed in the exact production candidate image.
- Exact billing coverage suite: 196 passed; utils line 85.26%, branch 75.55%; unchanged gate passed.
- PR #91 merged as `7dc6239898096de4a126dcc6610ba5ce50d8b380`; exact local release confidence passed during the documented GitHub Actions outage.

## Risks / Rollback

- Risk is limited to test behavior; rollback is reverting the test commit.
