# Billing wallet UX v2 (return-to-chat + topup clarity)

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/billing-wallet-ux-v2
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

We want `/billing/balance` to be the primary PAYG wallet hub and the main recovery path when a user is blocked in chat due to billing limits.

Key constraints:

- Only PAYG wallet (no subscription UX needed for this flow).
- “Came from chat block” must allow returning to the exact chat route (`/c/<id>`).
- Use YooKassa capabilities safely (no card data stored in Airis; only provider saved payment method id).
- “Soft” monetization: clear value + frictionless payment, no dark patterns.

Related analysis:

- UX audit: `meta/memory_bank/specs/work_items/2026-02-05__docs__billing-balance-ux-audit.md`

## Goal / Acceptance Criteria

### Return-to-chat recovery

- [ ] When chat is blocked by billing (`insufficient_funds`, `daily_cap_exceeded`, `max_reply_cost_exceeded`), show a user-friendly modal with actionable CTAs.
- [ ] “Go to wallet” deep-links to `/billing/balance` with `return_to=/c/<chatId>` and a `focus` hint.
- [ ] Billing navigation preserves `return_to` so user can browse Wallet/History and still return.
- [ ] Wallet page shows “Back to chat” CTA when `return_to` is present and valid.

### Top-up clarity + convenience

- [ ] Wallet uses top-up amounts from `/billing/public/pricing-config` when configured; supports custom amounts only when backend allows it.
- [ ] Custom amount input validates and shows a formatted preview; RU-friendly decimals.
- [ ] Top-up initiation stores a short-lived “payment return” context and shows a post-return status banner (“checking / pending / success”) with manual refresh.
- [ ] Empty states (“Latest activity”) are helpful and contain next actions.

### Auto-topup UX (YooKassa-aware)

- [ ] Wallet balance response includes whether a saved payment method exists for auto-topup.
- [ ] Auto-topup UI explains requirement: enable auto-topup then make one top-up to save payment method; clarify we don’t store card data.
- [ ] Hide noisy “0 failures” UI; emphasize failure only when relevant.

### Limits UX

- [ ] Daily cap exceeded shows a clear explanation + where to change the limit (wallet advanced settings).
- [ ] Max reply cost exceeded shows current cap and how to adjust.
- [ ] Balance response exposes `daily_reset_at` so UI can explain when the daily cap resets.

## Non-goals

- Subscription flows.
- Export/invoices; history list is sufficient.
- New dependencies.

## Scope (what changes)

- Backend:
  - Add fields to balance response for `daily_reset_at` and auto-topup payment method presence.
  - Add richer structured `detail` for billing blocks (still safe/user-facing).
- Frontend:
  - Return-to-chat plumbing (`return_to`) across billing pages and chat error modal.
  - Wallet UX improvements (top-up packages/custom, payment return banner, “how it works” help, empty states).
  - A11y improvements (focus states, better form feedback) on billing controls.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Keep upstream diffs minimal; prefer additive helpers under `src/lib/utils/airis/` where reasonable.
- Validate `return_to` to prevent open redirects (only allow `/c/<id>` paths).
- Payment return UX uses short-lived client storage; backend doesn’t expose payment status endpoints.

## Upstream impact

- Upstream-owned files touched (expected):
  - `src/lib/components/chat/Chat.svelte` (billing block UX)
  - billing route components under `src/routes/(app)/billing/`
- Why unavoidable:
  - Needs first-class recovery path in the primary chat experience and billing layout.
- Minimization strategy:
  - Keep changes small and isolated; use helper utilities/components.

## Verification

- Backend tests: `npm run docker:test:backend` (or targeted pytest subset)
- Frontend tests: `npm run docker:test:frontend`
- Frontend typecheck: `npm run docker:check:frontend` (note: repository may have pre-existing failures; document if encountered)

## Task Entry (for branch_updates/current_tasks)

- [ ] **[UI][BILLING]** Wallet UX v2: return-to-chat + topup clarity
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__feature__billing-wallet-ux-v2.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-wallet-ux-v2`
  - Started: 2026-02-05
  - Summary: Improve `/billing/balance` UX and add first-class recovery from chat billing blocks with a safe return-to-chat deep link.
  - Tests: TBD
  - Risks: Medium (touches core chat error UX + billing flow)

