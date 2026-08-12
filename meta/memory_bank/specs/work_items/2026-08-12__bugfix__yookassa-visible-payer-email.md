# YooKassa visible payer email

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/yookassa-visible-payer-email
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-12
- Updated: 2026-08-12

## Context

Production YooKassa API responses contain `metadata.user_email`, but the YooKassa payment UI does not expose it as the payer field. The email must be visible in the provider payment description as well.

## Goal / Acceptance Criteria

- [x] Include the payer email in the YooKassa-visible payment description for subscription, manual top-up, and auto-top-up payments.
- [x] Preserve `metadata.user_email` and existing receipt data.
- [x] Add a regression test for the provider description.

## Non-goals

- No migration or dependency changes.
- No backfill of existing YooKassa payments.

## Scope (what changes)

- Backend: append a bounded `payer: <email>` suffix to the provider description.
- Frontend: none.

## Upstream impact

- Upstream-owned files touched: `backend/open_webui/utils/billing.py`.
- Why unavoidable: all YooKassa payment creation flows share this service.
- Minimization strategy: one bounded description helper and three call-site substitutions.

## Verification

- `python -m py_compile backend/open_webui/utils/billing.py backend/open_webui/test/apps/webui/utils/test_billing_service_core.py` passed.
- `git diff --check` passed.
- Targeted pytest is blocked during collection by the existing SQLite SQLAlchemy configuration (`pool_size`/`pool_timeout` with `NullPool`).
- Production YooKassa API verification of metadata passed before this follow-up.

## Risks / Rollback

- Risk: account email becomes visible in the YooKassa payment description and potentially to the payer; this is intentional for merchant identification.
- Rollback: remove the description suffix while keeping metadata if desired.

## Completion Checklist

- [x] Static checks pass; targeted pytest is blocked by the existing environment configuration noted above.
- [x] Branch update moved to Done.
