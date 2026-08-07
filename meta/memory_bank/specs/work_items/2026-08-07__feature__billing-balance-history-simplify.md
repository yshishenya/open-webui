# Simplify billing balance and transaction history UX

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: `codex/feature/billing-balance-history-simplify`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/simplify-billing-balance-history-2026-08-07-001.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The production wallet already exposes the required billing data, but the first viewport has too many equal-weight elements and the history renders every event as a large card. Users should immediately understand the amount available, the next action, and what each transaction did without reading dense copy.

The redesign follows the observed production flow and established financial-product patterns: balance and primary action first, one compact activity list, explicit positive/negative/free states, and progressive disclosure for rarely used settings.

## Goal / Acceptance Criteria

- [ ] Wallet first viewport has a single clear balance hierarchy and one primary top-up action.
- [ ] Top-up choices remain functional and payment redirect/reconciliation behavior is unchanged.
- [ ] Advanced settings stay collapsed unless configured, with accessible disclosure semantics.
- [ ] History uses compact, scannable rows grouped by calendar day; amounts and free usage remain unambiguous.
- [ ] Filters remain shareable through `?filter=` and work on desktop and narrow mobile layouts.
- [ ] Empty, loading, retry, low-balance, top-up-return, and free-limit states remain understandable.
- [ ] Existing billing APIs, analytics events, and auth boundaries are unchanged.
- [ ] Frontend tests and rendered browser checks pass with no new console errors.

## Non-goals

- No backend/API, database, payment, pricing, or ledger changes.
- No new dependencies or new billing concepts.
- No export/search/date-range feature in this pass.

## Scope

- Frontend:
  - Simplify wallet spacing/copy and keep the existing action order.
  - Refactor the shared `UnifiedTimeline` presentation into grouped compact rows.
  - Keep URL-synced filter behavior and make filter controls mobile-safe.
  - Add focused regression assertions for the new row/group semantics.
- Backend/config/data: none.

## Design decisions

- Wallet: current balance is the visual anchor; top-up is the only filled CTA; history and help are secondary links.
- History: one list with day separators, not one rounded card per event. Each row contains title/context/time and a right-aligned amount or `Free` state.
- Accessibility: real buttons/links, `aria-pressed` for filters, `aria-label` on transaction rows, visible focus rings, no information conveyed by color alone.
- Responsive: rows may stack on narrow screens, filters scroll horizontally without wrapping the page.

## Upstream impact

- Upstream-owned files touched: `src/routes/(app)/billing/balance/+page.svelte`, `src/routes/(app)/billing/history/+page.svelte`, `src/lib/components/billing/UnifiedTimeline.svelte` and its test.
- Why unavoidable: these are the existing billing UI entrypoints; no API or upstream component replacement is needed.
- Minimization strategy: presentation-only changes, reuse existing API/types/i18n/analytics, no dependency changes.

## Verification

- Focused Vitest: `npm run test:frontend -- --run src/lib/components/billing/UnifiedTimeline.test.ts src/routes/(app)/billing/balance/billing-balance.test.ts`
- Full frontend tests: `npm run test:frontend -- --run`
- Lint/check: targeted ESLint plus `npm run check` (record pre-existing diagnostics if unrelated failures remain)
- Browser: production wallet → history → filter change → return to wallet; desktop and narrow viewport screenshots; console errors/warnings empty.

## Risks / Rollback

- Risk: compact rows could hide detail on small screens. Mitigation: preserve model, modality, token metrics, timestamp, and amount; allow wrapping.
- Risk: changing shared timeline markup can affect the wallet preview. Mitigation: keep existing props/API and cover both full history and preview rendering.
- Rollback: revert this frontend-only commit; no migration or data rollback required.
