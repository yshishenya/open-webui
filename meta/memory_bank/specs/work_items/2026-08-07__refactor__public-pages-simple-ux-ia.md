# Simplify public Airis pages UX / IA

## Meta

- Type: refactor
- Status: completed
- Owner: Codex
- Branch: codex/fix-wallet-topup-clarity
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/public-pages-simple-ux-2026-08-07-001.json`
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The shared public shell is now visually aligned with Airis, but the secondary pages still make users scan duplicated feature grids, technical pricing details, long legal pages, and inconsistent CTAs. The main `/welcome` page is intentionally out of scope; every other public route must provide a short, predictable path into the real product.

## Goal / Acceptance Criteria

- [x] A first-time visitor can understand the offer and reach Airis from `/features`, `/pricing`, `/about`, and `/contact` with one clear primary CTA.
- [x] `/features` is task-first: no duplicate grids/tabs, no unavailable image/audio claims, and every example CTA preserves the real prompt/preset path.
- [x] `/pricing` explains free start, RUB balance, and usage-based charging before advanced rates; unavailable media rates never render as `≈ —`.
- [x] `/about` and `/contact` are concise trust/support pages with truthful CTA and no false form-success state.
- [x] `/documents` groups user and business documents; nested legal pages have a consistent breadcrumb/back path and shared dark-violet shell.
- [x] All public internal links, CTA destinations, anchors, buttons, and mobile navigation paths are smoke-tested in production and in automated tests.
- [x] `/welcome` content and behavior are not modified except for shared navigation links pointing to it.
- [x] No new dependencies; existing design tokens and landing components are reused.

## Non-goals

- Rewriting `/welcome` content or its conversion experiments.
- Changing billing rules, model availability, auth APIs, or legal text semantics.
- Adding a new CMS, analytics vendor, or visual animation library.

## Scope (what changes)

- Frontend:
  - shared public navigation/footer/breadcrumb primitives and dark-violet tokens;
  - simplified `/features`, `/pricing`, `/about`, `/contact`, `/documents` and nested document presentation;
  - capability- and rate-card-aware visibility for examples and pricing blocks;
  - focused Playwright smoke coverage for routes, links, CTA redirects, tabs, accordions, and responsive layout.
- Backend: none.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Keep `/welcome` untouched; shared shell changes must preserve its existing handlers and analytics IDs.
- Use existing `welcomeNavigation.ts`, public rate-card and lead-magnet APIs, and existing icon/components.
- Guest CTA: signup with `redirect=/?src=...`; authenticated CTA: direct chat or billing balance as appropriate.
- Contact remains mailto-based; label it accurately and provide a copyable email fallback instead of pretending a backend submission succeeded.
- Final audit: public layout overflow was clipped at the shared shell after a 390px audit found decorative-layer spill.
- SEO/analytics audit: public routes are indexable with canonical/Open Graph metadata and sitemap coverage; private routes remain noindex; Yandex Metrica is loaded from `$env/static/public` only after consent.

## Upstream impact

- Upstream-owned files touched: public route files and landing components only.
- Why unavoidable: these are Airis-owned public surfaces and their route-specific copy/layout is the user-facing scope.
- Minimization strategy: shared primitives and data-driven guards; no backend or upstream API contract changes.

## Verification

- `git diff --check`
- focused Svelte/Vitest tests for public navigation/capability guards
- `npm run check` with changed-file diagnostics reviewed (baseline errors remain outside scope)
- `npm run build:vite`
- Public layout metadata now avoids duplicating the app-level description on marketing routes after hydration.
- Playwright production smoke across desktop (routes, CTAs, anchors, filters, pricing API, and links verified)
- Playwright local production-preview screenshot and 390px responsive audit
- Analytics consent smoke with Yandex Metrica script/request verification
- Robots, sitemap, canonical and Open Graph metadata verification

## Risks / Rollback

- Risks: route-specific copy can drift from live model/rate configuration; legal pages must remain complete.
- Rollback plan: revert the single feature branch/PR; no database or API migration is included.

## Completion Checklist

- [x] `meta/tools/sdd check-complete public-pages-simple-ux-2026-08-07-001 --json`
- [x] `meta/tools/sdd complete-spec public-pages-simple-ux-2026-08-07-001 --json`
- [x] Branch update moved to Done.
