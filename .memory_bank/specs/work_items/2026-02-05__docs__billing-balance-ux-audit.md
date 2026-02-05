# Billing wallet UX audit (/billing/balance)

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: detached@4761c822c
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

User requested an end-to-end UX analysis of `https://chat.airis.you/billing/balance`:

- Map all entry/usage/exit scenarios for the wallet page.
- Identify usability / clarity / aesthetics gaps.
- Propose improvements to make the page more convenient, functional, and visually polished.

## Goal / Acceptance Criteria

- [x] Enumerate entry, core, and exit scenarios (including edge states).
- [x] Produce prioritized improvement backlog (impact/effort).
- [x] Call out copy/a11y/empty-state improvements.
- [x] Keep suggestions compatible with current billing model (wallet top-up + lead magnet + advanced settings).

## Non-goals

- Implement UI changes in this work item.
- Change billing business rules, prices, or payment provider logic.
- Add new dependencies.

## Scope (what changes)

- Backend:
  - None (analysis only).
- Frontend:
  - None (analysis only; proposed targets listed below).
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

### Current IA (observed)

Wallet page layout (top → bottom):

1) Wallet hero: balance summary, low-balance badge (< 100 RUB), CTAs (Top up / View history)
2) Top-up section: packages + custom amount
3) Free limit (lead magnet) section (if enabled)
4) Advanced settings accordion: auto-topup, spend controls, receipt contacts
5) Latest activity preview (Unified timeline)

### Primary user journeys to support

- New user: understand what “wallet” means, see free limits, learn how to top up.
- Blocked user (insufficient funds): land here from a blocking prompt, top up fast, return to chat.
- Returning user: quickly top up with last amount/method, verify balance updated.
- Power user: enable auto-topup + caps to prevent surprise spend.
- Accounting user: set receipt contacts, find receipt/transaction in history.

### Proposed improvement backlog (high-level)

**P0 (clarity + conversion)**

- Make “Available now” explainable (tooltip / helper text: includes wallet+plan; excludes pending holds if any).
- Improve custom-amount input UX for RU locale: placeholder/formatting (`0,00`), accept comma/dot, format on blur, show min/max + inline validation.
- Provide a stronger empty-state for “Latest activity” (why empty + direct top-up CTA).
- After returning from payment provider: show explicit success/pending/failure state (banner/ toast + “Back to chat” CTA).

**P1 (trust + control)**

- Show last payment method / “Powered by YooKassa” context and what happens next (“You’ll be redirected…”).
- Advanced settings: show “Saved/Unsaved” status and only enable “Save” when dirty; hide failure counters when 0.
- Spend controls: add explanation of consequences (what happens when cap reached) + optional “spent today” hint if available.

**P2 (delight + retention)**

- Smart top-up presets (based on last top-up / recent burn rate) and “covers ~N days” helper copy.
- Free limit: if no free models are available, show actionable explanation or hide the section (avoid confusing “free quotas but no models” state).
- Add lightweight “How billing works” affordance (popover/link) and deep links to pricing / model costs.

### Suggested file targets (if/when implementing)

- `src/routes/(app)/billing/balance/+page.svelte` (hero copy, success/pending state after return, timeline empty-state)
- `src/lib/components/billing/WalletTopupSection.svelte` (custom amount formatting, validation, “redirect” helper)
- `src/lib/components/billing/WalletLeadMagnetSection.svelte` (no-models state; reset “Never” copy)
- `src/lib/components/billing/WalletAutoTopupSection.svelte` (dirty state, copy, hide 0 failures)
- `src/lib/components/billing/WalletSpendControls.svelte` (clarity, helper copy)
- `src/lib/components/billing/UnifiedTimeline.svelte` (empty state affordances, skeletons)

## Upstream impact

- Upstream-owned files touched:
  - None (analysis only).
- Why unavoidable:
  - N/A.
- Minimization strategy:
  - N/A.

## Verification

- Tests: N/A (docs-only).

## Task Entry (for branch_updates/current_tasks)

- [x] **[UI][BILLING]** Wallet (/billing/balance) UX audit + improvement backlog
  - Spec: `.memory_bank/specs/work_items/2026-02-05__docs__billing-balance-ux-audit.md`
  - Owner: Codex
  - Branch: `detached@4761c822c`
  - Done: 2026-02-05
  - Summary: Mapped entry/usage/exit scenarios and proposed prioritized UI/UX improvements for Wallet page.
  - Tests: N/A (docs-only)
  - Risks: N/A

## Risks / Rollback

- Risks:
  - N/A (analysis only).
- Rollback plan:
  - N/A.

