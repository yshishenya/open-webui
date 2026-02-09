# Auth: Fix Social Providers UI (Telegram/VKID/OK/Mail)

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/auth-social-providers-ui
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-09
- Updated: 2026-02-09

## Context

After recent `/auth` UI updates, social login UX regressed:

- Telegram required an extra step (open panel, then click widget button), and in some cases the widget button was not clickable.
- VK ID showed an "auth error" toast immediately when opening the widget (before any user interaction).
- OK.ru and Mail.ru logins were buried under the VK ID widget instead of being visible alongside other providers.
- VK provider icon had a visible white background on dark UI.

## Goal / Acceptance Criteria

- [ ] Telegram is a single-click auth action from the provider icon row (no extra Telegram panel/button).
- [ ] Opening VK ID widget does not show an error toast until the user interacts with the widget.
- [ ] OK.ru and Mail.ru are visible in the top provider icon row and open VK ID with the corresponding alternative login option.
- [ ] VK icon is displayed without a white background and without distortion.

## Non-goals

- Implementing new OAuth providers.
- Changing backend auth logic or account-linking rules.
- Redesigning non-auth pages.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - `/auth` provider row: Telegram becomes one-click; OK/Mail moved to top row; VK uses transparent/official icon; widget rendering simplified.
  - VKID widget: suppress error toast until user interaction.
  - Telegram widget: allow targeting its internal container for layout/CSS purposes.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/auth/VKIDWidget.svelte`
  - `src/lib/components/auth/TelegramLoginWidget.svelte`
  - `static/static/brand/*` (+ `static/static/brand/SOURCES.md`)
- Edge cases:
  - Telegram widget is cross-origin; "one-click" is implemented by overlaying the official widget iframe (invisible) over our icon, so the click goes directly to Telegram.
  - VK ID can emit init-time errors; we suppress toast spam until a user interacts with the widget container.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/auth/VKIDWidget.svelte`
  - `src/lib/components/auth/TelegramLoginWidget.svelte`
- Why unavoidable:
  - These components implement the login UI and widget integrations.
- Minimization strategy:
  - Keep changes localized to auth UI blocks and widget error handling; store brand assets locally.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend build (Vite): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][AUTH][UI]** Fix `/auth` social providers row (Telegram/VKID/OK/Mail)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__bugfix__auth-social-providers-ui.md`
  - Owner: Codex
  - Branch: `codex/bugfix/auth-social-providers-ui`
  - Started: 2026-02-09
  - Summary: Make Telegram one-click from icon row, expose OK/Mail icons, suppress VKID init error toast, and switch to non-white VK icon.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
  - Risks: Low (UI-only; verify provider buttons in prod).

## Risks / Rollback

- Risks:
  - Telegram iframe overlay styling could regress if Telegram widget changes its internal iframe sizing.
- Rollback plan:
  - Revert the `/auth` provider row changes and restore the previous Telegram/VK panels.
