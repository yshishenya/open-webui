# Simplify wallet free-limit disclosure

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/wallet-limits-simplify
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The wallet shows all free-limit metrics beside the primary top-up card. This makes secondary information compete with the payment action, especially on mobile.

## Goal / Acceptance Criteria

- [ ] Keep the free-limit summary visible without rendering metric cards by default.
- [ ] Reveal all metrics and eligible models with one accessible disclosure action.
- [ ] Preserve existing usage values, model lists, dark mode, and localization.
- [ ] Verify desktop and mobile layout, keyboard focus, and no horizontal overflow.

## Non-goals

- No billing API, pricing, quota, or persistence changes.
- No new dependency or translation catalog expansion.

## Scope (what changes)

- Backend: none.
- Frontend: simplify `WalletLeadMagnetSection` disclosure and interaction states.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Keep the existing metric grouping and formatters; only change visibility and visual emphasis.
- Use `aria-expanded` and `aria-controls` for the summary disclosure.
- Replace broad CSS transitions with explicit properties and provide a reduced-motion fallback.

## Upstream impact

- Upstream-owned files touched: `src/lib/components/billing/WalletLeadMagnetSection.svelte`.
- Why unavoidable: the existing wallet component owns the noisy free-limit presentation.
- Minimization strategy: one component-only diff; no API or route contract changes.

## Verification

- `npm run test:frontend -- src/lib/components/billing/WalletLeadMagnetSection.test.ts`
- `npm run check`
- `npm run lint:frontend -- src/lib/components/billing/WalletLeadMagnetSection.svelte`
- `git diff --check`
- Browser UI audit at desktop and 390px mobile viewports.

## Risks / Rollback

- Risks: users need one extra click to inspect detailed free usage.
- Rollback plan: revert the component-only commit.

## Completion Checklist

- [ ] Focused component test passes.
- [ ] Typecheck and lint pass.
- [ ] Desktop/mobile browser checks pass.
- [ ] Branch update marked Done.
