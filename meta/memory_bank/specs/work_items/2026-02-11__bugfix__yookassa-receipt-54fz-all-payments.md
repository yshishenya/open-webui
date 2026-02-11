# YooKassa receipt for all payment flows (54-FZ compliance)

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-receipt-54fz
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/yookassa-receipt-54fz-all-payments-2026-02-11-001.json`
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

Production top-up requests fail with `YooKassa error 400` and provider description `Receipt is missing or illegal`.
The backend currently creates YooKassa payments without the `receipt` object, so provider-side fiscal validation rejects payment creation.

## Goal / Acceptance Criteria

- [x] `receipt` is sent for all YooKassa payment creation flows used by Airis (`/billing/topup`, `/billing/payment`, auto-topup).
- [x] Receipt customer contact is resolved with stable fallback: billing contacts from user settings first, then account email.
- [x] If no contact is available, API returns a clear user-safe error explaining what to fill.
- [x] Fiscal fields are configurable via env vars and documented with clear comments.
- [x] Targeted backend tests verify receipt payload and prevent regression.

## Non-goals

- Reworking billing UI layout.
- Replacing YooKassa or changing top-up package rules.
- Implementing legal advice logic per business entity; we provide configurable technical hooks.

## Scope (what changes)

- Backend:
  - Extend YooKassa client request payload with optional `receipt`.
  - Build receipt in billing service for all payment flows.
  - Resolve receipt contacts from user profile/settings.
  - Add explicit validation error when no receipt contact exists.
- Frontend:
  - No UI redesign; existing contacts section remains source of billing contact data.
- Config/Env:
  - Add receipt/tax env vars and inline comments in `.env.example`.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/yookassa.py`
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/env.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
  - `.env.example`
  - `meta/docs/guides/billing_setup.md`
- API changes:
  - No new endpoints.
  - `/billing/topup` and `/billing/payment` may return `400` with explicit contact-required detail if receipt contact is missing.
- Edge cases:
  - User has no `billing_contact_email` and no `billing_contact_phone`.
  - User has no billing contact but has account email.
  - Auto-topup must also contain receipt and use the same contact resolution.

### Regulatory and provider references used for this task

- 54‑ФЗ, ст. 1.2: seller must issue KKT receipt at payment and send e-receipt to customer contact.
- 54‑ФЗ, ст. 4.7: receipt must contain mandatory requisites (including tax-related fields).
- YooKassa docs (payments + receipts): if receipts are enabled for the merchant, pass `receipt` in every payment request.
- YooKassa docs (parameter values): `vat_code`, `payment_mode`, `payment_subject`, `tax_system_code` must be set according to taxation model.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/yookassa.py`
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/env.py`
  - `.env.example`
- Why unavoidable:
  - Receipt payload is created in the core payment path and requires env wiring.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal additive helpers and optional payload fields; no endpoint contract changes.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/env.py backend/open_webui/utils/billing.py backend/open_webui/utils/yookassa.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Frontend tests: N/A (this fix is backend/config/docs)
- Frontend typecheck: N/A
- Frontend lint: N/A
- E2E (when relevant): N/A

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][BILLING][YOOKASSA][54-FZ]** Add mandatory receipt payload for all payment flows
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__bugfix__yookassa-receipt-54fz-all-payments.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-receipt-54fz`
  - Done: 2026-02-11
  - Summary: Fix provider rejection (`receipt missing or illegal`) by sending fiscal receipt in top-up/subscription/auto-topup flows with configurable tax fields.
  - Tests: `python -m py_compile backend/open_webui/env.py backend/open_webui/utils/billing.py backend/open_webui/utils/yookassa.py backend/open_webui/routers/billing.py`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/env.py backend/open_webui/utils/yookassa.py backend/open_webui/utils/billing.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"`
  - Risks: Medium (payment creation path + fiscal fields misconfiguration risk)

## Risks / Rollback

- Risks:
  - Incorrect tax settings (`vat_code`, `payment_subject`, etc.) can cause provider rejections.
- Rollback plan:
  - Revert targeted billing/yookassa/env/docs changes and temporarily disable receipt by env flag until corrected config is set.
