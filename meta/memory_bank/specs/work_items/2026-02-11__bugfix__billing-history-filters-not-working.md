# Billing history filters do not apply on click

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-history-filters-not-working
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/billing-history-filters-2026-02-11-001.json`
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

Users reported that filter buttons on `/billing/history` were clickable but the timeline content did not change.

## Goal / Acceptance Criteria

- [x] Clicking a filter button in billing history updates the visible timeline entries immediately.
- [x] URL sync behavior remains intact for `syncFilterWithUrl` mode.
- [x] Add a regression test that fails before fix and passes after fix.
- [x] Guard against stale URL updates when users click filters quickly in sequence.

## Non-goals

- Redesign of billing history UI.
- Backend/API changes for billing data.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Fix reactivity in `UnifiedTimeline` so filtered items recompute on `activeFilter` changes.
  - Harden URL filter sync state to avoid local filter rollback before URL store updates.
  - Add regression tests for delayed URL emission and stale URL updates after rapid sequential clicks.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/billing/UnifiedTimeline.svelte`
  - `src/lib/components/billing/UnifiedTimeline.test.ts`
- API changes:
  - None.
- Edge cases:
  - Filter should still apply even if URL store update is delayed.
  - Browser navigation / URL-driven filter sync should continue to work.
  - Out-of-order URL updates should not override the latest user-selected filter.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/lib/components/billing/UnifiedTimeline.svelte`
- Why unavoidable:
  - The bug is in this shared timeline component reactivity and cannot be fixed from an additive wrapper alone.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes local and minimal: adjust filter function signature/reactive dependency and URL-sync guard state only.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests (targeted):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/billing/UnifiedTimeline.test.ts"`
- Frontend lint (targeted):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/billing/UnifiedTimeline.svelte src/lib/components/billing/UnifiedTimeline.test.ts"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][UI][BILLING]** Fix non-working history filters in billing timeline
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__bugfix__billing-history-filters-not-working.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-history-filters-not-working`
  - Done: 2026-02-11
  - Summary: Fixed billing history filter reactivity so click changes are applied immediately; added regression test.
  - Tests: `vitest (docker, targeted)`, `eslint (docker, targeted)`
  - Risks: Low (frontend-only, localized timeline logic)

## Risks / Rollback

- Risks:
  - Minor behavior change in filter/URL sync interaction.
- Rollback plan:
  - Revert `UnifiedTimeline` filter reactivity changes and test update in one commit.
