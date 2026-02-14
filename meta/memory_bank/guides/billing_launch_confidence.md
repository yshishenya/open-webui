# Billing Launch Confidence Baseline

## Purpose

This document is the Phase 1 baseline map for billing release confidence.
It records the current status of billing-related suites using concrete Docker-first commands,
and defines which suites are release-blocking (P0) versus hardening (P1).

## Baseline Snapshot

- Snapshot date: 2026-02-12
- Source of truth spec: `meta/sdd/specs/completed/billing-launch-confidence-program-2026-02-11-001.json`
- Confidence objective: align real payment behavior with automated checks before user launch.

Status legend:
- `PASS`: last known green and accepted for current baseline
- `FAIL`: known failing scenario requiring fix before release
- `PARTIAL`: command/suite exists but is not yet a reliable release gate
- `PENDING`: planned command not yet executed for this baseline snapshot

## Command Matrix (Current State)

| Tier | Priority | Suite | Command | Current status | Notes |
| --- | --- | --- | --- | --- | --- |
| `pr-fast` | P0 | Backend billing critical | `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py"` | PASS | Last known from recent billing-focused runs; keep as release-blocking backend gate. |
| `pr-fast` | P0 | Frontend billing balance unit/integration | `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/routes/\\(app\\)/billing/balance/billing-balance.test.ts"` | PARTIAL | Coverage exists, but assertions need stabilization for low-balance branch variants. |
| `pr-fast` | P0 | Billing wallet recovery E2E | `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- e2e/billing_wallet.spec.ts e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts"` | FAIL | Known mismatch between expected and actual payment/recovery behavior. Must be fixed for launch confidence. |
| `merge-medium` | P0 | Billing coverage threshold | `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q pytest-cov && pytest -q --maxfail=1 --disable-warnings --cov=open_webui.routers.billing --cov=open_webui.utils.billing --cov-report=term-missing:skip-covered open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py"` | PARTIAL | Target threshold is defined (>=85%), enforcement and non-decreasing gate must be codified in CI. |
| `pre-release` | P0 | Baseline snapshot artifact generation | `bash scripts/ci/billing_baseline_snapshot.sh` | PENDING | Script is specified in Phase 1 and must emit deterministic JSON/markdown artifacts. |
| `pre-release` | P1 | Global frontend lint/type debt visibility | `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check && npm run lint:frontend"` | PARTIAL | Useful quality signal, but currently too broad to block launch due legacy debt. |

## P0 vs P1 Gate Policy

P0 (release-blocking):
- Backend billing critical suite must pass.
- Billing wallet/recovery E2E must pass.
- Billing balance behavior checks must be deterministic for both low-balance branches.
- Confidence runner/baseline artifacts must fail-fast on gate violations.

P1 (non-blocking for initial rollout):
- Broader debt-heavy lint/type gates and extra hardening suites.
- Additional synthetic probes beyond minimal canary flow.

## Numeric Launch Gates

### P0 release gate (must pass to launch)

- `100%` pass on critical backend billing suite.
- `100%` pass on billing wallet/recovery E2E pack.
- Both P0 suites must pass in `2` consecutive runs on the same candidate revision.
- `0` unresolved blocker defects in billing flow (top-up, webhook processing, wallet recovery path).

### P1 hardening gate (tracked, non-blocking for first rollout)

- Flake budget: `<=2%` across the latest `20` CI runs for billing-tagged suites.
- Coverage floor: `>=85%` line coverage for `open_webui.routers.billing` and `open_webui.utils.billing`.
- P1 regressions open follow-up tasks, but do not block initial release unless promoted to P0.

## Blocker Policy

- Blocker definition:
  - Any issue that can charge incorrectly, lose payment state, or prevent user recovery after top-up.
  - Any regression where automated P0 suite does not match observed manual payment behavior.
- Handling:
  - Blockers must be linked to owner + ETA and recorded before release decision.
  - Release is denied while blocker count is non-zero.

## Sign-Off Ownership and Checkpoints

- Product sign-off owner: Billing product owner (scope acceptance, launch go/no-go).
- Engineering sign-off owner: Backend lead (payment/webhook correctness and incident readiness).
- QA sign-off owner: Test lead (suite reliability, artifact completeness, blocker verification).
- Initial release decision checkpoint date: `2026-02-18`.
- Checkpoint inputs:
  - Latest baseline artifacts (JSON + markdown)
  - P0 run history (two consecutive passes)
  - Open blocker list with dispositions

## Immediate Gap Summary

1. Automated tests do not yet fully represent real payment behavior in recovery flow.
2. Frontend low-balance branch assertions need explicit split coverage and stable selectors.
3. CI gate layering exists conceptually but needs concrete enforcement and artifact-first diagnostics.

## Coverage Baseline (Task-1-1, 2026-02-12)

Command used:

`docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -e DATABASE_URL= airis bash -lc "python -m pip install -q pytest-cov && cd /app/backend && mkdir -p artifacts/billing-coverage-baseline && pytest -q --maxfail=1 --disable-warnings --cov=open_webui.routers.billing --cov=open_webui.utils.billing --cov-branch --cov-report=term-missing:skip-covered --cov-report=json:artifacts/billing-coverage-baseline/coverage-billing.json open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py open_webui/test/apps/webui/routers/test_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_images_billing.py open_webui/test/apps/webui/routers/test_openai_speech_billing.py open_webui/test/apps/webui/routers/test_audio_billing.py"`

Observed result:

- `79 passed`
- `open_webui/routers/billing.py`: line `40.67%`, branch `22.11%`
- `open_webui/utils/billing.py`: line `62.78%`, branch `51.22%`
- Coverage artifact: `backend/artifacts/billing-coverage-baseline/coverage-billing.json`

## Hotspot and Fault-Mode Map

Router hotspots (`open_webui/routers/billing.py`):

| Function | Missing lines | Fault mode if under-tested |
| --- | --- | --- |
| `get_public_rate_cards` | 97 | Wrong public pricing visibility or stale rate exposure |
| `yookassa_webhook` | 49 | Invalid trust/replay handling, incorrect top-up state transitions |
| `update_billing_settings` | 26 | Unsafe billing config updates and inconsistent limits |
| `check_quota` | 22 | False allow/deny decisions for paid requests |
| `get_my_usage` | 21 | Incorrect user usage totals and quota reporting |
| `update_auto_topup` | 19 | Broken auto-topup thresholds/caps causing unexpected charges |

Service hotspots (`open_webui/utils/billing.py`):

| Function | Missing lines | Fault mode if under-tested |
| --- | --- | --- |
| `process_payment_webhook` | 19 | Duplicate or missed wallet crediting during webhook processing |
| `check_quota` | 15 | Incorrect gating on wallet/lead-magnet boundaries |
| `_process_topup_webhook` | 13 | Replay/idempotency drift in top-up settlement |
| `create_payment` | 12 | Incorrect payment request envelope or provider error handling |
| `maybe_trigger_auto_topup` | 11 | Unintended auto-charges or missed low-balance recovery |

Prioritization rule for follow-up phases:

1. Cover webhook/idempotency/payment-creation branches first (direct financial correctness risk).
2. Cover quota/usage/reporting branches second (user-facing access and trust risk).
3. Cover public pricing and settings branches third (commercial transparency and operator safety).

## Next Actions

1. Add router tests for `yookassa_webhook`, `update_auto_topup`, and `check_quota` negative branches.
2. Add service/integration tests for `process_payment_webhook` and `_process_topup_webhook` replay/idempotency invariants.
3. Promote module-scoped line+branch thresholds into CI gate with deterministic artifact triage.

## Task-4 Result (CI Gate Wired, 2026-02-12)

- Added module-scoped coverage checker: `scripts/ci/check_billing_module_coverage.py`.
- Updated confidence runner: `scripts/ci/run_billing_confidence.sh`.
  - Coverage JSON is generated for `backend_billing_coverage`.
  - Gate enforces both line and branch thresholds.
  - Coverage artifacts are indexed in `summary.json` and copied into `latest/coverage/`.
  - Backend-container artifacts are normalized into canonical run directory for triage.
- Updated CI workflow: `.github/workflows/billing-confidence.yml`.
  - `merge-medium`/`release-heavy` now run with explicit coverage thresholds via env.

Current enforced thresholds:

- `open_webui/routers/billing.py`: line `>=85`, branch `>=65`
- `open_webui/utils/billing.py`: line `>=85`, branch `>=70`

## Task-5 Result (Stability Validation, 2026-02-12)

Repeatability evidence:

- `local-pr-fast-sync-check` -> `overall_status=pass` (`3/3` suites).
- `local-merge-medium-gate-check-2` -> `overall_status=pass` (`4/4` suites).
- `local-merge-medium-gate-check-3` -> `overall_status=pass` (`4/4` suites).

Artifact integrity:

- `artifact_index` for latest merge-medium run has `missing_count=0`.
- Coverage report exists at:
  - `artifacts/billing-confidence/local-merge-medium-gate-check-3/coverage/backend_billing_coverage.json`

## Task-6 Result (Hard Gate `>=85%` + Fault-Path Test Expansion, 2026-02-13)

- Expanded direct webhook router tests for security and fault-tolerance branches:
  - token validation + optional signature/timestamp validation (`YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE=true`)
  - replay acknowledgement
  - invalid JSON/payload mapping
  - verification/retryable/unexpected error mapping
- Promoted billing module gate to release-level defaults:
  - `open_webui/routers/billing.py`: line `>=85`, branch `>=65`
  - `open_webui/utils/billing.py`: line `>=85`, branch `>=70`
- Hardened E2E install step in confidence runner:
  - `npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000`
- Verification run:
  - `local-merge-medium-hard-gate-85` -> `overall_status=pass` (`4/4` suites)
  - `local-release-heavy-hard-gate-85` -> `overall_status=pass` (`5/5` suites)
  - Coverage:
    - `open_webui/routers/billing.py`: line `90.67%`, branch `75.26%`
    - `open_webui/utils/billing.py`: line `86.43%`, branch `78.05%`
