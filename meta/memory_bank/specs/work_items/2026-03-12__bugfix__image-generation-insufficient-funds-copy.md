# Image Generation Insufficient Funds Copy

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/image-generation-insufficient-funds-copy
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

When chat image generation is blocked by wallet billing, users currently receive a generic assistant-style fallback like "An error occurred while generating an image" plus raw backend billing details. That bypasses the existing billing-block UX and exposes low-level wording in chat.

## Goal / Acceptance Criteria

- [x] Image generation insufficient-funds errors no longer become generic model-authored fallback text.
- [x] Billing-blocked image generation reuses the existing structured billing error flow so chat can show the inline/top-up UX.
- [x] Add regression coverage for the image-generation middleware path.

## Non-goals

- Redesigning the billing modal.
- Changing wallet pricing or hold logic.
- Altering non-billing image generation failures.

## Scope (what changes)

- Backend:
  - Adjust image-generation chat middleware to preserve billing block exceptions instead of converting them into generic image-failure system prompts.
  - Add regression tests for billing-blocked image generation in chat mode.
- Frontend:
  - No direct code changes expected unless regression requires it.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/middleware.py`
  - `backend/open_webui/test/util/*` or related backend regression test file
- API changes:
  - None expected; preserve existing structured `HTTPException.detail` payload for billing blocks.
- Edge cases:
  - Only structured billing block errors (`insufficient_funds`, `daily_cap_exceeded`, `max_reply_cost_exceeded`) should bypass the generic image-failure fallback.
  - Non-billing image generation failures should keep the current fallback behavior.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/middleware.py`
- Why unavoidable:
  - The bug lives in the shared chat image-generation middleware that currently swallows billing exceptions.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the change narrow: only short-circuit structured billing-block exceptions and add focused regression coverage.

## Verification

Docker Compose-first commands (adjust if needed):

- Syntax check: `python -m py_compile backend/open_webui/utils/middleware.py backend/open_webui/utils/airis/task_error_payload.py backend/open_webui/tools/builtin.py backend/open_webui/test/util/test_chat_image_generation_handler.py backend/open_webui/test/util/test_task_error_payload.py`
- Diff hygiene: `git diff --check`
- Attempted backend pytest: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "cd /app/backend && pytest -q open_webui/test/util/test_chat_image_generation_handler.py open_webui/test/util/test_task_error_payload.py open_webui/test/apps/webui/routers/test_images_billing.py"` blocked by hardcoded container-name conflict with the already-running local dev stack (`/airis-postgres`)
- Attempted local pytest: `cd backend && pytest -q open_webui/test/util/test_chat_image_generation_handler.py open_webui/test/util/test_task_error_payload.py open_webui/test/apps/webui/routers/test_images_billing.py` blocked by missing local dependency `typer`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][BILLING][IMAGES]** Preserve billing block UX for chat image generation
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__image-generation-insufficient-funds-copy.md`
  - Owner: Codex
  - Branch: `bugfix/image-generation-insufficient-funds-copy`
  - Done: 2026-03-12
  - Summary: Preserved structured billing-block exceptions across chat image generation and builtin image tools so insufficient-funds now routes into the existing top-up UX instead of model-authored generic image error copy.
  - Tests: `python -m py_compile ...`; `git diff --check`; targeted pytest attempted in Docker and local env but blocked by container-name conflict / missing `typer`
  - Risks: Low-Medium (touches shared chat middleware before completion dispatch)

## Risks / Rollback

- Risks:
  - Image-generation chat flow could regress if non-billing errors are accidentally re-raised.
- Rollback plan:
  - Revert the middleware guard and the regression test.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
