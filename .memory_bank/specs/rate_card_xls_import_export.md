# rate_card_xls_import_export
- Date: 2026-01-27
- Owner/Agent: OpenCode
- Links: N/A

## Summary
- Change: Add XLSX export/import for admin Rate Card pricing with a preview/apply workflow.
- Outcome: Admin can update prices in bulk in Excel (including enabling/disabling modalities by unit) while preserving rate-card history semantics (new row + deactivate old).
- Constraints/assumptions:
  - Only the current pricing version is supported: always use backend `BILLING_RATE_CARD_VERSION` (XLS never reads/writes `version`).
  - Import does not upload historical timelines; it only changes current state.
  - Strict unit whitelist:
    - `text`: `token_in`, `token_out`
    - `image`: `image_1024`
    - `tts`: `tts_char`
    - `stt`: `stt_second`
  - Prices are stored as integer kopeks.
    - Import accepts integers and floats with `.0` (e.g., `150.0`) and converts to int.
    - Import rejects non-integer floats (e.g., `150.5`).
  - Empty optional fields in XLS do not clear DB values (empty cell/empty string = “not provided”).
  - No audit logging is required for this feature.
  - RU i18n strings must be added for all new UI.

## Context / Problem
- Admin currently edits pricing model-by-model in UI.
- Bulk updates, review/approval, and “enable a missing modality” workflows are slow without a spreadsheet workflow.
- Current system uses rate-card history semantics (change => new row + old deactivated) and the import must preserve this.

## Goals / Non-goals
Goals:
- Export pricing for selected models to `.xlsx`.
- Provide two export modes:
  - `active_only`: only the current active rows per unit.
  - `all_units_template`: a full template including disabled units so admin can enable modalities by setting `is_active=true` and entering a price.
- Import `.xlsx` via Preview → Apply.
- Support common operations through XLS:
  - Update prices for existing active units.
  - Add price for a previously missing/disabled unit (enable modality).
  - Disable a unit explicitly (set `is_active=false`).
  - (Optional) Full sync mode that disables missing units, scoped safely.
- Ensure behavior is unambiguous and safe by default.

Non-goals:
- Import/export historical rate-card rows (multiple `created_at` versions per unit).
- Manage/rotate pricing `version` via XLS.
- Implement lead magnet changes via XLS.
- Add new dependencies.

## Behavior (AS-IS → TO-BE)
AS-IS:
- UI at `src/routes/(app)/admin/billing/models/+page.svelte` edits pricing by creating a new rate-card entry and deactivating the previous one.
- Backend CRUD endpoints exist in `backend/open_webui/routers/admin_billing_rate_card.py`.

TO-BE:
- UI supports Export XLSX and Import XLSX.
- Export can be `active_only` or `all_units_template`.
- Import supports Preview and Apply.
- Import always targets only the explicitly selected model list (`scope_model_ids`). There is no implicit “all models” import.

### Canonical Concepts
- A “unit” is one of the strict whitelist items listed in Summary.
- A modality is considered “enabled” in UI if at least one unit in that modality has an active rate card.
- “Current active price” for a unit = the latest active rate card row for that `(model_id, modality, unit, version=BILLING_RATE_CARD_VERSION)`.

### Scenarios (what the admin can do)

1) Update a price (existing active unit)
- XLS has `is_active=true` and a different `raw_cost_per_unit_kopeks`.
- Apply behavior: create a new active entry, then deactivate the previously active entry for the same `(model_id, modality, unit)`.

2) No-op update (price unchanged)
- XLS has same price as currently active.
- Apply behavior: no changes.

3) Enable a unit / enable modality
- XLS has `is_active=true` for a unit that currently has no active entry.
- Apply behavior: create a new active entry.

4) Disable a unit (explicit)
- XLS has `is_active=false`.
- Apply behavior: if an active entry exists for that unit, set it inactive.

