# Branch Updates: codex/bugfix/auth-social-providers-ui

- [ ] **[BUG][AUTH][UI]** Fix `/auth` social providers row (Telegram/VKID/OK/Mail)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__bugfix__auth-social-providers-ui.md`
  - Owner: Codex
  - Branch: `codex/bugfix/auth-social-providers-ui`
  - Started: 2026-02-09
  - Summary: Make Telegram one-click from icon row, expose OK/Mail icons, suppress VKID init error toast, and switch to non-white VK icon.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
  - Risks: Low (UI-only; verify provider buttons in prod).
