# Billing balance page rebuild (clarity-first wallet UX)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: codex/feature/billing-balance-page-rebuild
- Created: 2026-02-06
- Updated: 2026-02-06

## Context

User feedback: `/billing/balance` is still hard to understand. The page mixes several concepts (wallet money, free limits, advanced spend controls, history) and the current hierarchy can mislead users (e.g. low-wallet messaging even when free limits exist).

Related work:

- Audit backlog: `.memory_bank/specs/work_items/2026-02-05__docs__billing-balance-ux-audit.md`
- Wallet UX v2 spec: `.memory_bank/specs/work_items/2026-02-05__feature__billing-wallet-ux-v2.md`

## Goal / Acceptance Criteria

- [x] Make the mental model explicit: wallet balance vs free limit (lead magnet) are different and used differently.
- [x] Remove misleading “top up to keep working” messaging when free usage is still available.
- [x] Make top-up flow predictable: select amount (preset or custom) → one explicit CTA to proceed to payment (no accidental redirects), with trust context (YooKassa redirect, no card storage).
- [x] Improve findability of “other functions” without increasing visual noise:
  - History is easy to find (tab + in-page link)
  - Limits / auto-topup / receipt contacts are clearly discoverable (accordion copy + focus hints)
- [x] Keep the page compact: reduce vertical scanning on desktop.

## Non-goals

- Changing billing business rules (wallet vs lead magnet precedence, quotas).
- Backend API changes.
- Adding new dependencies.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Wallet page layout + copy + free-limit presentation tweaks.
  - Small i18n wording improvements for billing-related strings.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `src/lib/components/billing/WalletLeadMagnetSection.svelte`
  - `src/lib/components/billing/WalletHowItWorksModal.svelte`
  - i18n: `src/lib/i18n/locales/*/translation.json`
- Edge cases to handle:
  - Wallet is 0, but free limit exists and has remaining quota.
  - Lead magnet enabled, but no free models are available (avoid confusing “free limits”).
  - Return-to-chat (`return_to`) present: keep recovery CTA discoverable but not duplicated.

## Upstream impact

- Upstream-owned files touched (expected):
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `src/lib/components/billing/WalletLeadMagnetSection.svelte`
  - `src/lib/components/billing/WalletHowItWorksModal.svelte`
- Why unavoidable:
  - This is a user-facing page rebuild; these are the primary entrypoints.
- Minimization strategy:
  - Keep changes localized to billing UI.
  - Prefer additive logic (small helpers / minimal re-layout) and avoid unrelated formatting churn.

## Verification

- Frontend tests (targeted): `npm run docker:test:frontend -- --run src/routes/\\(app\\)/billing/balance/billing-balance.test.ts`
- E2E (subset): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml up -d --build airis-e2e` then `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- e2e/billing_wallet.spec.ts e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[UI][BILLING]** Wallet (/billing/balance) rebuild: clarity-first layout + copy
  - Spec: `.memory_bank/specs/work_items/2026-02-06__feature__billing-balance-page-rebuild.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-page-rebuild`
  - Started: 2026-02-06
  - Summary: Make wallet vs free limits explicit, remove misleading low-balance messaging, and reduce desktop scrolling.
  - Tests: TBD
  - Risks: Low-Medium (copy/layout touches; ensure no regressions in top-up flow)

## Risks / Rollback

- Risks:
  - Copy tweaks may require i18n review for RU/EN consistency.
  - Layout changes can break responsive behavior if not tested at common breakpoints.
- Rollback plan:
  - Revert the wallet page + billing components touched in this work item.
