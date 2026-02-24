# Welcome Landing (Figma Copy)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/feature/welcome-landing-figma-copy`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/welcome-landing-figma-copy-2026-02-22-0336.json`
- Created: 2026-02-22
- Updated: 2026-02-22

## Context

Current `/welcome` does not match the approved landing mock in Figma (`LjyMJoCtriqmVLCBOKWBwJ`, node `1:13` + mobile node `1:547`).
We need to ship the new visual structure while preserving signup/login CTA behavior and current navigation flows.

## Goal / Acceptance Criteria

- [x] Rebuild `/welcome` layout to follow the referenced Figma composition (hero, value blocks, examples, steps, models, why us, pricing explainer, free start, FAQ, footer).
- [x] Add responsive behavior aligned with provided mobile frame (`1:547`) so the page is usable on small screens.
- [x] Keep existing CTA flows wired to current auth/chat logic (`openCta`, login/signup redirects).
- [x] Keep page fully on existing stack (Svelte + Tailwind + current project utilities; no new dependencies).
- [x] Run frontend checks (tests + typecheck + lint) for touched files.

## Non-goals

- Rebuilding `/features`, `/pricing`, `/about`, `/contact` in this task.
- Introducing new backend APIs or pricing model logic.
- Pixel-perfect parity for every decorative asset if source files are unavailable in repo.

## Scope (what changes)

- Backend:
  - No changes.
- Frontend:
  - Replace `/welcome` implementation with Figma-based section structure and dark theme styling.
  - Wire section navigation and CTA actions to existing helpers.
  - Preserve SEO head tags and auth redirect behavior.
- Config/Env:
  - No changes.
- Data model / migrations:
  - No changes.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/welcome/+page.svelte`
- API changes:
  - None.
- Edge cases:
  - Authenticated user with `redirect` query should still be redirected.
  - Anonymous CTA click should still route through signup with source tracking.
  - Mobile layout should avoid horizontal scroll.

## Upstream impact

- Upstream-owned files touched:
  - None (Airis-owned route implementation only).
- Why unavoidable:
  - N/A.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes localized to the `/welcome` route and reuse existing navigation helpers.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend"`
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/svelte-check ]; then npm ci --legacy-peer-deps; fi; npm run check"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npm run lint:frontend"`

Run results:

- ✅ `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/landing/welcomeNavigation.test.ts"`
- ✅ `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/routes/welcome/+page.svelte"`
- ✅ `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/svelte-check ]; then npm ci --legacy-peer-deps; fi; npx svelte-check --no-tsconfig --workspace src/routes/welcome --diagnostic-sources 'svelte,css' --threshold warning"`
- ⚠️ Full-repo `npm run check`, `npm run lint:frontend`, and `npm run build:vite` fail due existing baseline issues outside this task (thousands of pre-existing diagnostics / Vite OOM in container), not introduced by this change.

## Post-implementation Design Audit

- Date: 2026-02-22
- Method: Visual comparison against Figma file `LjyMJoCtriqmVLCBOKWBwJ` using Playwright screenshots (Figma MCP calls unavailable due starter-plan quota limit).
- Outcome (initial): Partial fidelity. The page structure and color direction are close, but there are major mismatches in hero composition, examples card media richness, and the steps block layout relative to the approved mock.
- Follow-up fix pass (2026-02-22): Implemented a focused conformity update in `src/routes/welcome/+page.svelte` addressing all listed review findings (hero simplification, explicit pill icons, hero burst background, richer examples cards, steps layout parity).
- Follow-up validation:
  - ✅ `npx eslint src/routes/welcome/+page.svelte`
  - ✅ `npx svelte-check --no-tsconfig --workspace src/routes/welcome --diagnostic-sources 'svelte,css' --threshold warning`

## Task Entry (for branch_updates/current_tasks)

- [x] **[UI][LANDING]** Implement `/welcome` from Figma landing design copy
  - Spec: `meta/memory_bank/specs/work_items/2026-02-22__feature__welcome-landing-figma-copy.md`
  - Owner: Codex
  - Branch: `codex/feature/welcome-landing-figma-copy`
  - Done: 2026-02-22
  - Summary: Rebuild `/welcome` using Figma structure from `LjyMJoCtriqmVLCBOKWBwJ` with responsive layout and preserved CTA flows.
  - Tests: `vitest` (targeted), `eslint` (targeted), `svelte-check` (targeted workspace)
  - Risks: Medium (public entry page UX + conversion path changes).

## Risks / Rollback

- Risks:
  - Visual regression on mobile and CTA conversion path friction if buttons are wired incorrectly.
- Rollback plan:
  - Revert changes in `src/routes/welcome/+page.svelte` to previous implementation.
