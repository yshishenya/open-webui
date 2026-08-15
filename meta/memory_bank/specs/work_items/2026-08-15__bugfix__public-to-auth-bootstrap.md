# Restore auth bootstrap after public-page navigation

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/public-to-auth-bootstrap`
- SDD Spec (JSON, required for non-trivial): N/A (single navigation guard and regression test)
- Created: 2026-08-15
- Updated: 2026-08-15

## Context

Public marketing pages intentionally skip backend/session bootstrap to keep first paint fast. SvelteKit SPA navigation from `/welcome` kept the root layout mounted, so entering `/auth` did not run that bootstrap and the auth page rendered without configured social providers.

## Goal / Acceptance Criteria

- [x] `/welcome` does not request `/api/config` on initial load.
- [x] Public-to-product navigation performs the existing product bootstrap.
- [x] `/welcome` → `Войти` requests `/api/config` and renders the auth page from configured state.
- [x] Public-to-public and product-internal navigation remain SPA navigation.
- [ ] Production health and the direct `/auth` flow remain healthy after rollout.

## Non-goals

- Refactoring root bootstrap or duplicating config loading in the auth page.
- Changing provider configuration or auth UI.

## Scope (what changes)

- Backend: none.
- Frontend: add a public-to-product document-navigation guard and an E2E regression.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Key files/entrypoints: `src/routes/+layout.svelte`, `e2e/public_pages_smoke.spec.ts`.
- API changes: none.
- Edge cases: initial loads, public-to-public links, and already-unloading navigations are unchanged.

## Upstream impact

- Upstream-owned files touched: `src/routes/+layout.svelte`.
- Why unavoidable: the skipped bootstrap and persistent root layout are controlled there.
- Minimization strategy: one guard in the existing `beforeNavigate` hook; no bootstrap duplication.

## Verification

- Focused Vitest for public route classification.
- Frontend typecheck and lint for changed files.
- Focused Playwright public-pages smoke test.
- Production `/welcome` → `Войти`, direct `/auth`, `/api/config`, and `/health` checks.

Results:

- `npm run test:frontend -- src/lib/utils/airis/public_routes.test.ts` — passed (2 tests).
- `npx eslint src/routes/+layout.svelte e2e/public_pages_smoke.spec.ts` — passed.
- Direct local Playwright smoke — initial `/welcome` made zero config requests; crossing into `/auth` made one request and rendered `#auth-page`.
- `npm run check` — blocked by the existing repository baseline (8,362 errors across 352 files); no changed-file ESLint errors.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUGFIX]** Restore auth bootstrap after public-page navigation
  - Spec: `meta/memory_bank/specs/work_items/2026-08-15__bugfix__public-to-auth-bootstrap.md`
  - Owner: Codex
  - Branch: `codex/bugfix/public-to-auth-bootstrap`
  - Started: 2026-08-15
  - Summary: Preserve fast public landing loads while correctly bootstrapping auth and app routes after navigation.
  - Tests: focused Vitest, changed-file ESLint, and local Playwright smoke passed; repository-wide typecheck has pre-existing failures.
  - Risks: one full document navigation when crossing from marketing pages into the product.

## Risks / Rollback

- Risk: the first public-to-product click performs a document load instead of SPA navigation.
- Rollback: revert the navigation guard and redeploy the previous immutable image.

## Completion Checklist

- [ ] Branch update entry moved to Done with required fields (`Spec`, `Owner`, `Summary`, `Done`).
