# Fix STT transcription file descriptor lifecycle in OpenAI branch

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/audio-transcription-close-fd
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

Code review identified a resource-management issue in `backend/open_webui/routers/audio.py`:
the OpenAI STT path opens the uploaded audio file inline inside `requests.post(...)` and does
not explicitly close the file handle.

Under retries/fallbacks this can accumulate descriptors and increase FD/memory pressure.

## Goal / Acceptance Criteria

- [x] OpenAI STT transcription path always closes opened file descriptors.
- [x] Regression test fails on old behavior and passes with the fix.
- [x] No behavior/API changes for successful transcription flow.

## Non-goals

- Migration of STT route from `requests` to async HTTP client.
- Broader refactor of `audio.py`.

## Scope (what changes)

- Backend:
  - Update file-open lifecycle in `transcription_handler` (`openai` STT branch).
  - Add focused regression test for file descriptor closure.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/audio.py`
  - `backend/open_webui/test/util/test_audio_transcription_handler.py`
- API changes:
  - None.
- Edge cases:
  - Keep existing language fallback behavior (`language` then `None`) intact.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/routers/audio.py`
- Why unavoidable:
  - Bug exists in route implementation; fix must be at call site that opens file.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal local patch in the affected block + additive test file.

## Verification

Docker Compose-first commands (adjust if needed):

- Targeted backend tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_audio_transcription_handler.py"` ✅
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_audio_billing.py"` ✅

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][AUDIO][STT]** Close file descriptors in OpenAI transcription path
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__audio-transcription-close-file-handle.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/audio-transcription-close-fd`
  - Started: 2026-02-16
  - Summary: Prevent leaked file descriptors when OpenAI STT multipart upload retries/fallbacks.
  - Tests: pending
  - Risks: Low (localized resource-lifecycle fix).

## Risks / Rollback

- Risks:
  - Low; localized to OpenAI STT file-open scope.
- Rollback plan:
  - Revert changes in `audio.py` and test file.
