# Branch updates: codex/bugfix/docker-vite-build-oom

- [x] **[BUG][DEV][DOCKER]** Fix frontend Vite build OOM in Docker builds
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__docker-vite-build-oom.md`
  - Owner: Codex
  - Branch: `codex/bugfix/docker-vite-build-oom`
  - Done: 2026-02-08
  - Summary: Raise Node heap limit for the frontend Docker build stage and disable Vite sourcemaps by default (overrideable) to avoid `vite build` OOM.
  - Tests: `docker build --target build ...`
  - Risks: Low (build-time only; sourcemap output changes in Docker images).
