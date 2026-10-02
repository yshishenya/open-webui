# Show profile names in payment Customer column

## Meta
- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-customer-names
- SDD Spec: meta/sdd/specs/completed/billing-customer-names-2026-10-02-2205.json
- Created: 2026-10-02
- Updated: 2026-10-02

## Context and acceptance criteria
Payments at `/admin/billing/transactions` display a UUID in Customer. Show the
current profile display name (including surname when present), retaining the
customer link by user ID. Use the ID only when the name is blank or the profile
has been deleted. Retain payment rows, filters, deduplication, and pagination.

## Implementation
Reuse the asynchronous reporting service and join User.name in both payment
stores. Expose nullable `name` in the shared payment payload and TypeScript type.
No dependencies, migrations, profile editing, or payment-state changes.

## Upstream impact
Only Airis reporting files change; the page receives a one-expression change.
No upstream-owned file is modified.

## Verification
Regression checks: real async SQLite query and API payload for both stores,
deleted users, and a mounted payment table with name/ID fallback and navigation.
Run existing reporting tests, frontend tests, lint and type checks via Docker
Compose. Commit and open PR to `airis_b2c`; production rollout is separate.

## Risks / rollback
Low: read-only additive response field. Outer joins preserve historical rows.
Revert the isolated commit to roll back.

## Verification results
- Before fix: both store cases failed with missing name; mounted UI showed ID.
- After fix: reporting pytest 7/7, full frontend Vitest 46 files / 198 tests.
- Changed-file ESLint, backend ruff, diff whitespace checks passed.
- Full typecheck has 4668 errors / 215 warnings in 284 files; the same
  diagnostics are present on the base commit, with zero added or removed.
- SDD validation: zero errors; generated ID format has an advisory warning.
- Automated DOM interaction verified customer-name display and navigation.
- Production browser acceptance and deployment are pending a separate rollout.
