# Make `/images/config/url/verify` non-blocking in async route

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/images-verify-url-async
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

`/api/v1/images/config/url/verify` is an async route but used blocking `requests.get(...)` for
Automatic1111 and ComfyUI checks. This can block the event loop under upstream latency and reduce
admin responsiveness.

## Goal / Acceptance Criteria

- [x] Remove blocking sync HTTP from `verify_url`.
- [x] Preserve existing route behavior and error contract (`400 INVALID_URL` + disable flag).
- [x] Add regression tests for success/error/header behavior.

## Non-goals

- No broad migration of all image router network calls in one PR.
- No changes to billing/image generation behavior.

## Scope (what changes)

- Backend:
  - Update `verify_url` to use `httpx.AsyncClient`.
  - Add focused integration tests for route behavior.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/images.py`
  - `backend/open_webui/test/apps/webui/routers/test_images_verify_url_async.py`
- API changes:
  - None (same status codes/details; internal transport changed to async).
- Edge cases:
  - Automatic1111 request failure disables `ENABLE_IMAGE_GENERATION`.
  - ComfyUI auth header forwarding preserved.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/images.py`
- Why unavoidable:
  - Route implementation is upstream-owned.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal localized edit to one route block; no unrelated refactors.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_images_verify_url_async.py"` ✅
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/test/apps/webui/routers/test_images_verify_url_async.py"` ✅
- Note: `ruff check backend/open_webui/routers/images.py` reports pre-existing file-level issues unrelated to this change.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][ASYNC][IMAGES]** Make `verify_url` non-blocking in async route
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__images-verify-url-async.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/images-verify-url-async`
  - Done: 2026-02-16
  - Summary: Replaced sync `requests.get` calls with async `httpx` in image URL verification and added regression tests.
  - Tests: see Verification section.
  - Risks: Low (localized route network transport change).

## Risks / Rollback

- Risks:
  - Low; only verification endpoint path touched.
- Rollback plan:
  - Revert route block in `images.py` and remove new tests/spec entries.
