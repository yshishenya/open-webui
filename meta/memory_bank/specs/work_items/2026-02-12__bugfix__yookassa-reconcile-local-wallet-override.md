# YooKassa reconcile: enforce local wallet context for owned payments

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-reconcile-wallet-override
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-12
- Updated: 2026-02-12

## Context

PR review found a reconciliation edge case: when local payment ownership is confirmed, provider payload may still contain stale/conflicting `wallet_id` (and partial metadata), which can route topup credit to the wrong wallet.

## Goal / Acceptance Criteria

- [x] For locally owned payments, reconcile always uses local payment context (`kind`, `user_id`, `wallet_id`, `amount_kopeks`).
- [x] Add regression test proving conflicting provider wallet metadata is ignored.
- [x] Keep existing ownership rejection behavior for unverified/foreign payments.

## Non-goals

- Changing webhook signature/security flow.
- Introducing schema changes or migrations.

## Scope (what changes)

- Backend:
  - `reconcile_topup_payment` now overrides provider metadata context with local payment fields for owned payments.
  - Added regression test for conflicting provider `wallet_id`.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
- API changes:
  - None.
- Edge cases:
  - Provider `metadata.user_id` missing + conflicting `metadata.wallet_id` now safely credits local wallet.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
- Why unavoidable:
  - Reconcile logic and regression coverage live in these files.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal targeted diff: local-context override and one focused regression test.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e DATABASE_URL= -e WEBUI_SECRET_KEY=test-secret airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"` -> `24 passed`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/utils/billing.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"` -> `All checks passed!`

## Risks / Rollback

- Risks:
  - Low: reconcile now prefers local DB context for owned payments.
- Rollback plan:
  - Revert this commit to restore previous merge behavior.
