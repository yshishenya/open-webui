# Privacy-safe web analytics for Airis

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/billing-balance-history-simplify
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/airis-privacy-safe-yandex-analytics-2026-08-07-001.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

Airis already emits a small internal `trackEvent` signal, but production does not have a configured web analytics adapter. That makes the landing-to-first-answer funnel invisible and leaves the product/landing without a shared consent and privacy boundary. The user requested Yandex Metrica and Google Analytics coverage for both the public marketing pages and the authenticated product.

## Goal / Acceptance Criteria

- [x] One shared, typed analytics adapter sends the approved event schema to Yandex Metrica, Google Analytics 4, the existing dataLayer, and PostHog when configured.
- [x] The adapter is opt-in by configuration, does not send PII or prompt text, and respects a single persisted analytics consent choice.
- [x] Attribution parameters remain provider-managed; event payloads contain no full URLs or user identifiers.
- [x] Landing and product both emit page views and the core activation funnel events.
- [x] Yandex counter `111392024` is configured for `chat.airis.you`; seven stable event-name JS goals were added.
- [x] The build, focused tests, and browser verification confirm the tag loads only as configured and events do not throw when providers are absent.

## Non-goals

- No server-side warehouse, CRM, ad audience sync, or new analytics dependency.
- No user-level identity stitching or replay of chat content.
- No automatic creation of Google Analytics properties or ad campaigns from the repository.

## Scope (what changes)

- Backend:
  - No runtime API changes; existing product analytics endpoints remain admin-only.
- Frontend:
  - Add a small Airis analytics/consent utility and wire it into the root layout, landing CTAs, signup success, and chat activation points.
  - Add a minimal consent control linked to the existing privacy/cookies documents.
  - Add Yandex Metrica and GA4 adapters through public build-time environment variables.
- Config/Env:
  - Add documented `PUBLIC_YANDEX_METRICA_ID`, `PUBLIC_GA_MEASUREMENT_ID`, and optional provider enable flags to `.env.example`/compose passthrough.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/utils/analytics.ts`
  - `src/lib/utils/airis/analyticsConsent.ts`
  - `src/lib/components/analytics/AnalyticsBootstrap.svelte`
  - `src/routes/+layout.svelte`
  - `src/app.html`
- Event contract:
  - `page_view`, `landing_cta_click`, `signup_started`, `signup_completed`, `first_prompt_submitted`, `first_response_received`, `billing_topup_completed`.
  - Event properties are bounded enums/booleans/numbers only; never email, prompt, chat content, tokens, or auth values.
- Yandex initialization uses `webvisor`, `clickmap`, `trackLinks`, `accurateTrackBounce`, and `ecommerce: false`; masked form fields and sensitive app selectors stay outside replay collection where the UI supports it.
- Page titles are not sent to Yandex or GA4 because authenticated chat titles can contain user content.
- The production Yandex counter is configured in the UI; the Google provider stays dormant until a real `PUBLIC_GA_MEASUREMENT_ID` is supplied at build time.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/+layout.svelte`, `src/app.html`
- Why unavoidable:
  - These are the only shared entrypoints covering both marketing and authenticated product routes.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep provider logic in Airis-owned `src/lib/utils/airis/*`; use one bootstrap component and one call from the shared layout.

## Verification

- Frontend unit tests for consent persistence and provider-safe event dispatch.
- `npm run build:vite` with a bounded Node heap.
- Targeted ESLint and `git diff --check`.
- Browser/build smoke and provider globals inspected read-only; the production site still needs a deployment to pass the tag checker.
- Yandex settings verify tag `111392024`, domain restriction, Webvisor, and seven JS goals.

## Risks / Rollback

- Risks:
  - Third-party scripts can affect page performance and privacy; mitigated by async loading, config gating, and consent default deny.
- Rollback plan:
  - Remove public measurement IDs or set provider flags false; the app remains functional because the adapter is a no-op.

## Completion Checklist

- [ ] SDD spec completed after production deployment and live tag checker.
- [ ] Branch update entry moved to `Done` with deployment notes.
