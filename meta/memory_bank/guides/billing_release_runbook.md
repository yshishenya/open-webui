# Billing Release Runbook

This runbook defines release-candidate checks, go/no-go criteria, canary monitoring, and rollback triggers for billing-critical launches.

## Scope

- Wallet top-up flow
- Billing webhooks
- Quota enforcement and billing blocks
- Billing confidence CI pipelines (`pr-fast`, `merge-medium`, `release-heavy`)
- Post-release synthetic canary checks

## Release-Candidate Checklist (Go/No-Go)

- RC branch is based on `airis_b2c` with no unresolved billing defects.
- Billing confidence evidence is green:
  - `npm run billing:confidence:smoke` passes (guards pass/fail semantics and artifact requirements in CI smoke path).
  - `pr-fast` and `merge-medium` checks passed on latest commit.
  - `release-heavy` manual run passed for release candidate.
  - Artifacts attached (`summary.json`, `summary.md`, logs, junit/traces where available).
- Synthetic probe evidence:
  - `python scripts/ops/billing_synthetic_probe.py --mode mock` exits `0`.
  - `python scripts/ops/billing_synthetic_probe.py --mode staging --max-amount-rub 10 --require-sandbox` exits `0`.
- Critical backend suite is green:
  - `test_billing_topup.py`
  - `test_billing_subscription.py`
  - `test_billing_subscription_webhook.py`
  - `test_billing_integration.py`
- Known risks are documented with explicit owner and mitigation.

If any item above is red or missing evidence, status is **NO-GO**.

## Coverage Gate Policy

- `merge-medium` and `release-heavy` must include backend module coverage gate pass.
- Gate checks both line and branch coverage on billing-critical modules:
  - `open_webui/routers/billing.py`: line `>=85`, branch `>=65`.
  - `open_webui/utils/billing.py`: line `>=85`, branch `>=70`.
- Thresholds are configurable in CI via:
  - `BILLING_COVERAGE_MIN_ROUTERS_LINE`
  - `BILLING_COVERAGE_MIN_ROUTERS_BRANCH`
  - `BILLING_COVERAGE_MIN_UTILS_LINE`
  - `BILLING_COVERAGE_MIN_UTILS_BRANCH`
- Do not replace this with project-wide aggregate coverage as a release gate; keep module-scoped gates tied to payment correctness surfaces.

## Verification Snapshot (2026-02-13)

- `pr-fast` local confidence run: `local-pr-fast-sync-check` -> `overall_status=pass`, `3/3` suites passed.
- `merge-medium` local confidence run: `local-merge-medium-gate-check-2` -> `overall_status=pass`, `4/4` suites passed.
- `merge-medium` repeat run: `local-merge-medium-gate-check-3` -> `overall_status=pass`, `4/4` suites passed.
- `merge-medium` hard-gate run: `local-merge-medium-hard-gate-85` -> `overall_status=pass`, `4/4` suites passed.
- `release-heavy` hard-gate run: `local-release-heavy-hard-gate-85` -> `overall_status=pass`, `5/5` suites passed.
- Hard-gate coverage evidence (`local-merge-medium-hard-gate-85`):
  - `open_webui/routers/billing.py`: line `90.67%`, branch `75.26%`
  - `open_webui/utils/billing.py`: line `86.43%`, branch `78.05%`
- Artifact integrity check:
  - `summary.json` for latest merge-medium run reports `missing_count=0` in `artifact_index`.
  - Coverage JSON for gated suite is present under `artifacts/billing-confidence/<run-id>/coverage/backend_billing_coverage.json`.

## Canary Plan (Post-Release)

- Trigger `.github/workflows/billing-canary.yml` on schedule and manually after deployment.
- Canary runs synthetic probe in staging-safe mode (sandbox guard + amount cap).
- Required artifact bundle:
  - `billing-canary-report.json`
  - `billing-canary-report.md`
  - Workflow logs and runner metadata
- Expected pass criteria:
  - `overall_status=pass`
  - no failed safety checks
  - health check pass (if enabled for target environment)

## Rollback Triggers

- Any canary run reports `overall_status=fail`.
- Payment top-up success rate drops below agreed baseline for two consecutive windows.
- Webhook processing backlog or failure ratio exceeds alert threshold.
- Repeated user-facing billing blocks for solvent wallets.
- Incident classified as Sev-1/Sev-2 with billing impact.

## Incident Response Owners

- Release owner:
  - Declares go/no-go and initiates rollback.
- Billing backend owner:
  - Triages payment/webhook regressions and ships hotfix.
- Frontend owner:
  - Handles wallet UI regressions and client-side recovery flows.
- SRE/ops owner:
  - Executes deployment rollback and verifies service health.
- Incident commander:
  - Coordinates communication, timeline, and postmortem actions.

## Rollback Procedure (Minimal)

1. Freeze deploy pipeline and announce incident channel.
2. Revert to last known-good release image/tag.
3. Re-run canary workflow and synthetic staging probe.
4. Confirm billing critical suite on rollback candidate.
5. Resume traffic only after all checks are green and incident commander approves.

## Evidence Retention

- Store billing confidence artifacts under `artifacts/billing-confidence/`.
- Store canary artifacts under `artifacts/billing-canary/`.
- Keep at least the latest 10 successful and 10 failed runs for comparison.