5) Full sync disable (optional import mode)
- Import mode `full_sync` is enabled.
- For models that are present in the XLS (defined precisely below), any whitelist unit row missing from the XLS is deactivated.

Edge cases / failures:
- Unknown model id in XLS (not found in system): warning; row skipped during apply.
- Model exists but not selected (not in `scope_model_ids`): warning; row skipped during apply.
- Validation errors (invalid modality/unit/price/duplicates/template): preview shows errors; apply blocked.

Concurrency/idempotency:
- Apply is designed to be safe to re-run on the same file:
  - If the desired state already matches DB, actions are no-ops.
  - No duplicate “price change” rows should be created when price is already current.

## Decisions (and why)
- Provide `all_units_template` export to make enabling/disabling modalities practical (user can see disabled units).
- Scope is always explicit list of selected models to avoid accidental global changes.
- Preview is mandatory before Apply in UI.
- Unknown model ids are warnings (not hard errors) so a file containing “extra” rows is still usable.
- Empty optional values do not clear stored values to prevent accidental wipe.

Alternatives rejected:
- CSV: weaker UX and higher locale fragility.
- Importing history: too complex and easy to misuse.

## Design

### UI
Entry point:
- Admin → Billing → Model Pricing (`src/routes/(app)/admin/billing/models/+page.svelte`).

Selection:
- Add a “Select all visible” checkbox in table header.
  - It selects all currently visible rows (after search + status filter).
  - It does not select “all models in system”.

Export:
- Button: RU label “Экспорт XLSX”.
- Modal:
  - export mode selector:
    - RU: “Только активные цены” (`active_only`) (default)
    - RU: “Шаблон (все юниты) — для включения/выключения модальностей” (`all_units_template`)
  - download button.

Import:
- Button: RU label “Импорт XLSX”.
- Modal:
  - File picker (only `.xlsx`).
  - Mode selector:
    - RU: “Обновить только строки из файла” (`patch`) (default)
    - RU: “Полная синхронизация (отключить отсутствующие юниты)” (`full_sync`) (danger copy)
  - Preview button (RU: “Предпросмотр”).
  - Preview section:
    - summary counts
    - warnings list
    - errors list
  - Apply button (RU: “Применить импорт”) disabled if any errors exist.

Post-apply:
- Show RU toast: success/failure.
- Refresh rate card list (call existing `loadData()` in the page).

### XLSX Format
Workbook:
- Required sheet: `RateCards`.
- Header row required at row 1.
- Column names are strict; order is not.
- Additional columns are allowed but ignored.

Columns:
- Required:
  - `model_id` (string)
  - `modality` (string: `text|image|tts|stt`)
  - `unit` (string: strict whitelist)
  - `is_active` (boolean-like; default TRUE if missing)
  - `raw_cost_per_unit_kopeks`
    - required if `is_active` parses to TRUE
    - optional/empty allowed if `is_active` parses to FALSE
- Optional (import supports, export populates for usability):
  - `model_name` (string; export always populates; import ignores)
  - `provider` (string)
  - `model_tier` (string)
  - `is_default` (boolean-like)
  - `comment` (string; ignored)

Boolean parsing (for `is_active` and `is_default`):
- Accept: boolean cell, `TRUE/FALSE`, `true/false`, `1/0`, `yes/no` (case-insensitive, trimmed).
- Empty cell:
  - `is_active` defaults to TRUE.
  - `is_default` means “not provided”.

Price parsing (`raw_cost_per_unit_kopeks`):
- Accept:
  - integer cells
  - float cells where `value.is_integer()`
  - numeric strings like `"150"` or `"150.0"` (same rule)
- Reject:
  - negative values
  - non-integer floats
  - empty when `is_active=true`

### Export Semantics
Endpoint supports `mode`:

1) `active_only`
- For each selected model, include only currently active units.
- Every exported row is `is_active=true`.

