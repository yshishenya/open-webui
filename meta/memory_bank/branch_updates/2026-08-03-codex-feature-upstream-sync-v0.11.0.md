# Branch Update: codex/feature/upstream-sync-v0.11.0

- [x] **[UPSTREAM]** Sync Airis with Open WebUI v0.11.0
  - Spec: `meta/memory_bank/specs/work_items/2026-08-03__feature__open-webui-v0.11.0-upstream-sync.md`
  - Owner: Codex
  - Branch: `codex/feature/upstream-sync-v0.11.0`
  - Started: 2026-08-03
  - Done: 2026-08-03
  - Summary: Integrated and deployed official Open WebUI v0.11.0 while preserving Airis billing/auth/chat behavior, producing one migration head, and retaining a verified source/image/database rollback path.
  - Tests: 90 backend utility/service tests and 87 frontend tests passed; Black and focused Ruff passed; fresh and production-clone migrations passed; final Docker image, authenticated API smoke, production data-count comparison, and desktop/mobile Playwright passed.
  - Deployment: Production runs `yshishenya/yshishenya:v0.11.0-airis-20260803` (`sha256:97b7929b...`) at Alembic head `a91c0d8e4f62`; rollback backup is `/opt/projects/.backups/airis/20260803-185252-open-webui-v0.11.0/`.
  - Follow-up: Modernize the legacy synchronous router-test harness for v0.11 async model APIs and reduce inherited full-repository lint/typecheck debt.
