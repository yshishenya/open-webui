# [BUG][AUTH] VKID Direct Login + Telegram Hitbox + Official Yandex/VK Icons

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/auth-vkid-direct-login
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-09
- Updated: 2026-02-09

## Context

After recent `/auth` UI updates, a few issues remain:

- Telegram icon hitbox is inconsistent (not the entire icon is clickable).
- VK / OK / Mail.ru flows require opening an embedded VKID widget panel and can show an authorization error before any user intent.
- Yandex icon is currently a placeholder (not the official asset).
- VK icon background/artwork does not match the desired icon style (needs a transparent/standalone mark).

These issues reduce conversion and create support burden.

## Goal / Acceptance Criteria

- [ ] Telegram provider icon is fully clickable across its whole circle on mobile/desktop.
- [ ] Clicking VK / OK / Mail.ru icons triggers VKID authorization immediately (no intermediate “menu/panel” click).
- [ ] VKID flow no longer shows an error toast before user interaction.
- [ ] Yandex and VK icons use official brand assets stored locally under `static/static/brand/`.
- [ ] Provider icons preserve aspect ratio (no stretching).

## Non-goals

- Changing backend OAuth logic beyond what’s required to restore working sign-in.
- Adding new third-party dependencies.

## Scope (what changes)

- Backend:
  - None expected.
- Frontend:
  - `/auth` UI event flow for VKID providers (VK/OK/Mail) and Telegram widget hitbox CSS.
  - Add a small Airis-owned VKID helper to keep upstream diffs minimal.
- Config/Env:
  - None (uses existing config values).
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/auth/TelegramLoginWidget.svelte`
  - `src/lib/utils/airis/vkid.ts` (new)
  - `static/static/brand/*` (new/updated icons)
- API changes:
  - None.
- Edge cases:
  - Popup blockers: VKID should still work by using an SDK-supported window/tab mode tied to the click gesture.
  - VKID config init should be idempotent to avoid multiple initializations when clicking different icons.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/auth/TelegramLoginWidget.svelte`
- Why unavoidable:
  - `/auth` is an upstream route; the UI and event bindings live there.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Move VKID direct-login logic into `src/lib/utils/airis/vkid.ts` and call it from `/auth`.
  - Keep UI diffs focused: small CSS fixes + icon swap + click handlers.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend build: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][AUTH]** VKID direct login + Telegram hitbox + official Yandex/VK icons on `/auth`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__bugfix__auth-vkid-direct-login-telegram-hitbox-yandex-icons.md`
  - Owner: Codex
  - Branch: `codex/bugfix/auth-vkid-direct-login`
  - Started: 2026-02-09
  - Summary: Fix Telegram icon click area, make VK/OK/Mail one-click via VKID.Auth.login, and swap in official icons.
  - Tests: Pending
  - Risks: Low-Medium (auth UX flow touches; needs smoke test on mobile + VKID popup behavior).

## Risks / Rollback

- Risks:
  - VKID SDK login mode differences across browsers (popup blockers).
  - Minor layout regressions in `/auth` provider row.
- Rollback plan:
  - Revert the `/auth` VKID click handler changes and restore the previous VKID widget panel flow.
