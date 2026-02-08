# Branch Updates: bugfix/auth-telegram-widget-ui

- [x] **[BUG][AUTH]** Fix Telegram widget render + simplify auth provider UI
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__telegram-widget-render-auth-ui-simplify.md`
  - Owner: Codex
  - Branch: `bugfix/auth-telegram-widget-ui`
  - Done: 2026-02-08
  - Summary: Fix Telegram widget callback naming (prevents JS syntax error) and simplify `/auth` providers layout (primary button + icon row + expand panels).
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
  - Risks: Low (auth choice UX tweaks; smoke test Telegram + VK ID expand in prod).

