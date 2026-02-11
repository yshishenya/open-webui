# Billing Top-up YooKassa Error Visibility

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: HEAD (no branch)
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/billing-topup-yookassa-error-hardening-2026-02-11-001.json`
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

Users receive a generic `Failed to create topup` toast on `/billing/balance` when top-up creation fails. The backend also collapses provider-level failures into generic 500 responses, which hides actionable causes such as invalid YooKassa credentials, malformed payment requests, or temporary provider throttling.

## Goal / Acceptance Criteria

- [x] YooKassa API failures are represented by a typed backend error carrying HTTP status + response body.
- [x] Billing router maps YooKassa failures to user-safe `502` messages with actionable details.
- [x] Top-up UI displays returned backend details when available instead of always showing a generic message.
- [x] Targeted tests cover backend mapping and frontend error display regressions.

## Non-goals

- Reworking the full billing UX.
- Introducing new payment providers.
- Changing top-up package business rules.

## Scope (what changes)

- Backend:
  - Add typed YooKassa request error with status/response payload.
  - Handle mapped provider failures in billing payment/top-up routes.
- Frontend:
  - Surface API error details in top-up toast.
  - Add translation keys for new provider error messages.
  - Add a regression test for top-up error display.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/utils/yookassa.py`
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `src/routes/(app)/billing/balance/billing-balance.test.ts`
  - `src/lib/i18n/locales/en-US/translation.json`
  - `src/lib/i18n/locales/ru-RU/translation.json`
- API changes:
  - Error details for failed `/billing/topup` and `/billing/payment` provider requests are now explicit and mapped to 502.
- Edge cases:
  - Preserve existing `ValueError` validation behavior for invalid top-up amounts.
  - Preserve existing 503 behavior for uninitialized payment client.

### Normalized provider error contract

| Provider signal | API status | API `detail` |
| --- | --- | --- |
| YooKassa HTTP `401` / `403` | `502` | `Payment provider credentials are invalid` |
| YooKassa HTTP `400` | `502` | `Payment provider rejected the payment request` |
| YooKassa HTTP `429` | `502` | `Payment provider is rate-limiting requests` |
| YooKassa HTTP `>=500` or unexpected provider response | `502` | `Payment provider is temporarily unavailable` |
| Gateway client is not initialized (`RuntimeError`) | `503` | `Payment system temporarily unavailable` |
| Invalid top-up amount / package validation (`ValueError`) | `400` | current validation detail (unchanged) |

### User-safe logging and message constraints

- API response details must stay user-safe and deterministic; never include raw provider payloads, secrets, or stack traces.
- Technical diagnostics stay only in backend logs with context fields (`action`, provider status, request fragment) and without sensitive values.
- Frontend displays backend `detail` when present; otherwise falls back to `Failed to create topup`.
- Existing validation messages for user input (invalid amount/package) remain unchanged to avoid behavior regressions.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/utils/yookassa.py`
- Why unavoidable:
  - Error mapping and provider failure handling happens in existing billing request path.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small additive error class + narrow `except` branches only; no API contract changes outside error handling.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/routers/billing.py backend/open_webui/utils/yookassa.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/routes/\(app\)/billing/balance/billing-balance.test.ts"`
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run lint:frontend"`
- E2E (when relevant): N/A

## Rollout / Smoke Status

- Automated verification completed:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"` -> passed (`12 passed`).
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/routers/billing.py backend/open_webui/utils/yookassa.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py"` -> passed.
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/routes/\(app\)/billing/balance/billing-balance.test.ts"` -> passed (`5 passed`).
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/routes/\(app\)/billing/balance/+page.svelte src/routes/\(app\)/billing/balance/billing-balance.test.ts"` -> passed.
  - `python -m py_compile backend/open_webui/utils/yookassa.py backend/open_webui/routers/billing.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py` -> passed.
- Manual smoke with intentionally misconfigured YooKassa credentials remains environment-dependent and must be executed on configured dev/staging runtime.

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][BILLING][YOOKASSA]** Surface top-up failure reasons from provider/backend
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__bugfix__billing-topup-yookassa-error-visibility.md`
  - Owner: Codex
  - Branch: `HEAD (no branch)`
  - Done: 2026-02-11
  - Summary: Add explicit YooKassa error mapping in backend and show detailed top-up failure in billing balance UI.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/routes/\(app\)/billing/balance/billing-balance.test.ts"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npx eslint src/routes/\(app\)/billing/balance/+page.svelte src/routes/\(app\)/billing/balance/billing-balance.test.ts"`, `python -m py_compile backend/open_webui/utils/yookassa.py backend/open_webui/routers/billing.py backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
  - Risks: Low-Medium (error handling behavior visible to end users)

## Risks / Rollback

- Risks:
  - New user-facing error texts may require additional localization in non-RU locales.
- Rollback plan:
  - Revert targeted files for this bugfix and fall back to previous generic error behavior.
