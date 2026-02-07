# Branch updates: codex/refactor/minimize-upstream-conflicts-auth-bootstrap

### In progress

- [ ] **[REFACTOR][UPSTREAM]** Minimize upstream conflict surface (auths/main bootstrap hooks)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__refactor__minimize-upstream-conflicts-auth-bootstrap.md`
  - Owner: Codex
  - Branch: `codex/refactor/minimize-upstream-conflicts-auth-bootstrap`
  - Started: 2026-02-07
  - Summary: Extract Airis auth endpoints + app bootstrap into fork-owned modules; keep upstream files as thin hooks to reduce merge conflicts.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -e DATABASE_URL= airis bash -lc 'pytest -q open_webui/test/apps/webui/routers/test_auths.py open_webui/test/util/test_telegram_auth.py open_webui/test/apps/webui/routers/test_legal.py'`
  - Risks: Medium (auth routes + config payload)
