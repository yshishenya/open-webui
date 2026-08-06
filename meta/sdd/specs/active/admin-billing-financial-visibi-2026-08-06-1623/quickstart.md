# Validation quickstart

1. Start the project with the repository Docker Compose development command.
2. Authenticate as an admin and open `/admin/billing`.
3. Verify the Overview labels paid balance and bonus balance separately and shows the `processed_at` fallback note.
4. Search `/admin/billing/customers`; open a row and confirm Customer 360 links payments, ledger, and usage without raw provider payloads.
5. Open `/admin/billing/transactions`, switch Payments / Wallet ledger / Usage charges, apply a user filter, and export CSV.
6. Confirm a CSV cell beginning with `=`, `+`, `-`, or `@` is prefixed with an apostrophe.
7. Repeat each API request with a non-admin token and expect HTTP 403.

Targeted checks:

```bash
pytest backend/open_webui/test/apps/webui/utils/test_billing_reporting.py
ruff check backend/open_webui/utils/airis/billing_reporting.py backend/open_webui/routers/admin_billing_reporting.py
npx eslint 'src/lib/apis/admin/billing_reporting.ts' 'src/routes/(app)/admin/billing/**/*.svelte'
```
