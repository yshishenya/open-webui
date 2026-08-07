# Deeper Yandex analytics for Airis

## Meta

- Type: feature
- Status: completed
- Owner: Codex
- Branch: codex/feature/billing-balance-history-simplify
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/airis-yandex-analytics-depth-2026-08-07-2017.json`
- Created: 2026-08-07

## Goal

Make the Yandex-only analytics picture complete across landing, authentication, product activation, navigation, and wallet revenue without sending prompts, chat content, contact data, or full private URLs.

## Acceptance criteria

- [x] Yandex initializes with the enabled `dataLayer` ecommerce container.
- [x] Successful wallet top-ups produce a deduplicated purchase event with RUB revenue and an opaque payment ID.
- [x] Canonical landing CTA, scroll-depth, and product activation events are available for funnel reports.
- [x] Existing detailed events remain available; no PII or user-authored text is added.
- [x] Focused tests, type-check, build, and diff checks pass.

## Scope

- Extend the existing Airis analytics adapter; do not add dependencies or a second provider.
- Add only high-value events that can be acted on in Yandex reports.
- Keep Google Analytics disabled; its build-time slot remains empty.

## Privacy and rollback

- Consent remains opt-in; provider calls remain no-ops when denied or unconfigured.
- Ecommerce fields use static product labels, amount, currency, and opaque payment ID only.
- Rollback: remove the Yandex build ID or revert the adapter changes; product behavior is unaffected.

## Verification

- Unit tests cover canonical CTA mapping and ecommerce payload shape.
- `npm run check`, `npm run build:vite`, targeted ESLint, and `git diff --check`.
- Yandex UI confirms ecommerce/dataLayer and the existing JS goals.

## Completed

- Yandex counter `111392024` now contains 11 goals, including `landing_cta_click`, `billing_topup_payment_created`, `page_scroll_depth`, `contact_form_submit`, and `onboarding_completed`.
- Google remains disabled: `PUBLIC_GA_MEASUREMENT_ID` is intentionally empty.
