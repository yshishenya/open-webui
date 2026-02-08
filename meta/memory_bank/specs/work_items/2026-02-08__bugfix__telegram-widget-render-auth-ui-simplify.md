# [BUG][AUTH] Fix Telegram Widget Render + Simplify Auth UI

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: bugfix/auth-telegram-widget-ui
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-08
- Updated: 2026-02-08

## Context

After the `/auth` UI refresh, Telegram auth was visible but the actual Telegram Login Widget did not render.
In production, the browser console showed a `SyntaxError` in `telegram-widget.js`, and the auth screen displayed only the Telegram header/toggle without the real widget button.

The auth provider list also became visually noisy on mobile (stacked full-width providers + embedded widgets), making it harder to understand what is clickable.

## Goal / Acceptance Criteria

- [ ] Telegram Login Widget renders on `/auth` when `GET /api/config` reports `telegram.enabled=true` and a `telegram.bot_username`.
- [ ] Clicking the Telegram widget triggers the auth flow (state fetch + backend sign-in).
- [ ] Auth provider choice screen is simpler on mobile: primary provider button + compact provider icon row with optional expand panels.
- [ ] No regressions: VK ID alternatives (OK.ru / Mail.ru) remain visible.

## Non-goals

- Implement Telegram sign-up UX in `/auth` (sign-up remains available via other providers; Telegram sign-in still requires linking by design).
- Change backend Telegram auth verification / state handling.
- Fix VK ID redirect configuration issues (handled separately; this work focuses on UI wiring and Telegram widget execution).

## Scope (what changes)

- Backend:
  - None
- Frontend:
  - Fix Telegram widget callback naming so Telegram can execute `data-onauth` without syntax errors.
  - Simplify `/auth` provider UI to match a compact “primary + icon row” layout.
- Config/Env:
  - None
- Data model / migrations:
  - None

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/auth/TelegramLoginWidget.svelte`
  - `src/routes/auth/+page.svelte`
  - `src/lib/i18n/locales/ru-RU/translation.json`
  - `src/lib/utils/airis/auth_login_regressions.test.ts`
- Root cause (Telegram):
  - The widget callback name used `crypto.randomUUID()` which includes dashes (`-`), producing an invalid JS identifier in `data-onauth`, causing Telegram widget script to fail.
- Fix:
  - Sanitize UUID dashes to `_` for a valid function name.
  - Keep Telegram UX simple: icon toggle opens the widget; no extra sign-in/sign-up toggle buttons.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte` (auth choice UI)
  - `src/lib/components/auth/TelegramLoginWidget.svelte` (Telegram widget mount logic)
- Why unavoidable:
  - `/auth` and Telegram widget integration live in upstream UI layer; this is a direct regression fix.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Changes are localized: no component renames, no broad refactors, no styling churn outside `/auth`.

## Verification

- Frontend tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend build:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][AUTH]** Fix Telegram widget render + simplify auth provider UI
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__telegram-widget-render-auth-ui-simplify.md`
  - Owner: Codex
  - Branch: `bugfix/auth-telegram-widget-ui`
  - Started: 2026-02-08
  - Summary: Fix Telegram widget callback naming (prevents JS syntax error) and simplify `/auth` providers layout (primary button + icon row + expand panels).
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
  - Risks: Low (auth UI changes; requires manual smoke test on `/auth` in prod).

## Risks / Rollback

- Risks:
  - Auth choice UX changes could confuse users used to the old full-width buttons; mitigated by keeping the primary provider prominent.
  - Telegram widget still depends on external `telegram.org` script availability.
- Rollback plan:
  - Revert the UI changes in `src/routes/auth/+page.svelte` and the callback sanitization in `src/lib/components/auth/TelegramLoginWidget.svelte`.