2) `all_units_template`
- For each selected model, export exactly 5 rows (all whitelist units):
  - `text/token_in`
  - `text/token_out`
  - `image/image_1024`
  - `tts/tts_char`
  - `stt/stt_second`
- For each of these rows:
  - If an active entry exists: fill `raw_cost_per_unit_kopeks` and `is_active=true`.
  - If no active entry exists: set `is_active=false` and leave `raw_cost_per_unit_kopeks` empty.

Export must always populate:
- `model_id`, `model_name`, `modality`, `unit`, `is_active`, `raw_cost_per_unit_kopeks`.
- When an active entry exists for a unit, export should also populate `provider`, `model_tier`, `is_default` from that active entry.

### Import Semantics
Common normalization:
- Trim strings for `model_id`, `modality`, `unit`, `provider`, `model_tier`.
- Lowercase `modality` and `unit`.
- Key for row uniqueness: `(model_id, modality, unit)` after normalization.

Row validation:
- `modality` must be one of `text|image|tts|stt`.
- `unit` must match whitelist for that modality.
- Duplicate keys in the file are errors.

Scope behavior:
- `scope_model_ids` is provided by UI and is the only scope.
- If XLS row `model_id` is not in `scope_model_ids`: warning + skip.
- If XLS row `model_id` not found in system: warning + skip.

Optional fields handling:
- For `provider`/`model_tier`/`is_default`:
  - empty cell/empty string => treat as not provided (do not clear).
  - if not provided:
    - if an active entry exists for the key, copy these fields from it
    - else defaults: `provider=null`, `model_tier=null`, `is_default=false`

Patch mode (`patch`):
- Only rows present in XLS can create/update/deactivate.
- Missing whitelist units in XLS do nothing.

Full sync mode (`full_sync`):
- Define “model present in XLS” as:
  - model_id exists in system
  - model_id is in `scope_model_ids`
  - and there is at least one valid (non-error) row for that model in the XLS
- For each “model present in XLS”, for each of the 5 whitelist units:
  - if that unit key is not present in XLS for that model: deactivate current active entry if exists
- Models selected in UI but absent in XLS: ignored (no changes).

Planned actions and apply rules:
- If `is_active=true`:
  - if there is no active entry: create new active entry
  - if active entry exists and price differs: create new active entry and deactivate old
  - if active entry exists and price matches: no-op
- If `is_active=false`:
  - if active entry exists: deactivate it
  - else: no-op

## Contracts
Backend base prefix: `/api/v1/admin/billing`

### 1) Export XLSX
- `GET /api/v1/admin/billing/rate-card/export-xlsx`
- Auth: admin (`Depends(get_admin_user)`), must respect `ensure_wallet_enabled()`.
- Query params:
  - `model_ids`: repeated query param. Example: `?model_ids=<id1>&model_ids=<id2>`
  - `mode`: `active_only` | `all_units_template` (default `active_only`)
- Response:
  - `200` with XLSX bytes
  - content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Export selection logic:
- Always operate on `BILLING_RATE_CARD_VERSION`.
- When an “active entry exists” needs to be determined, choose the latest active by max(`created_at`) (defensive against multiple-active anomalies).

### 2) Import Preview
- `POST /api/v1/admin/billing/rate-card/import-xlsx/preview`
- Multipart form fields:
  - `file`: UploadFile
  - `mode`: `patch` | `full_sync`
  - `scope_model_ids`: JSON string array of model ids. Example: `scope_model_ids='["<id1>","<id2>"]'`
- Response JSON:
  - `summary`:
    - `rows_total`
    - `rows_valid`
    - `rows_invalid`
    - `creates`
    - `updates_via_create`
    - `deactivations`
    - `noops`
    - `skipped_unknown_model`
    - `skipped_out_of_scope`
  - `warnings`: list of `{ row_number, code, message, model_id? }`
  - `errors`: list of `{ row_number?, column?, code, message }`
  - `actions_preview`: optional list of first N actions (bounded)

