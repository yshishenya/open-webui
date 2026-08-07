# Public Airis pages redesign

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: codex/bugfix/welcome-navigation-routes
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/public-airis-pages-redesign-2026-08-07-1247.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The public Airis surface is split between a dark welcome page and dense legacy-style feature, pricing, company, contact, document, and legal pages. Navigation and copy do not consistently explain the product's core value: AI models available in one chat without a VPN. Some interactions also imply behavior that is not implemented (notably the contact form).

## Goal / Acceptance Criteria

- [x] Public pages share one calm Airis visual system with clear hierarchy and generous spacing.
- [x] The user journey is understandable for a first-time Russian B2C visitor: value → proof → task → cost → start.
- [x] Claims remain grounded in current product behavior; dynamic model and billing data stays dynamic.
- [x] Navigation, CTAs, examples, FAQ, pricing, documents, and legal links work from guest and authenticated contexts.
- [x] Contact flow never reports a simulated server success; it provides a truthful, usable support path.
- [x] Responsive and keyboard behavior is verified for the changed public routes.

## Non-goals

- No new billing, model, legal, or contact backend APIs.
- No new dependencies, video runtime, autoplay carousel, or decorative interaction without product meaning.
- No changes to authenticated chat behavior beyond preserving existing redirect/prefill contracts.

## Scope (what changes)

- Backend: none.
- Frontend: shared public layout/navigation styling, welcome copy/flow polish, features/pricing/about/contact/documents/legal presentation and truthful interaction states.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Reuse `PublicPageLayout`, `NavHeader`, `FooterLinks`, current billing APIs, current preset navigation, and existing product assets.
- Keep model names and free limits sourced from public API responses; do not hard-code provider labels or unsupported capabilities.
- Preserve `welcomeNavigation.ts` query parameters and guest/auth redirect semantics.
- Prefer native `details`/`summary`, semantic headings, visible focus states, and reduced-motion-safe transitions.

## Upstream impact

- Upstream-owned files touched: existing Svelte route/components only.
- Why unavoidable: the public experience is implemented in the shared frontend route layer.
- Minimization strategy: use shared shell and additive CSS/data changes; keep navigation and API contracts unchanged.

## Verification

- Targeted frontend tests for landing navigation and changed interactions.
- `npm run lint:frontend` on changed files where the repository baseline permits.
- `npm run build` with the existing Node memory workaround if required.
- Local route smoke checks plus desktop/mobile, keyboard, reduced-motion, and console-error checks.

## Risks / Rollback

- Risks: broad visual changes touch shared public layout; legacy document pages may have inconsistent local utility classes.
- Rollback plan: revert the shared layout/navigation and page-level commits; preserve API and auth/navigation modules.

## Completion Checklist

- [x] `meta/tools/sdd check-complete public-airis-pages-redesign-2026-08-07-1247 --json`
- [x] `meta/tools/sdd complete-spec public-airis-pages-redesign-2026-08-07-1247 --json`
- [x] Branch update entry moved to `Done` with required fields.
