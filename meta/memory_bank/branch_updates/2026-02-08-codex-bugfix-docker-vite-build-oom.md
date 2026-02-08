# Branch updates: codex/bugfix/docker-vite-build-oom

- [x] **[BUG][DEV][DOCKER]** Fix frontend Vite build OOM in Docker builds
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__docker-vite-build-oom.md`
  - Owner: Codex
  - Branch: `codex/bugfix/docker-vite-build-oom`
  - Done: 2026-02-08
  - Summary: Disable Vite sourcemaps by default in Docker builds (overrideable) to reduce peak memory and avoid Node heap OOM.
  - Tests: `docker build --target build ...`
  - Risks: Low (build-time only; sourcemap output changes in Docker images).

