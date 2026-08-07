# Billing top-up recovery clarity

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/fix-wallet-topup-clarity`
- Created: 2026-08-07
- Updated: 2026-08-07
- SDD Spec: `meta/sdd/specs/completed/billing-topup-recovery-clarity-2026-08-07-001.json`

## Context

The wallet is functional, but the payment path is easy to miss: package choices look like small secondary pills, the payment CTA is disabled until selection, and the insufficient-funds dialog does not show the shortfall or what happens next. The user should understand the problem and reach a safe payment choice in one clear step without automatic charging or repeated prompts. A pricing-config outage must not expose a custom amount that the server will reject.

## Goal / acceptance criteria

- When a paid model is blocked, the dialog states that funds are insufficient, shows available/required/shortfall amounts, and gives one clear wallet CTA.
- The wallet CTA preserves the originating chat and passes the required amount so the smallest configured package covering the request is selected automatically.
- The wallet page uses explicit “Пополнить баланс” copy, accessible package hit targets, and a clear payment action after selection.
- A low-balance wallet preselects the first configured package while keeping free usage visible as a separate alternative; users still confirm payment explicitly.
- A pricing-config failure keeps the UI on server-supported preset packages and hides unsupported custom input.
- Returning from payment remains the existing user-controlled path; no automatic purchase or automatic message retry is introduced.
- Daily-cap and max-reply-cost blocks retain their existing settings route and copy.

## Scope

- `src/lib/components/airis/BillingBlockedModal.svelte`
- `src/lib/components/airis/HeaderBillingAccess.svelte`
- `src/lib/components/billing/WalletTopupSection.svelte`
- `src/routes/(app)/billing/balance/+page.svelte`
- Focused frontend tests and RU/EN copy keys.

## Non-goals

- No payment provider, wallet, quota, or database changes.
- No auto-top-up enablement or silent payment.
- No automatic regeneration of a blocked chat request after payment.

## Verification

- Focused Vitest coverage for contextual package selection, low-balance default selection, pricing fallback, and billing CTA links.
- Full frontend Vitest regression.
- In-app browser: zero-balance paid-model request opens the modal; wallet CTA opens the wallet with the originating chat preserved and a recommended package selected; console has no errors.

## Current verification status

- Completed: focused billing/modal tests (14 tests) and full frontend regression (30 files, 116 tests).
- Completed: targeted ESLint, Vite build with an 8 GB Node heap, and `git diff --check`.
- Completed: `git-1a3e852` deployed with guarded backup, migration gate, health gate, and rollback image retained; production `/health` returned `{"status":true}`.
- Completed: authenticated in-app browser verified the low-balance wallet preselects 500 ₽ and enables `Оплатить 500 ₽`; a paid Qwen 3.7 Plus request at 0 ₽ opens the insufficient-funds modal, preserves safe `return_to`, and selects the contextual package. Production console errors: none.

## Upstream impact

- UI-only changes in existing billing/chat surfaces; no new dependency and no backend contract changes.
