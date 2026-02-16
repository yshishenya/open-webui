# Remove Ollama-specific upload tests from default suite

## Meta

- Type: refactor
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/refactor/remove-ollama-tests
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

Project owner confirmed Ollama is not used in the current deployment and requested removal of
newly added Ollama upload tests from the default backend test suite.

## Goal / Acceptance Criteria

- [x] Remove Ollama upload-specific tests added in the previous fix.
- [x] Keep application behavior unchanged (test-only change).
- [x] Track this decision in Memory Bank work item + branch update logs.

## Non-goals

- No changes to Ollama runtime code or API behavior.
- No broad test-suite restructuring in this change.

## Scope (what changes)

- Removed tests:
  - `backend/open_webui/test/apps/webui/routers/test_ollama_upload_async.py`
  - `backend/open_webui/test/util/test_ollama_upload.py`
- Added tracking docs:
  - this work item spec
  - branch update entry

## Upstream impact

- Upstream-owned files touched:
  - None (test-only files removed).
- Minimization strategy:
  - Purely scoped to removing tests not needed by current deployment.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_images_verify_url_async.py open_webui/test/apps/webui/routers/test_images_billing.py"` ✅

## Task Entry (for branch_updates/current_tasks)

- [x] **[REFACTOR][TESTS]** Remove Ollama upload tests from default suite
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__refactor__remove-ollama-tests.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/refactor/remove-ollama-tests`
  - Done: 2026-02-16
  - Summary: Removed two Ollama upload tests at user request because Ollama is not part of active runtime usage.
  - Tests: see Verification section.
  - Risks: Medium (less coverage for Ollama upload path if re-enabled later).

## Risks / Rollback

- Risks:
  - Reduced automated protection for Ollama upload regression.
- Rollback plan:
  - Reintroduce deleted tests from commit `654d1d726` or cherry-pick the prior test commit.
