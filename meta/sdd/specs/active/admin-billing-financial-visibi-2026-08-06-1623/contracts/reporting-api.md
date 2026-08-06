# Billing reporting API contract

Base path: `/api/v1/admin/billing/reporting`.

Every endpoint requires the existing `get_admin_user` dependency. Amounts are integer kopeks. `currency` is required semantically even when it defaults to `RUB`; aggregates never combine currencies. Dates are Unix seconds and the API returns `as_of`.

## Endpoints

- `GET /overview?from=&to=&currency=` — KPI metrics, daily paid/usage series, and read-only reconciliation warnings.
- `GET /customers?...` — server-side search, sorting, and pagination.
- `GET /customers/{user_id}?from=&to=&currency=&limit=` — Customer 360 with wallet, payments, ledger and usage.
- `GET /payments?...` — normalized `billing_payment` + legacy `billing_transaction` facts with deduplication by provider ID.
- `GET /ledger?...` — paginated immutable wallet entries.
- `GET /usage?...` — paginated usage charges.
- `GET /export?dataset=payments|ledger|usage&...` — bounded CSV; ledger/usage exports require `user_id`.

## Semantics

- `successful_payments_kopeks` means successful top-ups and subscription payments before refunds.
- `paid_balance_kopeks` means current paid-wallet liability, not revenue.
- `included_balance_kopeks` means bonus/included funds, never cash paid.
- `usage_spend_kopeks` is the sum of `billing_usage_event.cost_charged_kopeks`.
- `processed_at_fallback` is returned until provider `paid_at` is persisted; UI must not label it as exact provider capture time.
- Raw provider payloads and payment method IDs never appear in reporting responses.
