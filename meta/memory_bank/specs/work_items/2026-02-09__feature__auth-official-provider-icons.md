# Auth: Official Provider Icons on /auth

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/auth-provider-official-icons
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-09
- Updated: 2026-02-09

## Context

The `/auth` page currently uses letter-based placeholders for Telegram/VK provider icons (e.g. "TG", "VK").
This looks non-official and inconsistent with common login UIs. The goal is to replace placeholders with
official brand icons sourced from providers' official brand resources.

## Goal / Acceptance Criteria

- [ ] Telegram, VK, GitHub icons on `/auth` use official brand assets (not custom-drawn text placeholders).
- [ ] Assets are stored locally in the repo (no runtime external fetch for icons).
- [ ] No new dependencies added.
- [ ] `/auth` remains functional (provider buttons still work; Telegram widget still loads in expanded panel).

## Non-goals

- Full `/auth` redesign.
- Adding new auth providers.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Add official brand assets under `static/static/brand/`.
  - Update `/auth` provider icon buttons to render these assets.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/auth/+page.svelte` (provider icon buttons)
  - `static/static/brand/*` (brand assets)
- Sources (official):
  - Telegram: `https://telegram.org/img/t_logo.svg`
  - GitHub: `https://brand.github.com/` (GitHub_Logos.zip, Invertocat white SVG)
  - VK: `https://vk.com/brand` (brand assets)

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
- Why unavoidable:
  - The icons are rendered directly in the `/auth` route markup.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes to a small, localized replacement of icon markup.
  - Add brand assets as new files (additive).

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend build: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[UI][AUTH]** Use official provider icons on `/auth`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__feature__auth-official-provider-icons.md`
  - Owner: Codex
  - Branch: `codex/feature/auth-provider-official-icons`
  - Started: 2026-02-09
  - Summary: Replace placeholder TG/VK icons with official brand assets (Telegram/VK/GitHub) stored locally.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
  - Risks: Low (UI-only; verify assets load + icons align on mobile).

## Risks / Rollback

- Risks:
  - Brand assets/trademark guidelines: keep assets unmodified, sourced from official provider pages.
  - Visual regressions on dark backgrounds (contrast/alignment).
- Rollback plan:
  - Revert the icon asset + markup changes in `/auth`; fallback to prior placeholder letters.

