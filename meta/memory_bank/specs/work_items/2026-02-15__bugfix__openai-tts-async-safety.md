# OpenAI TTS Route: Async Safety + Atomic Cache Writes

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/openai-tts-async-safety
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

`POST /openai/audio/speech` is an `async def` route, but it currently:

- Performs a blocking `requests.post(..., stream=True)` call directly in the event loop.
- Writes the streamed bytes to `CACHE_DIR/audio/speech/<sha>.mp3` synchronously in the event loop.
- Writes directly to the final cache path, which risks leaving a partial `.mp3` file on failures; subsequent calls can treat it as a valid cache hit and settle billing incorrectly.

This is a correctness + resilience risk for production (head-of-line blocking under load) and for billing integrity (partial cache == false cache hit).

## Goal / Acceptance Criteria

- [ ] No blocking network call in the event loop for OpenAI TTS route (offload `requests` usage).
- [ ] Cache writes are atomic (write to temp, then rename/replace on success) so failures never create a false cache hit.
- [ ] Request includes a finite timeout.
- [ ] Existing billing tests for OpenAI speech remain green.

## Non-goals

- Full migration of this route from `requests` to `httpx`/`aiohttp` (keep diff minimal to reduce risk and preserve existing test patching).
- Broad refactors of other routers that still use `requests`.

## Scope (what changes)

- Backend:
  - Update `backend/open_webui/routers/openai.py` TTS handler to:
    - run blocking HTTP + file writes via `asyncio.to_thread`
    - add timeout
    - write `.mp3` and `.json` cache files atomically
- Tests:
  - No new tests required if existing billing tests cover the regression; ensure the current suite continues to validate billing settle/release semantics.

## Implementation Notes

- Use a small sync helper (closure) executed via `await asyncio.to_thread(...)` to keep the async route readable.
- Use `*.tmp` files in the same directory and `Path.replace(...)` for atomic replace.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/openai.py`
- Why unavoidable:
  - The bug is in the router itself (blocking I/O + non-atomic cache write).
- Minimization strategy:
  - Constrain changes to the smallest possible block inside the route; no reformatting or unrelated refactors.

## Verification

- Backend tests: `npm run docker:test:backend`
- Billing confidence: `npm run billing:confidence:merge-medium`
- Targeted: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_speech_billing.py"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Make OpenAI TTS route async-safe and cache writes atomic
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__openai-tts-async-safety.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/openai-tts-async-safety`
  - Started: 2026-02-15
  - Summary: Offload blocking HTTP/file work and prevent partial cache files from being treated as hits.
  - Tests: pending
  - Risks: Low-medium; touches a production router, but change is localized and covered by billing tests.

## Risks / Rollback

- Risks:
  - Thread offloading increases threadpool utilization under heavy TTS traffic; still preferable to blocking the event loop.
  - Timeout value must be compatible with upstream latency.
- Rollback plan:
  - Revert this commit; behavior returns to previous sync-in-async implementation.
