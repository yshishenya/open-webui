### In progress

### Done

- [x] **[BUG][ASYNC][OLLAMA]** Make `/ollama/models/upload` non-blocking for file persist + upstream calls
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__ollama-upload-async.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/ollama-upload-async`
  - Done: 2026-02-16
  - Summary: Added async-safe upload helpers and switched Ollama upload route to avoid blocking file persist + upstream HTTP in the event loop, with helper and route regression tests.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && black --check open_webui/utils/airis/ollama_upload.py open_webui/test/util/test_ollama_upload.py open_webui/test/apps/webui/routers/test_ollama_upload_async.py && pytest -q open_webui/test/util/test_ollama_upload.py open_webui/test/apps/webui/routers/test_ollama_upload_async.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/utils/airis/ollama_upload.py backend/open_webui/test/util/test_ollama_upload.py backend/open_webui/test/apps/webui/routers/test_ollama_upload_async.py"`
  - Risks: Low-Medium (upload hot path changed, but API/SSE behavior preserved and covered).
