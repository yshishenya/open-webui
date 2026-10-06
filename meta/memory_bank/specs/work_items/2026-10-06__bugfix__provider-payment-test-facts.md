# Preserve authoritative provider test facts

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/provider-payment-test-facts`
- SDD Spec: `meta/sdd/specs/completed/airis-provider-test-facts-2026-10-06-001.json`
- Created: 2026-10-06
- Updated: 2026-10-06

## Context

YooKassa supplies a boolean `test`, but topup creation and verified webhook/reconcile sanitizers discard it. Financial reports already exclude explicitly marked tests; onboarding and event recovery must use the same distinction. Callback data cannot supply provider proof. This issue does not establish the origin of any historical provider lookup failure.

## Goal / Acceptance Criteria

- [x] Preserve exact provider boolean true/false on manual/automatic topup creation, verified webhook, reconciliation and replay of a previously credited row.
- [x] Missing/invalid provider flags remain unknown; a forged callback cannot supply or override the flag.
- [x] Preserve test facts for legacy subscription transactions without losing existing metadata.
- [x] Explicitly test topups produce zero real-payment counts, attempt counts, purchase/refund analytics events or first-real-payment markers. False and historical unknown retain the documented legacy policy.
- [x] Wallet credit stays exactly once under repeat webhook/reconciliation; no change to balances, fiscal receipt generation or service notification contracts.
- [x] Failing reproduction followed by passing isolated SQLite/PostgreSQL regression and applicable format/security/SDD checks.

## Scope / Implementation Notes

Reuse the existing JSON fields and canonical payment facts; no migration, dependency, new service, provider write or historical classification by guess. Apply the provider flag at the trusted boundary, then one shared SQL condition for real metrics. Legacy subscription facts use a separately named verified field in existing transaction metadata. Service emails continue to describe actual wallet credit; the business cohort excludes explicit test payments.

## Upstream impact

`backend/open_webui/utils/billing.py` is the existing shared billing service. Its minimal hooks preserve a trusted provider flag and refresh that flag on duplicate verified reads; other changes belong to Airis report/analytics modules and tests. No public response shape changes.

## Verification

Isolated Docker Compose using the current production base image, read-only source mount, temporary database and no real provider/SMTP connection. Regression covers trust-boundary inputs, exactly-once credit, canonical report exclusion and first-real-payment classification. Source/CI/integration and guarded production acceptance are recorded separately.

## Risks / Rollback

Historical missing flags remain unknown and are not relabeled. Existing analytics facts/markers are not deleted by this change; reports already filter known tests. Roll back the immutable image through existing backup/CAS/Alembic gates. Production release requires current-base comparison, preserving compiled public configuration and unrelated services.

## Completion Checklist

- [x] SDD check-complete and complete-spec accepted.
- [x] Branch update records verified source and limits.
- [ ] PR acceptance against `airis_b2c` and production acceptance are tracked separately from completed implementation.

## Verified implementation

Corrected pre-fix reproduction: 7 failures and 11 passes; the first harness attempt also contained an invalid fixture method and is not accepted evidence. Final Docker Compose: PostgreSQL 127 passed, zero skips/failures; SQLite 126 passed with one PostgreSQL-only case separately covered. Warnings: 14 PostgreSQL / 17 SQLite, existing imports/dependencies. Explicit tests cannot emit payment-created/purchase/refund events or claim the first real payment; a marker previously attached to a now verified test can be refreshed to the first real ledger-backed credit. Verified refund facts remain persisted. Missing/invalid responses cannot erase a previously known boolean. Subscription metadata/idempotency keys and wallet exactly-once credit are preserved.

Black with existing string style, changed-file Ruff and diff checks passed. Earlier PostgreSQL harness attempts used the wrong async driver and then an already populated disposable reporting DB; final proof uses existing psycopg3, fresh reporting DB and an internal isolated network with no host ports. Runtime dependencies, schema and frontend are unchanged. Full-goal criteria, real provider exception, Inbox delivery and mature cohort remain separate.
