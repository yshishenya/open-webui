- [ ] **[BUG][BILLING][SECURITY]** Harden billing integrity and payment accounting
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-integrity-hardening.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-integrity-hardening`
  - Started: 2026-08-06
  - Summary: Close replay/free-usage, lost top-up, stale hold, concurrency, expiry, accounting, subscription, and test-confidence defects found in the billing review.
  - Tests: 225 backend billing tests and 8 frontend balance tests pass; Black, Ruff `F/E9`, `py_compile`, `git diff --check`, and SQLite upgrade/downgrade/upgrade pass. Docker/E2E remains blocked by unavailable packages in the Docker network (`aiosmtplib`, `uv`).
  - Risks: Critical financial path; changes require migration and concurrency-focused verification.

## Release review update — 2026-08-06

- Completed: reviewed wallet-scoped idempotency, server-owned operation IDs, hold expiry/release, quota reservations, webhook validation, subscription entitlement activation, and read-only reporting/export paths.
- Completed: added wallet-owner validation for usage events, replay validation for hold idempotency, processed-time date filtering, global ledger/usage exports, and export status filters.
- Verified: 26 isolated backend billing files (225 tests), frontend balance Vitest (8 tests), Black, Ruff `F/E9`, `py_compile`, `git diff --check`, and migration round-trip to head `b4c5d6e7f8a9`.
- Pending: CI must run the complete backend/concurrency suite with repository dependencies available; production rollout follows successful PR checks.
