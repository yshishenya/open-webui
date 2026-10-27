# Associate receipt-contact errors with their fields

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/billing-contact-errors-20261027
- SDD Spec: N/A — small existing-pattern accessibility correction; no new subsystem or contract.
- Created: 2026-10-27
- Updated: 2026-10-27

## Context

Original billing-experience audit U21 requires field-associated contact errors. Invalid email/phone currently prevents the API request but only displays a general error, without identifying or focusing the invalid input. Parent audit: `2026-10-21__docs__billing-experience-audit.md`. Production baseline: `b2e4a1eb0b63f1d5c973389f88542b9ef0ba9720`.

## Goal / Acceptance Criteria

- [ ] Invalid email/phone sends no request, identifies only the invalid field with `aria-invalid` and `aria-describedby`, and focuses it.
- [ ] Editing a field clears its stale validation error; correcting it allows the existing save action.
- [ ] Network failure preserves the draft, does not mark valid fields invalid, and allows retry.
- [ ] A successful response remembers only the sent values; newer edits remain unsaved and visible.
- [ ] Focused regression, frontend checks, independent review, PR/CI and guarded release are recorded separately.

## Scope / Non-goals

Reuse WalletSpendControls' error/focus pattern in WalletContactsSection and its sole balance-page caller. No API, validation-rule, money, receipt-delivery, dependency, migration or theme changes. No real contacts saved for production acceptance. Research with 5 users and 5 admins remains a separate post-release stage; VoiceOver is excluded, not passed.

## Upstream impact

Only fork-owned billing component, route and existing tests; no upstream-owned file changes.

## Verification

Add failing tests first in `billing-balance.test.ts`; run them in the existing disposable Docker/frontend workflow, then frontend suite/typecheck/lint/build and normal exact-SHA CI. No backend changes; applicable billing regression is covered by established CI gates.

## Risks / Rollback

Low: presentation of existing client validation only. General load/network errors stay separate. Roll back the scoped commit through the normal release path; no data restore needed.
