# Billing integrity hardening

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/billing-integrity-hardening`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/billing-integrity-hardening-2026-08-06-001.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

A full billing review found a client-controlled financial idempotency key, swallowed top-up credit failures, unreleased holds, concurrent auto-topup and quota races, inactive expiry fields, non-atomic accounting, and unsafe dormant subscription activation. The defects can cause free paid usage, missed or duplicate charges, locked balances, and incomplete audit history.

## Goal / Acceptance Criteria

- [ ] Every provider invocation uses a server-owned billing operation id; client correlation ids cannot suppress a charge or quota consumption.
- [ ] Ledger and usage idempotency is scoped to the owning wallet and rejects mismatched replays.
- [ ] Top-up credit failures return a retryable webhook response; amount/currency must match the local payment.
- [ ] Stream cancellation, settlement failure, and expired holds do not leave funds permanently reserved.
- [ ] Daily caps, lead-magnet quotas, and auto-topup are safe under concurrent requests.
- [ ] Top-up/included credit expiry is enforced and reflected in wallet balances.
- [ ] Wallet settlement and user-visible usage accounting cannot diverge silently.
- [ ] Expired subscriptions do not affect PAYG; subscription payment activates the purchased plan and grants included credit idempotently before success is final.
- [ ] Top-up return UI trusts reconciliation status for the exact payment.
- [ ] Billing API tests run on the current async Users API and all new regressions pass.

## Non-goals

- Enabling subscription sales in production.
- Replacing YooKassa or changing public pricing.
- Adding dependencies or redesigning the billing UI.

## Scope (what changes)

- Backend:
  - Wallet/ledger idempotency, expiry, reservations, and settlement.
  - Billing preflight, usage/quota settlement, webhooks, auto-topup, and subscriptions.
  - Async-compatible billing test utilities and focused regressions.
- Frontend:
  - Exact-payment top-up reconciliation success handling.
- Config/Env:
  - No new dependency; existing TTL and feature flags keep their contracts.
- Data model / migrations:
  - Wallet-scoped unique constraints and any minimal reservation/expiry data required by the final design.

## Implementation Notes

- Financial operation ids are generated server-side per invocation. Client `request_id` remains correlation metadata only.
- Prefer existing row locks and database constraints over process-local locks.
- Payment webhook failures that can succeed on retry must propagate as `WebhookRetryableError`.
- Expiry and reservation changes must be idempotent and safe on PostgreSQL and SQLite tests.
- Subscription code remains behind `ENABLE_BILLING_SUBSCRIPTIONS=false`, but its state transitions must be correct before enablement.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/openai.py`
  - `backend/open_webui/utils/chat.py`
  - `src/routes/(app)/billing/balance/+page.svelte`
- Why unavoidable:
  - These are the existing provider and payment-return entrypoints where correlation data enters or UI state is decided.
- Minimization strategy:
  - Keep entrypoint changes as thin hooks; put accounting rules in existing Airis billing/wallet services and add focused tests/migration files.

## Verification

- Targeted backend wallet/billing tests.
- Billing router critical suite.
- Frontend billing balance Vitest suite.
- Billing confidence `pr-fast`, then `merge-medium` if the environment supports it.
- Migration upgrade/downgrade/upgrade against a temporary database.
- Ruff, Black check, frontend lint/typecheck, `git diff --check`.
- Manual replay, webhook failure, and stream cancellation reproductions.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][BILLING][SECURITY]** Harden billing integrity and payment accounting
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__billing-integrity-hardening.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-integrity-hardening`
  - Started: 2026-08-06
  - Summary: Close replay/free-usage, lost top-up, stale hold, concurrency, expiry, accounting, subscription, and test-confidence defects found in the billing review.
  - Tests: In progress.
  - Risks: Critical financial path; changes require migration and concurrency-focused verification.

## Risks / Rollback

- Risks:
  - Incorrect reservation or expiry logic could overcharge or block solvent wallets.
  - Constraint migration must preserve existing ledger and usage rows.
- Rollback plan:
  - Revert runtime changes and downgrade the additive constraint/reservation migration before redeploying the prior image.

## Completion Checklist

- [ ] `meta/tools/sdd check-complete billing-integrity-hardening-2026-08-06-001 --json`
- [ ] `meta/tools/sdd complete-spec billing-integrity-hardening-2026-08-06-001 --json`
- [ ] Branch update entry moved to Done with tests and residual risks.
