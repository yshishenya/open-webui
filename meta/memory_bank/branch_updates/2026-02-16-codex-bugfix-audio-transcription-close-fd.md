### In progress

### Done

- [x] **[BUG][AUDIO][STT]** Close file descriptors in OpenAI transcription path
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__audio-transcription-close-file-handle.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/audio-transcription-close-fd`
  - Done: 2026-02-16
  - Summary: Wrapped OpenAI STT upload file in context manager so file descriptors are closed after each attempt/fallback; added regression test to lock this behavior.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_audio_transcription_handler.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_audio_billing.py"`
  - Risks: Low (localized resource-lifecycle fix).
