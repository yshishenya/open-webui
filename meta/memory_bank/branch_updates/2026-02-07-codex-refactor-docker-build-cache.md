# Branch updates: codex/refactor/docker-build-cache

- [x] **[DEV][DOCKER]** Speed up Docker builds by fixing cache busting + avoiding cache-destructive pruning
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__refactor__docker-build-cache-speed.md`
  - Owner: Codex
  - Branch: `codex/refactor/docker-build-cache`
  - Done: 2026-02-07
  - Summary: Reduce unnecessary rebuilds/downloads by narrowing frontend build COPY inputs, splitting Pyodide fetch, and preserving Docker caches in helper scripts.
  - Tests: `docker build --target build ...` (cache checks: repeat build is cached; changing `BUILD_HASH` keeps `npm ci` + `pyodide:fetch` cached)
  - Risks: Low (build-time only; no runtime logic changes)
