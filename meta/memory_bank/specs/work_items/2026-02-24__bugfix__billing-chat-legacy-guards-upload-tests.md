# Billing/Public Models Guard + Chat Upload Header Safety

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-chat-guard-and-upload-tests
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-24
- Updated: 2026-02-24

## Context

The local changes include two safety fixes and one new regression test module:
- `billing` public rate cards path should not hard-fail on model objects that do not expose `access_grants`.
- `Chat.svelte` upload debug log should not include raw auth header value.
- upload helper behavior lacked targeted unit tests under `backend/open_webui/test/util/`.

## Goal / Acceptance Criteria

- [x] Public rate-card selection no longer excludes legacy model objects only because they lack `access_grants` attribute.
- [x] Frontend debug logging does not print Authorization token values.
- [x] Add targeted unit tests for Ollama upload helper paths.
- [x] Relevant backend/frontend checks pass.

## Non-goals

- Refactor of billing access model.
- Rework of upload helper implementation.
- Full frontend/backend test suite run.

## Scope (what changes)

- Backend:
  - `backend/open_webui/routers/billing.py` legacy guard for `access_grants` access.
  - `backend/open_webui/test/util/test_ollama_upload.py` targeted tests.
- Frontend:
  - `src/lib/components/chat/Chat.svelte` logging safety adjustment.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/test/util/test_ollama_upload.py`
  - `src/lib/components/chat/Chat.svelte`
- API changes:
  - None.
- Edge cases:
  - Legacy model objects without `access_grants` are treated as compatible in public list flow.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/routers/billing.py`
  - `src/lib/components/chat/Chat.svelte`
- Why unavoidable:
  - Fixes are located directly in runtime call-sites.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small guard/logging edits only; no contract changes.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests (upload helper): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_ollama_upload.py"`
- Backend tests (billing public pricing): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_public_pricing.py"`
- Frontend lint (targeted): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; node_modules/.bin/eslint src/lib/components/chat/Chat.svelte"`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][BILLING][CHAT]** Harden legacy model guard and upload logging safety
  - Spec: `meta/memory_bank/specs/work_items/2026-02-24__bugfix__billing-chat-legacy-guards-upload-tests.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-chat-guard-and-upload-tests`
  - Started: 2026-02-24
  - Summary: Protect billing public rate-cards flow for legacy models and avoid leaking auth headers in chat upload diagnostics; add upload helper tests.
  - Tests: targeted pytest + eslint commands
  - Risks: Low-Medium (touches billing visibility/filtering path).

## Risks / Rollback

- Risks:
  - Billing model visibility behavior for some legacy objects may change.
- Rollback plan:
  - Revert branch commit and restore previous filter/log behavior.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
