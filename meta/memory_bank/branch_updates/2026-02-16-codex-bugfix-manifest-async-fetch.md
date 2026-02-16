### In progress

### Done

- [x] **[BUG][ASYNC][MANIFEST]** Replace sync manifest fetch with async helper
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__manifest-async-fetch.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/manifest-async-fetch`
  - Done: 2026-02-16
  - Summary: Replaced blocking manifest fetch with async helper + timeout/error mapping, and added regression tests for upstream status/request/shape failures.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_manifest_fetch.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/utils/airis/manifest.py backend/open_webui/test/util/test_manifest_fetch.py"`
  - Risks: Low (localized route helper integration).
