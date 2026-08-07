# Landing SSR and analytics hardening

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/fix-wallet-topup-clarity
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/landing-ssr-and-analytics-hard-2026-08-08-0200.json`
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The public Airis pages render as a client-only shell in production HTML, which weakens search indexing and link previews. Public route prerendering also exposed browser-only code and query-string access during SSR. Landing analytics emitted duplicate initial page views, while selected public CTA and support paths were not consistently represented as goals.

## Goal / Acceptance Criteria

- [x] Public marketing/legal routes produce server-rendered HTML with a heading, description, and canonical URL.
- [x] SSR/prerender does not execute browser-only APIs or fail on query parameters.
- [x] Public CTA navigation preserves signup intent and preset parameters.
- [x] Yandex page views are deduplicated per path and CTA goals are emitted after consent.
- [x] Legal 401 responses recover by redirecting to authentication instead of showing a generic load error.
- [x] Production-backed rate/model copy does not expose misleading provider labels.

## Non-goals

- Reworking the main landing visual design or adding a second analytics provider without a configured measurement ID.
- Fixing unrelated pre-existing `svelte-check` errors across the upstream application.

## Scope (what changes)

- Frontend:
  - Enable SSR and prerender public routes.
  - Guard layout browser APIs and make the public shell render immediately.
  - Make welcome query handling client-only and deduplicate analytics page views.
  - Add CTA/support goal allowlisting and improve legal-session recovery.
  - Keep public pricing labels aligned with the live rate-card response.
- Config/Env:
  - No new dependencies or environment variables.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/+layout.js`, `src/routes/+layout.svelte`
  - `src/routes/welcome/+page.svelte` and public route `+page.js` prerender markers
  - `src/lib/components/analytics/AnalyticsBootstrap.svelte`
  - `src/lib/apis/legal/index.ts`, `src/routes/(app)/+layout.svelte`
- API changes:
  - None; existing public billing and legal APIs are consumed as-is.
- Edge cases:
  - Expired legal-session tokens redirect to `/auth` with the original path/query.
  - Unconsented analytics remains disabled.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/+layout.js`, `src/routes/+layout.svelte`, `src/app.html`
- Why unavoidable:
  - The root layout controls SSR safety, splash removal, and the shared analytics shell.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Only guarded browser lifecycle code and public-route initialization were changed; marketing behavior stays in existing landing modules.

## Verification

- Selected frontend tests: `npm run test:frontend -- --run src/lib/apis/legal/index.test.ts src/lib/utils/analytics.test.ts src/lib/components/landing/welcomeNavigation.test.ts src/lib/utils/airis/pricing_estimator.test.ts`
- Production build: `NODE_OPTIONS=--max-old-space-size=6144 npm run build:vite`
- Manual preview checks: all public routes at desktop/mobile viewport, headings, splash removal, CTA/signup redirects, and Yandex goal calls.
- `npm run check` remains blocked by pre-existing upstream diagnostics in unrelated files; no diagnostics reference the changed files.

## Risks / Rollback

- Risks:
  - SSR increases the root bundle's server-rendering surface; the build/prerender check covers public routes.
- Rollback plan:
  - Revert the single commit; the previous SPA fallback remains available.

## Completion Checklist

- [x] SDD spec completed after final verification.
- [x] Branch update entry moved to `Done` with required fields.
