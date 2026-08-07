# Analytics lead funnel and deployment build args

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/analytics-lead-funnel
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/analytics-lead-funnel-and-depl-2026-08-08-0250.json`
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The production landing image was built without the public Yandex Metrica ID, so the analytics adapter compiled with an empty counter and no provider script loaded. The landing already emits useful interaction events, but campaign attribution and normalized funnel goals were not reliable enough to approve paid traffic.

## Goal / Acceptance Criteria

- [ ] Production builds embed the configured public Yandex/GA IDs through the standard deploy script.
- [ ] Campaign parameters are retained as first-party attribution and attached only to consented analytics events.
- [ ] Yandex/GA receive normalized funnel goals for CTA, signup completion, first prompt, first response, and credited top-up.
- [ ] Auth signup view/start/completion events cover email and social entry paths.
- [ ] Production browser checks prove provider initialization, goal queueing, CTA navigation, and public route health.

## Non-goals

- No change to the landing visual design or billing rules.
- No personally identifiable data or prompt contents are sent to analytics providers.

## Scope (what changes)

- Frontend:
  - Add consent-aware campaign attribution and normalized funnel aliases.
  - Add auth funnel events for signup view and social/email starts.
  - Add regression tests for provider queueing and attribution sanitization.
- Deployment:
  - Pass public analytics build args in `scripts/deploy_prod.sh`.
  - Document required public IDs in deploy target examples.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/utils/analytics.ts`
  - `src/lib/components/analytics/AnalyticsBootstrap.svelte`
  - `src/routes/auth/+page.svelte`
  - `scripts/deploy_prod.sh`
- Edge cases:
  - Analytics remains disabled until explicit consent.
  - Missing IDs remain a valid no-op configuration.
  - Attribution values are allowlisted, bounded, and never include prompt/message/email fields.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
  - `scripts/deploy_prod.sh`
- Why unavoidable:
  - Auth owns signup lifecycle and the deploy engine owns image build arguments.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small event hooks and a build-arg passthrough; no provider or dependency changes.

## Verification

- Frontend targeted Vitest suite for analytics and navigation.
- `npm run build:vite` with `PUBLIC_YANDEX_METRICA_ID=111392024` and compiled-ID assertion.
- Production Playwright smoke: public routes, consent, provider script/queue, CTA redirect, and no console errors.
- Production `/health` and public pricing/lead-magnet API checks.

## Risks / Rollback

- Risks:
  - A malformed local deploy env could omit analytics IDs; the build remains functional and tests expose the omission.
- Rollback plan:
  - Revert the frontend/deploy-script commit and redeploy the previous immutable image.

## Completion Checklist

- [ ] SDD spec complete and cross-linked.
- [ ] Production smoke checks recorded in branch update.
