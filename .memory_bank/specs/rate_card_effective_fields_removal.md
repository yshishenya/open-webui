# Rate Card Effective Fields Removal Plan

## Purpose

Remove `effective_from` / `effective_to` from rate card pricing to simplify pricing logic while preserving audit/history and preventing changes from affecting past billing.

## Background and Context

Current rate cards use `effective_from`/`effective_to` for validity windows. They are used in:

- Active price selection (`RateCards.get_active_rate_card`).
- Public pricing view filtering and updated timestamp.
- Admin UI editing logic and uniqueness constraints.

Constraints from product requirements:

- Future prices are not needed.
- History/audit must remain intact.
- Only one current price per model/modality/unit is required.
- Price changes must not affect past usage.

## Options Considered

1. Keep `effective_from` and remove only `effective_to`.

- Pros: minimal refactor, preserves ordering.
- Cons: still exposes unused field and manual timestamps.

2. Remove both `effective_from` and `effective_to` and replace with immutable price history.

- Pros: cleaner model, simpler semantics, aligns with "one current price".
- Cons: larger refactor, requires new ordering field and tighter rules.

3. Keep full effective window logic.

- Pros: maximum flexibility.
- Cons: complexity not justified by current needs.

## Chosen Approach

Option 2. Remove both fields and define current price as:

- `is_active = true` AND
- latest record by `created_at`.

All price changes become immutable: create a new rate card entry and deactivate the previous active entry. This preserves historical prices for audit and avoids altering past billing.

## Behavior and Policies

- Current price: latest active entry per (model_id, modality, unit, version).
- Price updates: create new entry + deactivate old.
- Deactivation: set `is_active=false` (soft archive of rate cards).
- Hard delete: allowed only when usage = 0 (future guard to implement as optional check).

## Migration Strategy

1. Add `created_at` to `billing_pricing_rate_card`.
2. Backfill `created_at` with old `effective_from` or `NOW()` if missing.
3. Drop `effective_from` and `effective_to` columns.
4. Update unique constraint to `(model_id, modality, unit, version, created_at)`.
5. Replace indexes with `(is_active, created_at)` and `(model_id)`.

## Backend Changes

### Data Models

- `backend/open_webui/models/billing_wallet.py`
  - Remove `effective_from` and `effective_to` from `PricingRateCard` and `PricingRateCardModel`.
  - Add `created_at` (BigInteger, required).

### Data Access

- `backend/open_webui/models/billing_wallet_tables.py`
  - Replace ordering by `effective_from` with `created_at`.
  - Update `get_active_rate_card` to select `is_active=true` ordered by `created_at desc`.
  - Remove methods and filters referencing `effective_*`.

### Pricing Service

- `backend/open_webui/utils/pricing.py`
  - `get_rate_card` should call new active selection logic (no `as_of`).

### Admin API

- `backend/open_webui/routers/admin_billing_rate_card.py`
  - Remove `effective_from`/`effective_to` from request models.
  - On create: set `created_at = now`.
  - On update: disallow `raw_cost_per_unit_kopeks` update. Instead, create new entry and deactivate old.
  - Ensure uniqueness uses `model_id/modality/unit/version` only.

### Public Pricing API

- `backend/open_webui/routers/billing.py`
  - Replace time window filters with `is_active` + latest `created_at`.
  - Updated timestamp uses `created_at`.

### Rate Card Templates

- `backend/open_webui/utils/rate_card_templates.py`
  - Remove `effective_from` input/usage.
  - Add `created_at=now`.

## Frontend Changes

### API Types

- `src/lib/apis/admin/billing.ts`
  - Remove `effective_from` / `effective_to` from types and payloads.
  - Add `created_at` in rate card model if used in UI.

### Admin UI

- `src/routes/(app)/admin/billing/models/+page.svelte`
  - Remove effective from/to inputs and state.
  - Update save logic:
    - If cost changes, create new entry and deactivate previous.
    - Keep existing entries for history.
  - Add explicit actions (if needed): Deactivate / Delete.

### Shared Utils

- `src/lib/utils/rate-card-models.ts`
  - Replace `effective_from` sorting with `created_at`.

## Tests

- Update fixtures and expectations in:
  - `backend/open_webui/test/apps/webui/utils/test_pricing.py`
  - `backend/open_webui/test/apps/webui/utils/test_billing_integration.py`
  - `backend/open_webui/test/apps/webui/utils/test_lead_magnet.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_public_pricing.py`
  - `backend/open_webui/test/apps/webui/routers/test_images_billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_openai_speech_billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_audio_billing.py`
  - `backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_delete.py`
- Add coverage for:
  - New price creation creates new entry + deactivates old.
  - Historical usage uses old rate card IDs.

## Sequence of Implementation

1. Database migration + models update.
2. Data access + pricing selection logic update.
3. Admin/public API updates.
4. Frontend API types + admin UI updates.
5. Tests and fixture updates.
6. Memory Bank update (task_updates workflow).

## Risks and Mitigations

- Risk: multiple active entries per model/modality/unit.
  - Mitigation: enforce single active via logic in admin update flow + optional DB constraint.
- Risk: public pricing shows wrong entry.
  - Mitigation: always select latest `created_at` active entry.
- Risk: history loss from hard delete.
  - Mitigation: keep soft deactivation as primary path; only hard delete when usage=0.

## Notes

This change is a refactor with behavior preservation for billing integrity. It removes unused time windows and switches to immutable price records with explicit activation states.
