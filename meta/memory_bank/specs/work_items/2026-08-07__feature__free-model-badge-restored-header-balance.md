# Free model badge and restored header balance

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: codex/feature/free-model-balance
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/free-model-badge-restored-header-2026-08-07-001.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The chat navbar already imports `HeaderBillingAccess`, but does not render it, so the user balance disappeared from the upper-right controls. Models configured with the existing `info.meta.lead_magnet` flag are eligible for free quota, but the model picker gives no visible affordance for that fact.

## Goal / Acceptance Criteria

- [x] Restore the compact balance/top-up control in the chat navbar upper-right area.
- [x] Show a small accessible free-quota badge for lead-magnet models in the model picker.
- [x] Explain that free usage is quota-limited without changing billing enforcement or API contracts.
- [x] Preserve keyboard navigation, screen-reader labels, dark mode, and narrow viewport behavior.
- [x] Add focused frontend regression coverage.

## Non-goals

- No new billing endpoint, database migration, or model metadata field.
- No change to billing eligibility or quota calculation.
- No redesign of the full billing dashboard.

## Scope (what changes)

- Backend:
  - None; reuse the existing `lead_magnet` model metadata.
- Frontend:
  - Render `HeaderBillingAccess` from `Navbar.svelte`.
  - Add a compact `Free` badge and tooltip to `ModelItem.svelte` when `item.model.info.meta.lead_magnet` is true.
  - Add focused model-item regression coverage if the existing test setup supports it.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Existing balance API: `$lib/apis/billing.getBalance` through `HeaderBillingAccess.svelte`.
- Existing free-access source of truth: `info.meta.lead_magnet` and localized `Free` / `Free limit applies to select models` strings.
- Badge is intentionally informational: it must not imply unlimited free use after the user's quota is exhausted.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/chat/Navbar.svelte`
  - `src/lib/components/chat/ModelSelector/ModelItem.svelte`
- Why unavoidable:
  - These are the existing chat navbar and model-picker entry points.
- Minimization strategy:
  - Two narrow additive render changes; no API or shared state changes.

## Verification

- `npm run test:frontend -- --run` (passed: 27 files / 103 tests)
- `npx eslint src/lib/components/chat/Navbar.svelte src/lib/components/chat/ModelSelector/ModelItem.svelte` (existing baseline findings)
- `npm run check` (existing baseline findings: 8358 errors / 231 warnings)
- `npm run build:vite` (reached production build, exited on Node heap OOM)
- `git diff --check` (passed)

## Risks / Rollback

- Risks: low; visual-only changes using existing data and components. The main UX risk is crowding the right controls on narrow screens, mitigated with compact styling and responsive hiding of the text label.
- Rollback plan: revert the navbar render and model-item badge changes; no data rollback required.

## Completion Checklist

- [x] SDD spec validated and completed.
- [x] Branch update entry marked Done.
