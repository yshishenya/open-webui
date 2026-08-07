# Public landing splash must not wait for backend bootstrap

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/public-landing-splash
- SDD Spec (JSON, required for non-trivial): N/A (targeted frontend guard)
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The public `/welcome` page can remain behind the global splash screen while the shared app layout waits for backend configuration, session, or language bootstrap. Marketing pages are static and should render even when the API is slow or unavailable.

## Goal / Acceptance Criteria

- [x] Public Airis pages remove the splash without waiting for authenticated app bootstrap.
- [x] Authenticated application routes keep the existing backend/session initialization.
- [x] Landing smoke test confirms meaningful content renders without framework errors.

## Non-goals

- Changing authenticated session handling.
- Changing public billing/rate-card API behavior inside the landing page.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Guard shared backend bootstrap by the public marketing route allowlist.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/+layout.svelte`
  - `src/lib/utils/airis/public_routes.ts`
- API changes:
  - None.
- Edge cases:
  - `/auth`, `/signup`, and the authenticated app remain on the existing bootstrap path.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/+layout.svelte`
- Why unavoidable:
  - The splash lifecycle and backend bootstrap are owned by the root Svelte layout.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep route classification in an Airis-owned helper and add one guarded branch around existing initialization.

## Verification

- Frontend tests: `npm run test:frontend -- --run` (102 passed)
- Frontend lint: `npx eslint src/routes/+layout.svelte src/lib/utils/airis/public_routes.ts src/lib/utils/airis/public_routes.test.ts` (passed)
- Production Vite build: `NODE_OPTIONS=--max-old-space-size=8192 npm run build:vite` (passed; existing Svelte warnings)
- Rendered smoke: `http://127.0.0.1:5174/welcome` with DOM snapshot, console logs, screenshot, and `/auth` navigation (passed).
- Typecheck: `npm run check` (blocked by 8,355 pre-existing diagnostics across 349 files).

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][UI][LANDING]** Remove backend bootstrap dependency from public landing splash
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__bugfix__public-landing-splash.md`
  - Owner: Codex
  - Branch: `codex/bugfix/public-landing-splash`
  - Started: 2026-08-07
  - Summary: Public marketing routes now render independently of slow or unavailable backend bootstrap, while authenticated routes retain the existing initialization path.
  - Tests: Pending
  - Risks: Low; guarded route allowlist only changes public marketing startup.

## Risks / Rollback

- Risks:
  - Public pages no longer wait for backend config before first paint, by design.
- Rollback plan:
  - Revert the single guarded bootstrap change and helper test.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
