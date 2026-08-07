# Simplify public pricing estimator

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/fix-wallet-topup-clarity
- SDD Spec (JSON, required for non-trivial): N/A (small frontend-only refinement)
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The public pricing estimator exposes too many text-size controls and can select the first
rate-card model when no recommendation is configured. That makes a normal short-message
scenario look unnecessarily expensive.

## Goal / Acceptance Criteria

- [x] Text estimation has one primary input: messages per day.
- [x] The default text scenario uses short requests and replies.
- [x] Without an explicit recommended text model, the estimator uses the cheapest available
      model with input and output text rates.
- [x] Image and audio estimates remain available and unchanged.
- [x] No billing API, rate-card, or charged-cost behavior changes.

## Non-goals

- Changing real billing rates or wallet charging.
- Adding a new model or dependency.
- Redesigning the full pricing page.

## Scope (what changes)

- Frontend:
  - simplify `Estimator.svelte` text controls and remove duplicate example cards;
  - make the fallback text model selection price-aware;
  - reduce the default text sample to short request/reply sizes.
- Backend: none.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/pricing/Estimator.svelte`
  - `src/lib/data/pricing-estimator.json`
- API changes: none.
- Edge cases: keep the current unavailable-rate fallback and honor an explicit recommended model.
- Billing alignment: the text estimate mirrors backend per-request kopek rounding, so the live
  cheapest model produces about 5.10–7.20 ₽ for the default 10 short messages per day.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/pricing/Estimator.svelte`
- Why unavoidable: the public estimator is the user-facing scope.
- Minimization strategy: no API changes; keep the existing component and rate-card contract.

## Verification

- `npm run test:frontend -- --run` — 31 files / 119 tests passed
- `npm run check` — blocked by pre-existing repository diagnostics (8,357 errors in 349 files)
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build:vite` — passed
- `npx eslint src/lib/components/pricing/Estimator.svelte src/lib/utils/airis/pricing_estimator.ts src/lib/utils/airis/pricing_estimator.test.ts` — passed
- `npx vitest --config vitest.config.ts run src/lib/utils/airis/pricing_estimator.test.ts` — 4 passed
- `git diff --check` — passed

## Risks / Rollback

- Risks: estimate becomes lower when the catalog contains an inexpensive model; this is
  intentional and remains explicitly an estimate.
- Rollback plan: revert the estimator and JSON changes; no persistent state is changed.

## Completion Checklist

- [x] Frontend checks completed; full typecheck remains blocked by the documented baseline.
- [x] Branch update entry moved to `Done` with required fields.
