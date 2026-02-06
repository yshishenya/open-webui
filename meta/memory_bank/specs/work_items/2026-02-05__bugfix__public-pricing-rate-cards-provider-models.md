# Public pricing: show rate cards for provider-only models

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/public-pricing-rate-cards-provider-models
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

Landing page `/pricing` loads `GET /api/v1/billing/public/rate-cards` to render “Ставки по моделям”.
The endpoint built the model list only from workspace DB base models (`Models.get_base_models()`).
In provider-only setups (rate cards exist, but base models are only available via `/api/models/base` and not
persisted in the workspace DB), the endpoint returned an empty `models` list and the pricing table showed
no prices.

## Goal / Acceptance Criteria

- [x] Public rate-cards endpoint includes provider base models (via `get_all_base_models`) when workspace has no
      base models.
- [x] Workspace visibility filters still apply (inactive / private `access_control` / hidden `meta.hidden`).
- [x] Regression test covers provider-only model with rate cards but no workspace model record.

## Non-goals

- Do not auto-create base model records in DB from the public endpoint.
- Do not change pricing calculation logic or rate-card schema.

## Scope (what changes)

- Backend:
  - `backend/open_webui/routers/billing.py`: merge provider base models with workspace base models for
    `/public/rate-cards`.
- Tests:
  - `backend/open_webui/test/apps/webui/routers/test_billing_public_pricing.py`: add provider-only model
    regression test.

## Implementation Notes

- Merge strategy:
  - Workspace base models remain authoritative for visibility; excluded IDs are removed even if provider returns
    them.
  - Provider-only models are included if present in provider list and have active rate cards.
- Performance:
  - Rate card lookup is chunked to avoid oversized `IN (...)` clauses.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/billing.py`
- Why unavoidable:
  - The public endpoint is implemented here.
- Minimization strategy:
  - Localized change within the endpoint; no refactors outside pricing route.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_public_pricing.py"`
- Other checks: N/A

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG]** Landing pricing: show rate cards for provider-only models
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__bugfix__public-pricing-rate-cards-provider-models.md`
  - Owner: Codex
  - Branch: `bugfix/public-pricing-rate-cards-provider-models`
  - Done: 2026-02-05
  - Summary: Public `/billing/public/rate-cards` merges provider base models with workspace overrides so `/pricing`
    shows prices.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_public_pricing.py"`
  - Risks: Low (public endpoint now fetches provider model list; failures are handled and fallback to workspace
    models).

## Risks / Rollback

- Risks:
  - Slightly more work per request due to provider base model fetch (cached; wrapped in try/except).
- Rollback plan:
  - Revert changes in `backend/open_webui/routers/billing.py` and remove added regression test.

