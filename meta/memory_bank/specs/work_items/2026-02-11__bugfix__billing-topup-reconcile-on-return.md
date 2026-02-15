# Billing topup reconcile on return

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-receipt-54fz-v2
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-11
- Updated: 2026-02-12

## Context

Users can complete payment in YooKassa but still see unchanged wallet balance when webhook delivery is delayed/missed. Existing flow relies only on webhook processing for crediting topup funds.

## Goal / Acceptance Criteria

- [x] Add a safe fallback to reconcile topup payment status from provider by `payment_id`.
- [x] Trigger reconciliation automatically on `/billing/balance` return flow before balance polling.
- [x] Keep wallet crediting idempotent and user-scoped.
- [x] Cover new API behavior with backend tests.

## Non-goals

- Reworking webhook security model.
- Adding new DB tables/migrations.
- Changing subscription payment reconciliation behavior.

## Scope (what changes)

- Backend:
  - Add `BillingService.reconcile_topup_payment(user_id, payment_id)`.
  - Add `POST /api/v1/billing/topup/reconcile` endpoint.
  - Map validation/access/config/provider errors to explicit HTTP statuses.
- Frontend:
  - Add `reconcileTopup()` API client helper.
  - Call reconcile during topup return manual refresh and polling loop.
- Config/Env:
  - No changes.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/routers/billing.py`
  - `src/lib/apis/billing/index.ts`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
- API changes:
  - New endpoint: `POST /api/v1/billing/topup/reconcile` with body `{ payment_id }`.
  - Response: `{ payment_id, provider_status, payment_status, credited }`.
- Edge cases:
  - Payment belongs to another user -> 403.
  - Owner cannot be verified (no local record + missing provider `metadata.user_id`) -> 403.
  - Provider metadata is partial but local payment belongs to user -> reconcile still applies credit.
  - Missing/empty `payment_id` -> 400.
  - YooKassa client not initialized -> 503.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/utils/billing.py`
  - `src/lib/apis/billing/index.ts`
  - `src/routes/(app)/billing/balance/+page.svelte`
- Why unavoidable:
  - Existing payment and return flow entrypoints are in these files.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Additive endpoint/service method and minimal call sites; no contract removals.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/routers/billing.py backend/open_webui/utils/billing.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Frontend lint (targeted): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/apis/billing/index.ts 'src/routes/(app)/billing/balance/+page.svelte'"`
- Frontend typecheck:
  - attempted, but fails due pre-existing repo-wide TS/Svelte errors unrelated to this change.

## Risks / Rollback

- Risks:
  - Extra provider status requests during return polling.
- Rollback plan:
  - Revert new endpoint + frontend reconcile calls; webhook-only flow remains.
