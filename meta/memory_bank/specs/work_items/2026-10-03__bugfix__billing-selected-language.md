# Respect selected AIRIS language in money and dates

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/billing-selected-language`
- SDD Spec: `meta/sdd/specs/completed/airis-billing-selected-language-2026-10-03-001.json`
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

## Full wallet switching correction

Browser acceptance on the first SHA-tagged candidate exposed a second indirect dependency: timeline changed correctly, but wallet total, package display and repeat amount retained the previous locale. Added a real-i18next page regression; before the correction 16 tests passed and the new switching test failed. Afterward all 17 wallet tests passed, with one balance fetch and no payment creation.

The selected locale is now an explicit formatter argument at 55 calls across 14 affected caller files, including nested formatOptionalDate forwarding. Intl formatters accept a typed locale parameter; defaults retain existing script callers. This avoids hidden template dependencies, preserves amounts and dates, and keeps the existing component layout. Browser acceptance and new immutable candidate required before release.

## Final implementation and production acceptance — 2026-10-03

- Final runtime source: `5408816725ad6d89c5c1f96cd920936dbb34294f`; PR187 merged as `ffbb23bd7229fa1ef9972f45022f438e73c5b285` after 10 successful exact-head checks. Dependency review skipped by CI; CodeRabbit review disabled for this base.
- Full Compose frontend suite: 208/208 in 47 files. Changed callers/tests/helper ESLint: zero messages. Global strict check: 4631 errors /179 warnings, 37 removed /0 added errors against baseline; full lint: 1548 errors, 52 fewer. Earlier counts above are historical.
- Candidate Russian → English → Russian switching updates wallet total, all packages, repeat amount, dates/time and credits without reload. Read-only balance stays 150000 kopeks /3 credits, zero payment creations.
- Production registry digest: `sha256:3bdfd3df987930b798f1907e705fd0b35918af433c15dd680210d38ea98df09c`. 5759 live frontend hashes match; 476 immutable backend hashes preserved; site.webmanifest matches frontend copy. ENV, mounts, networks, ports, command, restart policy and 13 neighboring container identities preserved; application healthy with zero restarts.
- Fresh backup, checksum/readability checks, hard migration gate and rollback image completed before recreation. Production public health/version and ordinary-account language switching accepted; no new financial operations requested.
- Global G14 /13.11 remains open: project-wide type/lint/Ruff debt and external product acceptance are separate obligations. Static general-settings and Never-reset translation text is a separate observed translation limitation.
