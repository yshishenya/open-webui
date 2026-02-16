### In progress

### Done

- [x] **[BUG][ASYNC][IMAGES]** Make `verify_url` non-blocking in async route
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__images-verify-url-async.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/images-verify-url-async`
  - Done: 2026-02-16
  - Summary: Replaced sync `requests.get` URL checks with `httpx.AsyncClient` in the async image verify route while preserving status/error contract and disable flag behavior.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_images_verify_url_async.py open_webui/test/apps/webui/routers/test_images_billing.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/test/apps/webui/routers/test_images_verify_url_async.py"`
  - Risks: Low (localized transport-layer change in admin verification endpoint).
