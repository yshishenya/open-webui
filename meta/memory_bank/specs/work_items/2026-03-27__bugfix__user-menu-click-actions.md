# Restore User Menu Click Actions

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-27
- Updated: 2026-03-27

## Context

The shared `UserMenu` dropdown rendered correctly but menu actions did not execute when selected. This regressed core navigation and account actions from the user profile menu in chat and sidebar surfaces.

## Goal / Acceptance Criteria

- [x] Clicking actionable menu items triggers the expected behavior again.
- [x] Internal navigation items remain wired to the existing Svelte navigation flow.
- [x] Add a targeted frontend regression test covering an action item and a route item.

## Non-goals

- Rework the visual design of the user menu.
- Refactor unrelated dropdown or navbar components.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Keep `bits-ui` menu usage aligned with the repo-installed API.
  - Mark menu content and items as `no-drag-region` so desktop draggable surfaces do not swallow selection.
  - Add a targeted `UserMenu` component test.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/layout/Sidebar/UserMenu.svelte`
  - `src/lib/components/layout/Sidebar/UserMenu.test.ts`
- API changes:
  - None.
- Edge cases:
  - Internal route items still expose `href` for anchor semantics while using the existing `goto(...)` helper.
  - Test environment requires a light `Element.prototype.animate` shim because `bits-ui` menu content uses Web Animations APIs.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/lib/components/layout/Sidebar/UserMenu.svelte`
- Why unavoidable:
  - The regression is inside the shared upstream menu component used by Airis surfaces.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the change localized to menu classes/test IDs and a focused regression test; no unrelated layout or behavior changes.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/layout/Sidebar/UserMenu.test.ts"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/layout/Sidebar/UserMenu.svelte src/lib/components/layout/Sidebar/UserMenu.test.ts"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][UI]** Restore user menu click actions
  - Spec: `meta/memory_bank/specs/work_items/2026-03-27__bugfix__user-menu-click-actions.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-03-27
  - Summary: Restored `UserMenu` interactions by explicitly marking dropdown content/items as `no-drag-region` and adding a regression test for action and route selections.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/layout/Sidebar/UserMenu.test.ts"`; `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/layout/Sidebar/UserMenu.svelte src/lib/components/layout/Sidebar/UserMenu.test.ts"`
  - Risks: Low (localized menu interaction fix in a shared component).

## Risks / Rollback

- Risks:
  - Shared user menu behavior changes across chat/sidebar surfaces.
- Rollback plan:
  - Revert `UserMenu.svelte` and `UserMenu.test.ts` if unexpected interaction regressions appear.

## Completion Checklist

- [x] No SDD spec required for this trivial bugfix.
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
