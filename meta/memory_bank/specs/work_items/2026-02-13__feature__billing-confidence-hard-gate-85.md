# Billing Confidence Hard Gate `>=85%` + Webhook Fault-Path Coverage

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: HEAD (no branch)
- Created: 2026-02-13
- Updated: 2026-02-13
- Related prior spec: `meta/memory_bank/specs/work_items/2026-02-12__feature__billing-coverage-gate-hardening.md`

## Context

The billing confidence pipeline had module-scoped coverage checks wired, but thresholds were still conservative non-regression floors. We needed to promote this to a release-level hard gate (`>=85%` line coverage for billing-critical modules), while improving test signal quality and reducing flaky infrastructure failures.

## Goal / Acceptance Criteria

- [x] Enforce module line coverage `>=85%` for both:
  - `open_webui/routers/billing.py`
  - `open_webui/utils/billing.py`
- [x] Keep branch coverage gates meaningful (not vanity):
  - routers branch `>=65%`
  - utils branch `>=70%`
- [x] Add high-signal webhook tests for negative and fault-tolerance paths (signature, replay, parse, error mapping).
- [x] Improve E2E suite resilience against transient npm registry/network failures.
- [x] Validate full `merge-medium` run passes end-to-end with updated hard gate.

## Non-goals

- Do not enforce project-wide aggregate coverage as release gate.
- Do not relax assertions to chase a number.
- Do not broaden unrelated lint/type gate policy.

## Scope (what changes)

- Backend tests:
  - Expanded `backend/open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py` with direct route tests for webhook error/replay/security branches.
- CI scripts/workflows:
  - Updated `scripts/ci/check_billing_module_coverage.py` defaults to release-level thresholds.
  - Updated `scripts/ci/run_billing_confidence.sh` default threshold env fallbacks.
  - Hardened E2E suite install step in `scripts/ci/run_billing_confidence.sh` with npm fetch retries/timeouts.
  - Updated `.github/workflows/billing-confidence.yml` env thresholds.
- Docs:
  - Updated coverage gate policy in:
    - `meta/memory_bank/guides/testing_strategy.md`
    - `meta/memory_bank/guides/billing_release_runbook.md`
    - `meta/memory_bank/guides/billing_launch_confidence.md`

## Upstream Impact

- Upstream-owned runtime files touched:
  - None.
- Minimal-diff touchpoints:
  - CI/workflow config and billing router tests only.
- Rationale:
  - Required to convert previously soft/non-regression gates into release-grade confidence checks.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "cd /app/backend && pytest -q open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py"`
- `python3 -m py_compile scripts/ci/check_billing_module_coverage.py`
- `bash -n scripts/ci/run_billing_confidence.sh`
- `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-hard-gate-85`
- `scripts/ci/run_billing_confidence.sh --tier release-heavy --run-id local-release-heavy-hard-gate-85`

Verification snapshot (`local-merge-medium-hard-gate-85`):

- Overall: `pass` (`4/4` suites)
- Module coverage:
  - `open_webui/routers/billing.py`: line `90.67%`, branch `75.26%`
  - `open_webui/utils/billing.py`: line `86.43%`, branch `78.05%`

Release confidence snapshot (`local-release-heavy-hard-gate-85`):

- Overall: `pass` (`5/5` suites)
- Module coverage:
  - `open_webui/routers/billing.py`: line `90.67%`, branch `75.26%`
  - `open_webui/utils/billing.py`: line `86.43%`, branch `78.05%`

## Risks / Rollback

- Risks:
  - Stricter gates may fail if future tests regress in signal quality.
  - E2E install stability still depends on external npm registry availability.
- Rollback:
  - Revert threshold values in checker/workflow/runner to previous levels.
  - Keep added webhook tests (they are additive reliability coverage and should remain).
