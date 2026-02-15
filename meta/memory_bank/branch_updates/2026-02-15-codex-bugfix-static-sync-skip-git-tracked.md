### Done

- [x] **[BUG]** Skip frontend static sync for git-tracked static in source checkouts
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__static-sync-skip-git-tracked.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/static-sync-skip-git-tracked`
  - Done: 2026-02-15
  - Summary: Avoid wiping/copying into `backend/open_webui/static` by default when running from a git checkout.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_static_sync_guard.py"`, `npm run docker:test:backend`
  - Risks: Low (guard-only; no behavior change in Docker dev/test).
