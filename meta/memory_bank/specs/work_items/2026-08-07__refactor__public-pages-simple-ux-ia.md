# Simplify public Airis pages UX / IA

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/feature/public-pages-simplify
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/simplify-public-airis-pages-ux-2026-08-07-1752.json`
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
- [ ] All public internal links, CTA destinations, anchors, buttons, and mobile navigation paths are smoke-tested in production and in automated tests.
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

## Upstream impact

- Upstream-owned files touched: public route files and landing components only.
- Why unavoidable: these are Airis-owned public surfaces and their route-specific copy/layout is the user-facing scope.
- Minimization strategy: shared primitives and data-driven guards; no backend or upstream API contract changes.

## Verification

- `git diff --check`
- focused Svelte/Vitest tests for public navigation/capability guards
- `npm run check` with changed-file diagnostics reviewed (baseline errors remain outside scope)
- Playwright production smoke across desktop and 390px mobile (production audit completed; new branch smoke pending)
- manual in-app-browser click-through with screenshot evidence

## Risks / Rollback

- Risks: route-specific copy can drift from live model/rate configuration; legal pages must remain complete.
- Rollback plan: revert the single feature branch/PR; no database or API migration is included.

## Completion Checklist

- [ ] `meta/tools/sdd check-complete simplify-public-airis-pages-ux-2026-08-07-1752 --json`
- [ ] `meta/tools/sdd complete-spec simplify-public-airis-pages-ux-2026-08-07-1752 --json`
- [ ] Branch update moved to Done.
