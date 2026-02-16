### In progress

### Done

- [x] **[REFACTOR][TESTS]** Remove Ollama upload tests from default suite
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__refactor__remove-ollama-tests.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/refactor/remove-ollama-tests`
  - Done: 2026-02-16
  - Summary: Removed Ollama upload route/helper tests at owner request because Ollama is not used in active deployment.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_images_verify_url_async.py open_webui/test/apps/webui/routers/test_images_billing.py"`
  - Risks: Medium (if Ollama is enabled later, upload path will have reduced regression coverage).
