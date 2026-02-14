# Billing Webhook Signature Enforcement Policy + Async Safety Hardening

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/billing-confidence-ci`
- Created: 2026-02-14
- Updated: 2026-02-14

## Context

Billing webhook tests and manual verification previously diverged, reducing confidence in launch readiness.

Two correctness/confidence risks were identified:

1. **Webhook signature foot-gun**: signature checks were implicitly required when `YOOKASSA_WEBHOOK_SECRET` was configured, but the signature headers are explicitly documented as *custom/best-effort* in `open_webui/utils/yookassa.py` (not official YooKassa docs).
2. **Event-loop blocking**: multiple FastAPI `async def` endpoints and async billing service methods were executing sync DB calls directly, which can block the event loop under load.

## Goal / Acceptance Criteria

- [x] Signature enforcement is explicit and non-surprising:
  - default behavior does **not** require signature when a secret is configured
  - signature is required only when `YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE=true`
- [x] Billing router and billing service avoid blocking the event loop on sync DB calls:
  - synchronous endpoints are `def` (FastAPI threadpool)
  - async flows wrap sync DB calls with `run_in_threadpool`
- [x] Tests cover the new policy and remain high-signal (enforced signature path tested explicitly).
- [x] Billing confidence tiers pass end-to-end after the change.
- [x] Generated artifacts are ignored (no accidental commits).

## Scope (what changes)

- Backend runtime:
  - `backend/open_webui/routers/billing.py`:
    - convert non-async endpoints to sync `def`
    - wrap replay detection in threadpool (`_is_webhook_replay`)
    - introduce explicit signature enforcement gate (`YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE`)
  - `backend/open_webui/utils/billing.py`:
    - wrap sync DB operations in async methods via `run_in_threadpool`
  - `backend/open_webui/env.py`: add `YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE`
- Backend tests:
  - `backend/open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py`
- Ops/config:
  - `.env.example`: document `YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE`
  - `.gitignore`: ignore `artifacts/`, `backend/artifacts/`, and `meta/sdd/specs/.reviews/`
- Docs:
  - `meta/memory_bank/guides/billing_launch_confidence.md`: clarify signature validation is behind the enforcement flag.

## Upstream Impact

- Upstream-owned runtime files touched:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/env.py`
- Minimization strategy:
  - Mechanical signature policy change + threadpool wrappers only; no unrelated refactors.

## Verification

Targeted:

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "cd /app/backend && pytest -q open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py"`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "cd /app/backend && pytest -q open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py"`

Confidence runner (evidence artifacts under `artifacts/billing-confidence/<run-id>/`):

- `scripts/ci/run_billing_confidence.sh --tier pr-fast --run-id local-pr-fast-final-20260214T175350Z` (pass)
- `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-post-webhook-policy-20260214T174610Z` (pass; coverage)
- `scripts/ci/run_billing_confidence.sh --tier release-heavy --run-id local-release-heavy-post-webhook-policy-20260214T174742Z` (pass)

Coverage snapshot (`local-merge-medium-post-webhook-policy-20260214T174610Z`):

- `open_webui/routers/billing.py`: line `92.23%`, branch `78.95%`
- `open_webui/utils/billing.py`: line `90.97%`, branch `85.98%`

## Risks / Rollback

- Risks:
  - If an environment relied on the old implicit behavior (secret -> signature required), it must now set `YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE=true` to keep enforcing.
  - Threadpool usage introduces more scheduling overhead, but avoids event-loop stalls under DB load.
- Rollback:
  - Revert the signature enforcement policy and/or endpoint sync/async changes in the affected files; keep tests for replay/fault-paths.

