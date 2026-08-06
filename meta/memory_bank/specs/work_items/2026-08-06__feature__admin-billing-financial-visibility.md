# Admin billing financial visibility

## Meta

- Type: feature
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/billing-integrity-hardening`
- SDD Spec: `meta/sdd/specs/completed/admin-billing-financial-visibi-2026-08-06-1623.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Goal

Give administrators a trustworthy, searchable financial view of every customer: successful and failed payments, payment time, paid and bonus balances, usage spend, wallet ledger, and reconciliation warnings.

## User stories

1. As an admin, I can see a financial overview for a date range with explicit metric definitions and currency separation.
2. As an admin, I can search and sort customers by paid amount, spend, balance, and latest payment.
3. As an admin, I can open a Customer 360 page with linked payments, ledger entries, usage events, and audit information.
4. As an admin, I can inspect and export all filtered payment, ledger, and usage rows without exposing secrets.

## Acceptance criteria

- [x] All endpoints require the existing admin authorization dependency.
- [x] Amounts are returned in integer kopeks and are never summed across currencies.
- [x] Paid balance and included/bonus balance are always separate.
- [x] Usage spend is aggregated from `billing_usage_event.cost_charged_kopeks`, never from charge ledger `amount_kopeks`.
- [x] Payment time is labeled `processed_at` until provider `paid_at` is available; the API exposes `as_of` and metric definitions.
- [x] Failed, pending, canceled, and successful payments remain distinguishable.
- [x] Pagination, filtering, stable sorting, CSV escaping, and bounded limits are server-side.
- [x] Raw provider payloads and payment method identifiers are excluded from reporting responses and exports.
- [x] UI supports keyboard navigation, visible focus, non-color status, responsive tables, and empty/error/loading states.
- [x] Reconciliation warnings identify payment/ledger/usage inconsistencies without mutating financial data.

## Scope

- Add a fork-owned reporting read service and admin router.
- Add additive admin Billing Overview, Customers, Customer 360, and Transactions screens.
- Add API/client types and targeted backend/frontend tests.
- Keep existing plan, pricing, and lead-magnet routes intact; only add a thin Billing hub navigation link.

## Non-goals

- Provider settlement fees, true net cash, refunds/chargebacks, or revenue recognition until durable provider facts exist.
- Replacing the existing wallet/payment models in this increment.
- Adding a reporting warehouse or runtime dependency.

## Security and privacy

- Admin-only access in this increment; future role split is a separate task.
- No raw YooKassa payloads, payment method IDs, or secrets in UI/API exports.
- CSV cells are escaped against spreadsheet formula injection.
- Financial history is read-only; corrections continue through the guarded wallet adjustment flow.

## Upstream impact

- Additive files under `backend/open_webui/utils/airis/` and `src/lib/apis/admin/`.
- New routes under `src/routes/(app)/admin/billing/`.
- One minimal navigation change in `src/routes/(app)/admin/+layout.svelte`.

## Verification

- Targeted backend reporting tests with SQLite fixtures.
- Frontend tests for filters, loading/error/empty states, and amount/balance labels.
- Ruff/Black, frontend check/lint, and `git diff --check`.
- Manual admin authorization and CSV export checks.

## Risks / rollback

- Risk: current payment tables lack provider `paid_at`, refund, and chargeback facts. The UI must label processed time and omit net-cash claims.
- Risk: global aggregates may become slow at high event volume. Begin with indexed SQL and add rollups only after measured evidence.
- Rollback: remove additive reporting router/pages and leave existing billing flows untouched.