### 3) Import Apply
- `POST /api/v1/admin/billing/rate-card/import-xlsx/apply`
- Same multipart fields as preview.
- Behavior:
  - Re-parse XLS and compute plan.
  - If any errors exist: return 400 with the same error shape.
  - Apply creates/deactivations via existing `RateCards` methods.
  - Return same `summary` and `warnings` shape.

## Implementation Plan (ordered checklist)
1. Backend utilities:
   - Create `backend/open_webui/utils/rate_card_xlsx.py` with:
     - `build_export_workbook(..., mode) -> bytes`
     - `parse_import_workbook(bytes) -> ParsedRows`
     - `compute_import_plan(...) -> plan`
2. Backend router:
   - Update `backend/open_webui/routers/admin_billing_rate_card.py` with 3 new endpoints.
3. Frontend API:
   - Update `src/lib/apis/admin/billing.ts` with export/import functions.
4. Frontend UI:
   - Update `src/routes/(app)/admin/billing/models/+page.svelte`:
     - select-all-visible
     - export modal (mode)
     - import modal (patch/full_sync + preview/apply)
     - RU toasts and text
5. i18n:
   - Add EN/RU keys for all new UI labels/messages.
6. Tests:
   - Add pytest tests for both export modes and for import preview/apply semantics.

## Affected Files
- CREATE: `backend/open_webui/utils/rate_card_xlsx.py` — XLSX build/parse/plan helpers.
- UPDATE: `backend/open_webui/routers/admin_billing_rate_card.py` — add export/preview/apply endpoints.
- UPDATE: `src/lib/apis/admin/billing.ts` — add export/import API functions.
- UPDATE: `src/routes/(app)/admin/billing/models/+page.svelte` — add select-all + import/export modals.
- UPDATE: `src/lib/i18n/locales/en-US/translation.json` — new i18n keys.
- UPDATE: `src/lib/i18n/locales/ru-RU/translation.json` — new RU i18n keys.
- CREATE: `backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py` — endpoint tests.

## Testing / Acceptance
Tests:
- Backend (pytest):
  - Export:
    - `active_only` contains only active rows.
    - `all_units_template` contains exactly 5 rows per model.
  - Import preview:
    - blocks apply on invalid template/invalid units/duplicates/missing price when `is_active=true`.
    - warning + skip for unknown model_id.
    - warning + skip for model_id out of scope.
  - Import apply:
    - update price => new active row + old inactive.
    - same price => noop.
    - `is_active=false` => deactivation.
    - full_sync deactivates missing units only for models present in XLS.

Acceptance criteria (DoD):
- [ ] Export supports `active_only` and `all_units_template`.
- [ ] In `all_units_template`, an admin can enable a previously disabled modality by setting `is_active=true` and entering a price.
- [ ] Import Preview shows clear RU messages and exact row numbers for errors/warnings.
- [ ] Import Apply is disabled if any errors exist.
- [ ] Import preserves rate-card history semantics.
- [ ] Strict whitelist enforced.
- [ ] No new dependencies.

## Rollout / Rollback
Rollout:
- Standard deployment.
Rollback:
- Revert endpoints and UI changes; imported history rows remain in DB (expected).

## Observability
- Logs:
  - Export: admin + count + mode.
  - Preview: parsed rows + warnings/errors counts.
  - Apply: create/update/deactivate/no-op counts.

## Risks / Open Questions / TBD
Risks:
- Full sync can deactivate units; UI must clearly label it as dangerous.
Open questions:
- N/A.

## Quick start
1. Start files/modules:
   - Backend: `backend/open_webui/routers/admin_billing_rate_card.py`
   - Frontend: `src/routes/(app)/admin/billing/models/+page.svelte`
2. Commands:
   - Backend tests: `pytest backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py`
   - Frontend typecheck: `npm run check`
3. Manual verification:
   - Select models → export `all_units_template` → set price+is_active for disabled units → preview → apply → confirm modalities appear enabled in UI.
