# YooKassa payment email identifier

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-payment-email
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

YooKassa payment metadata currently contains internal identifiers but not the account email, making it difficult to identify the payer in the YooKassa dashboard.

## Goal / Acceptance Criteria

- [x] Include the user's account email in metadata for subscription, manual top-up, and auto-top-up payments.
- [x] Preserve existing payment processing and receipt behavior.
- [x] Add regression coverage for top-up metadata.

## Non-goals

- No database migration or new dependency.
- No changes to webhook ownership resolution.

## Scope (what changes)

- Backend: add `user_email` to YooKassa metadata when the account email is available.
- Frontend: none.

## Implementation Notes

- Reuse the existing `Users` model and clean the email before sending it.
- Store the same metadata in local payment records for top-ups.

## Upstream impact

- Upstream-owned files touched: `backend/open_webui/utils/billing.py`.
- Why unavoidable: this is the shared payment creation path.
- Minimization strategy: one helper and metadata additions only.

## Verification

- Targeted backend pytest for billing service/top-up tests.

## Risks / Rollback

- Risk: account email is personal data exposed to the merchant payment dashboard; this is explicitly requested and is sent only in payment metadata.
- Rollback: remove `user_email` metadata additions and helper.

## Completion Checklist

- [x] Python compilation and `git diff --check` pass.
- [x] Branch update moved to Done.
