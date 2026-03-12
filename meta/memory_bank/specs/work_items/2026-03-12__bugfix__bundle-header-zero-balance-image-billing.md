# Bundle Header Zero Balance And Image Billing Fixes

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/header-zero-balance-image-billing-bundle
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

Multiple validated bugfixes were sitting in separate local worktrees: the compact header wallet chip could hide a `0` balance, chat image generation swallowed structured billing-block errors into generic assistant copy, and several VPN recovery tasks had already produced Memory Bank artifacts. The user asked to verify everything and land the whole pending set through one clean PR to `airis_b2c`.

## Goal / Acceptance Criteria

- [x] Collect the pending UI, backend, and documentation changes into one clean branch off `airis_b2c`.
- [x] Re-verify the functional code changes with the best checks currently available in the environment.
- [x] Keep the final PR diff understandable and self-documented.

## Non-goals

- Changing any production runtime state from this branch.
- Expanding the scope beyond the already-prepared header, billing, and VPN-related work.

## Scope (what changes)

- Frontend:
  - Include the compact header billing chip tweak that keeps zero balance visible.
- Backend:
  - Include the image-generation billing-block propagation fix and its regression tests.
- Docs:
  - Carry the related work-item specs and branch logs into one mergeable branch.

## Implementation Notes

- Source worktrees bundled:
  - `/opt/projects/open-webui` (`bugfix/header-billing-zero-balance-visibility`)
  - `/tmp/open-webui-bugfix-image-insufficient-funds` (`bugfix/image-generation-insufficient-funds-copy`)
- Final bundle branch:
  - `bugfix/header-zero-balance-image-billing-bundle`

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/middleware.py`
  - `backend/open_webui/tools/builtin.py`
- Fork-owned files touched:
  - `backend/open_webui/utils/airis/task_error_payload.py`
  - `src/lib/components/airis/HeaderBillingAccess.svelte`
- Minimization strategy:
  - Carry only the existing focused diffs and avoid unrelated workspace changes.

## Verification

- Passed: `python -m py_compile backend/open_webui/utils/middleware.py backend/open_webui/utils/airis/task_error_payload.py backend/open_webui/tools/builtin.py backend/open_webui/test/util/test_chat_image_generation_handler.py backend/open_webui/test/util/test_task_error_payload.py`
- Passed: `git diff --check`
- Passed: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npx vitest run src/lib/components/airis/HeaderBillingAccess.test.ts && npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"`
- Blocked: `docker compose --env-file /opt/projects/open-webui/.env -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis bash -lc "cd /app/backend && pytest -q open_webui/test/util/test_chat_image_generation_handler.py open_webui/test/util/test_task_error_payload.py open_webui/test/apps/webui/routers/test_images_billing.py"` because `--no-deps` leaves `postgres` unavailable inside the test container
- Blocked: `docker compose --env-file /opt/projects/open-webui/.env -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis bash -lc "cd /app/backend && pytest -q -p pytest_asyncio.plugin open_webui/test/util/test_chat_image_generation_handler.py open_webui/test/util/test_task_error_payload.py"` because the current backend test image does not include `pytest_asyncio`

## Risks / Rollback

- Risks:
  - The PR bundles a small frontend fix and a shared chat-middleware fix in one change set.
  - Backend regression coverage is partially blocked by the current test image/runtime setup.
- Rollback plan:
  - Revert the merge commit if the combined branch shows an unexpected regression.

## Completion Checklist

- [x] Relevant workflow loaded before editing
- [x] Work item spec created for the bundle branch
- [x] Branch update entry added for the bundle branch
- [x] Available verification run and documented
