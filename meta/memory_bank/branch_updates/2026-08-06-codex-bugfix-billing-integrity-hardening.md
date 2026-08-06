- [ ] **[BUG][BILLING][SECURITY]** Harden billing integrity and payment accounting
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-integrity-hardening.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-integrity-hardening`
  - Started: 2026-08-06
  - Summary: Close replay/free-usage, lost top-up, stale hold, concurrency, expiry, accounting, subscription, and test-confidence defects found in the billing review.
  - Tests: Targeted reporting tests pass; migration head and router import pass; full confidence suite is blocked by unavailable PyPI packages in the Docker network (`aiosmtplib`, `uv`) and E2E image build.
  - Risks: Critical financial path; changes require migration and concurrency-focused verification.

## Release review update — 2026-08-06

- Completed: reviewed wallet-scoped idempotency, server-owned operation IDs, hold expiry/release, quota reservations, webhook validation, subscription entitlement activation, and read-only reporting/export paths.
- Completed: added wallet-owner validation for usage events, replay validation for hold idempotency, processed-time date filtering, global ledger/usage exports, and export status filters.
- Verified: `pytest -q open_webui/test/apps/webui/utils/test_billing_reporting.py` (3 passed), targeted frontend ESLint, Python compile/import, migration head, and `git diff --check`.
- Pending: CI must run the complete backend/concurrency suite with repository dependencies available; production rollout follows successful PR checks.
