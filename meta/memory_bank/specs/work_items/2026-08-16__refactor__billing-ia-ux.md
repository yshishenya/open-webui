# Billing IA UX cleanup

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-visible-payer-email
- SDD Spec (JSON, required for non-trivial): N/A (frontend-only terminology and navigation refactor)
- Created: 2026-08-16
- Updated: 2026-08-16

## Context

The billing surface combines balance, top-up, spending controls, and payment settings under the Wallet page. The existing settings route is a redirect, so users do not have a clear way to reach payment controls.

## Goal / Acceptance Criteria

- [x] Expose payment settings as an explicit billing navigation destination.
- [x] Reuse the existing settings components and deep-link behavior without duplicating billing logic.
- [x] Use user-facing billing terms consistently in the balance and history surfaces.
- [x] Preserve chat return links, top-up flow, and existing admin-only plan access.

## Non-goals

- No backend, API, payment provider, or data model changes.
- No full extraction of billing settings into a new backend route.

## Scope (what changes)

- Frontend: billing navigation, balance contextual settings view, history filter terminology, Russian and English billing labels.
- Backend: none.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Link the new Settings navigation item to the existing `/billing/balance?focus=limits` deep-link.
- Hide the overview-only content while the settings deep-link is active, keeping the existing settings components as the single implementation.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/(app)/billing/+layout.svelte`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `src/lib/components/billing/UnifiedTimeline.svelte`
  - `src/lib/i18n/locales/en-US/translation.json`
  - `src/lib/i18n/locales/ru-RU/translation.json`
- Why unavoidable: these are the existing user billing shell, page, timeline, and locale sources.
- Minimization strategy: keep the diff additive/conditional and reuse existing components and API calls.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Result: 33 test files and 126 tests passed.
- Frontend typecheck: blocked by existing repo-wide diagnostics (`svelte-check found 8361 errors and 226 warnings in 350 files`); no backend/API changes were introduced.

## Risks / Rollback

- Risks: the new Settings item is a contextual view over the existing balance route; direct `/billing/settings` remains a legacy redirect for compatibility.
- Rollback plan: revert the billing shell, balance conditional, timeline label, locale, and documentation changes.
