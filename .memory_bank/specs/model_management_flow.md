# Model Management Flow Spec

## Summary
Define the end-to-end lifecycle for AI models across provider discovery, admin visibility, access control, billing rate cards, and public pricing surfaces. This spec establishes authoritative business rules, required state transitions, and expected system behavior for model enablement, pricing, lead magnet eligibility, and public visibility.

## Goals
- Ensure new provider models become manageable in admin UI without manual DB seeding.
- Align "model enabled", "model hidden", and "public visibility" across UI, billing, and landing.
- Guarantee rate cards and billing paths behave deterministically when models or modalities are disabled.
- Make lead magnet eligibility consistent and discoverable.

## Non-Goals
- Redesign provider integration (OpenAI/Ollama) beyond model syncing.
- Change core billing ledger logic or introduce new pricing formulas.

## Definitions
- **Provider Model**: Model returned by external providers (OpenAI/Ollama/Functions).
- **Model Override**: Record in `model` table used to override metadata/access/active state.
- **Preset Model**: Custom model with `base_model_id != null`.
- **Rate Card Entry**: Billing price for `(model_id, modality, unit)`.
- **Public Model**: Model visible on landing pricing tables.
- **Hidden Model**: Model hidden from UI lists but may still be callable.
- **Enabled Model**: Model allowed for use (not globally disabled).

## Business Rules

### 1) Model Availability (Authoritative)
- A model is **available for usage** when:
  - Model override exists OR model is discovered from provider, AND
  - `is_active = true`, AND
  - Access control allows the user.
- If `is_active = false`, the model is not selectable in chat and is excluded from billing/preflight.

### 2) Visibility (UI + Public)
- **Hidden in UI**: `meta.hidden = true` hides the model from model selectors and admin model lists.
- **Public visibility**: A model is public only when:
  - `is_active = true`
  - `access_control == null` (public access)
  - `meta.hidden != true`
  - Model has at least one active rate card within current effective window

### 3) Access Control
- `access_control == null` means public access for all users.
- `access_control == {}` means private (owner only).
- Any model used as task model must be public (access_control null).

### 4) Rate Card Requirements
- Pricing is computed only from active rate cards within effective window.
- Missing rate card for requested modality must return "modality_disabled" (not "rate_card_missing").
- Rate card history is preserved: a price change creates a new entry and sets `effective_to` on previous entry.

### 5) Modality Enablement
- Modality is **enabled** if the model has at least one active rate card for that modality.
- Modality is **disabled** if all relevant rate cards are inactive or missing.
- Disabled modality blocks provider calls and billing preflight.

### 6) Lead Magnet Eligibility
- `meta.lead_magnet = true` enables lead magnet usage for this model.
- Lead magnet evaluation requires a model override entry; if missing, admin must create one automatically when toggled.

### 7) Deletion
- Deleting a model must disable or delete all rate cards for that model.
- Soft-delete is preferred: set `is_active=false` and keep history.

## State Model

### Model State Machine
```
[PROVIDER_DISCOVERED]
  | sync/ensure override
  v
[ENABLED_VISIBLE]
  | toggle hidden
  v
[ENABLED_HIDDEN]
  | toggle hidden
  v
[ENABLED_VISIBLE]
  | disable model
  v
[DISABLED]
  | enable model
  v
[ENABLED_VISIBLE]
```

### Rate Card State Machine (per modality/unit)
```
[ABSENT]
  | create entry
  v
[ACTIVE]
  | set is_active=false OR effective_to < now
  v
[INACTIVE]
  | create new entry
  v
[ACTIVE]
```

### Public Visibility Evaluation
```
if is_active
  and access_control is null
  and meta.hidden != true
  and has_active_rate_card
then PUBLIC
else PRIVATE
```

## Key Scenarios

### A) Add New Provider Model
1. Provider returns model.
2. Sync process ensures model override exists (base override).
3. Admin sees model in Model Settings and can edit metadata/access.
4. Admin configures rate cards (default templates on first sync).
5. Model appears in public pricing when public + active + priced.

### B) Disable Model
1. Admin toggles `is_active=false`.
2. Model disappears from selectors and public pricing.
3. Billing preflight returns "model_disabled" before rate card lookup.

### C) Hide Model
1. Admin toggles `meta.hidden=true`.
2. Model removed from UI lists and public pricing.
3. API access remains allowed if user has access and model is active.

### D) Change Price
1. Admin creates new rate card entry with new `effective_from`.
2. Previous entry updated with `effective_to`.
3. Public pricing and billing use latest active entry.

### E) Disable Modality
1. Admin disables rate card entries for modality.
2. Preflight rejects modality with "modality_disabled".
3. Public pricing excludes modality values.

### F) Delete Model
1. Admin deletes model override.
2. System disables or deletes rate cards for model.
3. Public pricing and billing do not reference model.

## Acceptance Criteria
- New provider model appears in admin list without manual DB seed.
- Public rate cards never include hidden/private/disabled models.
- Billing preflight uses clear errors for disabled models/modality.
- Lead magnet toggle works for provider-only models.
- Deleting models does not leave orphaned rate cards.

## Data & API Notes
- Primary filters for public rate cards must include: `is_active`, `access_control`, `meta.hidden`.
- Introduce explicit error codes: `model_disabled`, `modality_disabled`.
- Rate card sync should be idempotent and preserve existing history.

## Open Questions
- Should hidden models remain selectable via direct URL parameter (model id in URL)?
- Do we want a separate "public_pricing" flag or reuse access_control + hidden?
- Should rate card creation for new models be automatic or admin-triggered?
