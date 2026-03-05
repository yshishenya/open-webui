# Billing balance top-up presets 100/500/1000/2000 RUB

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: feature/billing-balance-topup-presets
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

Current quick top-up presets on `/billing/balance` do not match the requested product setup. We need to replace existing preset amounts with `100`, `500`, `1000`, and `2000` RUB and keep defaults aligned between backend/public config, env templates, compose defaults, and frontend fallback.

## Goal / Acceptance Criteria

- [x] `/billing/balance` top-up preset buttons use `100/500/1000/2000` RUB.
- [x] Public pricing config returns the same preset amounts.
- [x] Backend env default, `.env.example`, and `docker-compose.yaml` defaults are aligned.
- [x] Targeted billing tests for touched area pass.

## Non-goals

- Changing billing logic for custom top-up, auto-topup, receipts, or wallet ledger behavior.
- Introducing new dependencies or schema migrations.

## Scope (what changes)

- Backend:
  - Update default `BILLING_TOPUP_PACKAGES_KOPEKS` values.
- Frontend:
  - Update fallback top-up packages on `/billing/balance`.
- Config/Env:
  - Update `.env.example` and `docker-compose.yaml` defaults.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/env.py`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `.env.example`
  - `docker-compose.yaml`
- API changes:
  - None (response shape unchanged; values updated).
- Edge cases:
  - If public pricing config fetch fails, frontend fallback must still show new presets.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/env.py`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `.env.example`
  - `docker-compose.yaml`
- Why unavoidable:
  - Preset defaults are defined directly in these runtime/config entrypoints.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal literal-value updates only; no refactor/reformat/unrelated edits.

## Verification

Docker Compose-first commands (targeted to touched area):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run 'src/routes/(app)/billing/balance/billing-balance.test.ts' 'src/lib/utils/airis/billing_return_url.test.ts' 'src/lib/utils/airis/return_to.test.ts'"`
- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_public_pricing.py open_webui/test/apps/webui/routers/test_billing_core_paths.py"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[UI][BILLING]** Update wallet top-up presets to 100/500/1000/2000 RUB
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__feature__billing-balance-topup-presets.md`
  - Owner: Codex
  - Branch: `feature/billing-balance-topup-presets`
  - Done: 2026-03-05
  - Summary: Aligned backend/public-config defaults and `/billing/balance` fallback presets to `100/500/1000/2000` RUB.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run 'src/routes/(app)/billing/balance/billing-balance.test.ts' 'src/lib/utils/airis/billing_return_url.test.ts' 'src/lib/utils/airis/return_to.test.ts'"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_public_pricing.py open_webui/test/apps/webui/routers/test_billing_core_paths.py"`
  - Risks: Low (configuration/value-only change)

## Risks / Rollback

- Risks:
  - Mismatch between backend default and frontend fallback can produce inconsistent buttons.
- Rollback plan:
  - Revert touched files to previous preset values.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A, no linked SDD spec)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A, no linked SDD spec)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
