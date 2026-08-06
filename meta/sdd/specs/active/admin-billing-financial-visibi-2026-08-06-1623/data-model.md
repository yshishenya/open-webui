# Reporting read model

The first increment does not add a warehouse or duplicate financial facts. It creates a read-time normalized view:

```text
billing_payment ─┐
                 ├─ PaymentFact ── Overview / Customers / Transactions
billing_transaction ┘

billing_wallet ────── paid balance + included balance liability
billing_ledger_entry ─ immutable wallet movement and balance-after snapshot
billing_usage_event ─ actual charged usage by model/modality/provider
user ───────────────── customer identity and admin drill-down target
```

`PaymentFact` keeps `source`, local ID, provider ID, status, kind, amount, currency, processed-time fallback, wallet, and subscription references. A provider ID present in both stores is counted once.

No reporting query mutates a wallet, payment, ledger, usage, or subscription record.
