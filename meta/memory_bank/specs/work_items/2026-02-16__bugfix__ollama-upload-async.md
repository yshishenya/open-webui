# Make Ollama model upload path async-safe

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/ollama-upload-async
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

`/ollama/models/upload` is an async route but the critical path still used blocking operations:

- synchronous upload persistence via `file.file.read(...)` and `open(..., "wb")`
- blocking `requests.post(...)` calls to Ollama `/api/blobs` and `/api/create`

Large files and slow upstream responses can block the event loop and degrade responsiveness.

## Goal / Acceptance Criteria

- [x] Remove event-loop blocking from Ollama upload persistence and upstream HTTP calls.
- [x] Preserve route behavior and SSE contract for success/error.
- [x] Add regression tests for helper behavior and route-level success/failure paths.

## Non-goals

- No broad refactor of all Ollama router paths in one PR.
- No API contract changes for `/ollama/models/upload`.

## Scope (what changes)

- Backend:
  - Add async-safe helper module for Ollama upload persistence and upstream calls.
  - Update `upload_model` route to use helper module and offload hash calculation.
  - Add helper tests and router integration tests.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/airis/ollama_upload.py`
  - `backend/open_webui/routers/ollama.py`
  - `backend/open_webui/test/util/test_ollama_upload.py`
  - `backend/open_webui/test/apps/webui/routers/test_ollama_upload_async.py`
- API changes:
  - None (same endpoint and streaming response format).
- Edge cases:
  - Blob upload failure still emits SSE error payload and avoids model create call.
  - Model create failure still emits SSE error payload.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/ollama.py`
- Why unavoidable:
  - Upload route implementation lives in upstream-owned router.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Added fork-owned helper module in `utils/airis` and updated router with localized calls.
  - No unrelated refactors in router.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && black --check open_webui/utils/airis/ollama_upload.py open_webui/test/util/test_ollama_upload.py open_webui/test/apps/webui/routers/test_ollama_upload_async.py && pytest -q open_webui/test/util/test_ollama_upload.py open_webui/test/apps/webui/routers/test_ollama_upload_async.py"` ✅
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/utils/airis/ollama_upload.py backend/open_webui/test/util/test_ollama_upload.py backend/open_webui/test/apps/webui/routers/test_ollama_upload_async.py"` ✅

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][ASYNC][OLLAMA]** Make `/ollama/models/upload` non-blocking for file persist + upstream calls
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__ollama-upload-async.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/ollama-upload-async`
  - Done: 2026-02-16
  - Summary: Moved blocking upload persistence and Ollama HTTP calls to async-safe helpers and added route/helper regression coverage.
  - Tests: see Verification section.
  - Risks: Low-Medium (upload route hot path change; contract preserved by route tests).

## Risks / Rollback

- Risks:
  - Low-Medium; route internals changed but output contract kept intact and tested.
- Rollback plan:
  - Revert helper integration in `routers/ollama.py` and remove helper/tests/spec entries.
