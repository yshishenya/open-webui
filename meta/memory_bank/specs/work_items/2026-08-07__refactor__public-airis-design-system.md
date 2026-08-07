# Centralize Airis public-page design system

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/redesign/public-pages
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/public-airis-design-system-2026-08-07-001.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

`/welcome` already uses the current Airis dark-violet visual language, while the remaining public and legal routes use independent light gray/black utility styles. That makes the navigation, CTA hierarchy, typography, surfaces, and footer feel like different products. A route audit also found that `PublicPageLayout` did not pass its tone to `FooterLinks`, so the footer could silently use the wrong theme.

## Goal / Acceptance Criteria

- [x] Define one scoped Airis token layer for public pages (deep violet canvas, lavender accent, readable muted text, consistent borders and motion).
- [x] Use the same navigation, CTA, focus, footer, and brand spelling (`Airis`) on all public/legal routes.
- [x] Preserve real product screenshots, route behavior, API-backed pricing/model data, and legal copy.
- [x] Keep intentional product UI contrast (dark screenshots/cards) without leaking public styles into the app shell.
- [x] Smoke-test `/welcome`, marketing pages, the document index, canonical legal routes, and nested documents.

## Non-goals

- No new dependencies, API changes, copy claims, legal-text edits, or auth-flow rewrite in this pass.
- No redesign of authenticated chat/admin screens beyond the scoped shared public components.

## Scope (what changes)

- Backend: none.
- Frontend: shared `publicTheme.css`, `PublicPageLayout`, `NavHeader`, and `FooterLinks`.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- `publicTheme.css` is imported once from `src/app.css` and is scoped to `.airis-public-page` plus shared public nav/footer classes.
- The route markup remains intentionally stable; centralized selectors normalize legacy gray/white surfaces and keep public pages on the same deep-violet canvas.
- `PublicPageLayout` now defaults to the shared dark tone, passes `tone` into `FooterLinks`, and uses `Airis` in metadata/copyright.
- `NavHeader` uses semantic shared classes for desktop/mobile links and primary actions while retaining existing auth redirect and analytics behavior.

## Upstream impact

- Upstream-owned frontend components touched: `PublicPageLayout.svelte`, `NavHeader.svelte`, and `FooterLinks.svelte`.
- Why unavoidable: these are the existing public shell boundaries used by every marketing/legal route.
- Minimization strategy: additive scoped CSS plus small class/prop changes; route content and app/admin styling are untouched.

## Verification

- `git diff --check`
- `npm run check` (currently reports pre-existing repository-wide type errors; no new diagnostics in the changed shell files)
- `npm run build:vite` (currently reaches chunk rendering but exceeds the local Node heap; rerun with an increased heap in CI/local verification)
- In-app browser smoke test at 1280px: `/welcome`, `/features`, `/pricing`, `/about`, `/contact`, `/documents`, `/terms`, `/privacy`, and all six nested document routes.

## Risks / Rollback

- Risks: global public selectors could affect a new marketing component if it is not nested in `.airis-public-page`; intentional contrast surfaces should keep explicit arbitrary colors.
- Rollback plan: revert the scoped theme import and the three shell component diffs; route behavior and content remain unchanged.

## Completion Checklist

- [x] `meta/tools/sdd check-complete public-airis-design-system-2026-08-07-001 --json`
- [x] `meta/tools/sdd complete-spec public-airis-design-system-2026-08-07-001 --json`
- [x] Branch update entry moved to `Done` with required fields.
