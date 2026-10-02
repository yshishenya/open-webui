# Respect selected AIRIS language in money and dates

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/billing-selected-language`
- SDD Spec: `meta/sdd/specs/active/airis-billing-selected-language-2026-10-03-001.json`
- Created: 2026-10-03 (Europe/Istanbul)

## Context

Billing formatters read nonexistent i18next.locale. Intl receives undefined and silently uses the browser environment. The UI can show English translations with Russian dates/money. The strict check reports thirty invalid locale accesses.

## Goal / Acceptance Criteria

- [x] A component test using actual i18next language state fails before the fix when app language differs from the environment.
- [x] Money, dates and numeric quotas use the actual resolved translation language, selected language fallback, then the application default en-US.
- [x] Switching English/Russian updates the existing UI without fetching or changing financial facts.
- [x] No runtime i18n.locale references remain; no new type/lint messages from changed caller locations.
- [x] Full frontend tests and strict checks run; existing unrelated debt is retained explicitly.

## Implementation

A small fork-owned helper reads supported i18next language properties. Narrow imports/calls replace the invalid property in existing formatters. No provider, monetary arithmetic, API, quota, persistence or backend change.

## Dependency compatibility

Existing lockfile i18next23.16.8; live npm registry latest stable26.4.2. No dependency is introduced or replaced. resolvedLanguage (since21) and language are verified in official API docs and pinned23.16.8 declarations. Retain the existing version to isolate the presentation bug; the major upgrade requires a separate task verifying translation resource loading, plugins, custom type declarations and all language flows before changing the lockfile. Official sources: https://www.i18next.com/overview/api and https://raw.githubusercontent.com/i18next/i18next/v23.16.8/index.d.ts .

## Upstream impact

Only narrow imports and formatter arguments in billing components/pages and related wallet access/blocked-modal/channel counters. List exact touched files from the final diff. No component restructuring or unrelated formatting.

## Verification / Rollback

Compose regression/full frontend tests, strict check and full lint; focused checks; exact candidate browser language mismatch/switching and immutable release proof. Roll back the frontend image on presentation regression; database unchanged. The global G14/13.11 remains open until all required project and product checks pass.

## Implementation verification — 2026-10-03

- Initial actual-i18next/environment mismatch regression: 6 passed / 1 failed before the formatter fix.
- Explicit store dependency updates timeline day labels/titles; header passes the selected locale into its reactive balance label. Both language-switch tests assert one API fetch and unchanged amounts.
- Real LedgerEntry fixture is checked with `satisfies LedgerEntry`. Existing unsupported Vitest virtual arguments in the two modified tests removed.
- Compose full frontend suite: 207 tests in 47 files passed. Focused ESLint passed. Strict check: 4668 → 4631 errors, 215 warnings unchanged; per-file/message comparison confirms 37 removed and 0 new errors.
- Full frontend lint retains 1600 existing errors. No rules or dependencies changed. Backend tests/format are not applicable to this presentation-only diff.
- Candidate browser, immutable image proof, production release and live acceptance remain pending and are tracked separately; implementation verification does not close G14.

### Exact upstream impact

- `src/lib/components/admin/billing/PlanForm.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/airis/BillingBlockedModal.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/airis/HeaderBillingAccess.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/airis/HeaderBillingAccess.test.ts` — narrow language formatter/import or regression test.
- `src/lib/components/billing/UnifiedTimeline.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/billing/UnifiedTimeline.test.ts` — narrow language formatter/import or regression test.
- `src/lib/components/billing/WalletAutoTopupSection.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/billing/WalletLeadMagnetSection.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/billing/WalletSpendControls.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/billing/WalletTopupSection.svelte` — narrow language formatter/import or regression test.
- `src/lib/components/layout/Sidebar/ChannelItem.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/admin/billing/plans/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/admin/billing/plans/[id]/analytics/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/admin/billing/plans/[id]/edit/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/admin/billing/plans/[id]/subscribers/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/admin/billing/plans/new/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/billing/balance/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/billing/dashboard/+page.svelte` — narrow language formatter/import or regression test.
- `src/routes/(app)/billing/plans/+page.svelte` — narrow language formatter/import or regression test.

## CI caller debt corrections

The first PR CI frontend job rejected 52 preexisting violations in touched caller files. Corrected them rather than weakening the gate: connect 30 admin field labels to their actual input/select/textarea controls; close non-void textarea/div tags; add two icon-button accessible names; remove unused imports/dispatcher; replace explicit any/function types in touched code with bounded types and unknown guards.

All changed caller/test/helper files now pass ESLint with 0 messages. Full frontend suite remains 207/207. Strict check remains 4631 errors, warnings reduced 215 → 179. Final whole-project lint count recorded separately; global G14 remains open. Browser independently reproduced English (US) interface with Russian timeline labels on the previous candidate.
