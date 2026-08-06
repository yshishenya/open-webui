# Admin billing financial visibility

- Date: 2026-08-06
- Branch: `codex/bugfix/billing-integrity-hardening`
- Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__admin-billing-financial-visibility.md`
- SDD: `meta/sdd/specs/completed/admin-billing-financial-visibility-2026-08-06-001.json`

## Status

- Completed: async admin-only reporting service and router for overview, customers, Customer 360, payments, ledger, usage, and bounded CSV export.
- Completed: Billing navigation hub, Overview, Customers, Customer 360, and Transactions screens.
- Completed: separate paid/included balance semantics, processed-time fallback labeling, provider payload redaction, CSV formula escaping, pagination bounds, and read-only reconciliation warnings.
- Completed: targeted reporting helper tests (3 passed), targeted ESLint, Ruff, Ruff format, Python compile/import checks.
- Pending follow-up: full Docker billing confidence suite, live endpoint integration fixtures, durable provider `paid_at`/refund/chargeback facts, and reconciliation job.

## Risks

- Current reporting uses `processed_at` fallback because provider `paid_at` is not yet persisted.
- Legacy subscription transactions and wallet payments are normalized at read time; high-volume deployments should add measured rollups later.
- Existing repository-wide frontend check has unrelated baseline errors; new reporting files have no targeted check errors.
