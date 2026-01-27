# rate_card_xls_import_export
- Date: 2026-01-27
- Owner/Agent: OpenCode
- Links: N/A

## Summary
- Change: Add XLSX export/import for admin Rate Card prices with a safe preview/apply flow.
- Outcome: Admin can mass-edit pricing in Excel (including enabling/disabling modalities by units) while preserving historical rate-card entries.
- Constraints/assumptions:
  - Only “actual/current” pricing version is supported: always use backend `BILLING_RATE_CARD_VERSION`.
  - Import does not support history; it only sets current state by creating new entries + deactivating old.
  - Strict unit whitelist enforced (`token_in`, `token_out`, `image_1024`, `tts_char`, `stt_second`).
  - Price stored as integer kopeks; import accepts integers and floats with `.0` (e.g., `150.0`) but rejects non-integer floats (e.g., `150.5`).
  - No audit logging required for this feature.
  - RU i18n strings must be added for new UI.

## Context / Problem
- Why: Current admin pricing UI requires per-model manual editing. Bulk updates across many models are slow and error-prone.
- Current pain:
  - No standard offline format for pricing review/approval.
  - No mass import pipeline that preserves rate-card history semantics (create new entry + deactivate old).
  - Hard to enable missing modalities via export because disabled modalities are not visible in an “active-only” export.

## Goals / Non-goals
Goals:
- Export rate-card prices to `.xlsx` for selected models.
- Provide two export modes:
  - `active_only`: export only current active prices.
  - `all_units_template`: export a full per-model template with all supported units, showing which are active and allowing enabling/disabling by editing the file.
- Import `.xlsx` with a preview step (dry-run) and a separate apply step.
- Preserve pricing history semantics:
  - If price changes: create a new active entry and deactivate the previous active entry.
  - If price unchanged: no-op.
- Safety-first scope: apply import only to explicitly selected models (with UI “Select all visible” convenience).
- Allow optional `full_sync` mode (deactivate missing units), but do not affect selected models that are absent in the file.
- Provide RU UI copy and clear validation feedback.

Non-goals:
- Import/export historical rows (`created_at` timeline).
- Manage/rotate `version` via XLS.
- Add audit logs, metrics, background/background processing.
- Change billing calculation logic.

## Behavior (AS-IS → TO-BE)
AS-IS:
- Admin manages pricing per model in `src/routes/(app)/admin/billing/models/+page.svelte`.
- Backend rate-card endpoints exist in `backend/open_webui/routers/admin_billing_rate_card.py`.
- Changing price uses history semantics (new row + deactivate old).

TO-BE:
- Add two new admin features on Model Pricing page:
  - Export prices to `.xlsx` (with export mode selection).
  - Import `.xlsx` with Preview + Apply.
- Import and export always operate on current `BILLING_RATE_CARD_VERSION` only.

Edge cases / failures:
- XLS contains rows for unknown `model_id` (model does not exist in system):
  - Preview shows warnings for those rows.
  - Apply skips those rows (does not fail the whole import).
- XLS contains rows for existing `model_id` that is NOT included in `scope_model_ids` (i.e. not selected in UI):
  - Preview shows warnings for those rows.
  - Apply skips those rows.
- XLS contains invalid modality/unit/price:
  - Preview returns errors; Apply is blocked until fixed.
- XLS contains duplicate keys (same `model_id+modality+unit` more than once, after normalization):
  - Preview returns error listing row numbers; Apply blocked.
- XLS missing required sheet/columns:
  - Preview returns error “Invalid template”.

Concurrency/idempotency:
- Import is not strictly idempotent because price changes create new rows.
- Safe idempotency rule:
  - If a row’s desired state already matches DB (same active price and active status), action = no-op.
  - Apply must not create a new entry when the currently active price already equals the desired price.

## Decisions (and why)
- Two-step import (Preview then Apply): prevents surprises and makes bulk operations safe.
- XLS without `version`: avoids accidentally modifying old/non-active pricing version.
- Price parsing accepts `150.0` as 150: Excel frequently stores integers as floats.
- Strict unit whitelist: prevents importing unrecognized units that billing doesn’t use.
- Scope is explicit list of selected models (with “select all visible” in UI) to prevent accidental global updates.
- Full template export (`all_units_template`) is required so admins can see disabled modalities/units in XLS and enable them by setting a price.
- Full sync mode is optional and limited:
  - Deactivates missing units only for models that are present in XLS.
  - Does not touch selected models absent in XLS (prevents accidental wipe).
- Empty values for optional fields do not clear stored values: an empty cell/empty string means “not provided”.

Alternatives rejected:
- CSV: poorer UX for non-technical admins and more fragile with locales.
- “Single endpoint that both previews and applies”: harder to build safe UI.

## Design

Flow/components:
- Page: `src/routes/(app)/admin/billing/models/+page.svelte` (Model Pricing).
- Selection UX:
  - Add “Select all” checkbox in table header to select all currently visible (filtered) model rows.
  - Keep existing per-row checkboxes.
- Add actions near Refresh:
  - `Export XLSX`
  - `Import XLSX`

Export flow:
1. Admin selects models (or uses Select all visible).
2. Click `Export XLSX`.
3. In export modal choose export mode:
   - `Active only` (default)
   - `All units template` (recommended for enabling/disabling)
4. UI calls backend export endpoint with selected model ids and mode.
5. Browser downloads `.xlsx`.

Import flow (two-stage):
1. Admin selects models (or uses Select all visible).
2. Click `Import XLSX`.
3. In modal:
   - Upload `.xlsx`.
   - Choose import mode:
     - Default: `patch` (“only rows in file”).
     - Optional: `full_sync` (“deactivate missing units”).
4. Click `Preview`.
5. Preview shows:
   - counts: create/update-via-create/deactivate/no-op
   - warnings:
     - unknown `model_id` in file
     - `model_id` exists but not in selection scope
   - errors: template/validation/duplicates
6. If no errors, click `Apply import`.
7. On success, show RU toast and auto-refresh list.

XLSX template
- Sheet name: `RateCards`.
- Header row required.
- Column names are strict; column order is not.

Columns:
- Required columns:
  - `model_id` (string)
  - `modality` (string: `text|image|tts|stt`)
  - `unit` (string: strict whitelist, see below)
  - `raw_cost_per_unit_kopeks` (number; required iff `is_active` is TRUE; may be empty if `is_active` is FALSE)
- Optional columns:
  - `is_active` (TRUE/FALSE/1/0/yes/no; default TRUE)
  - `provider` (string; optional)
  - `model_tier` (string; optional)
  - `is_default` (TRUE/FALSE; optional; default false)
  - `model_name` (string; ignored by import, but may be populated by export for readability)
  - `comment` (string; ignored)

Strict whitelist:
- modality → allowed units:
  - `text`: `token_in`, `token_out`
  - `image`: `image_1024`
  - `tts`: `tts_char`
  - `stt`: `stt_second`

Export mode semantics

1) `active_only`
- Rows: only current active prices per `(model_id, modality, unit)`.
- `is_active` may be omitted or always TRUE.

2) `all_units_template`
- Rows: for each selected model, export exactly these 5 rows (all supported units):
  - `text/token_in`
  - `text/token_out`
  - `image/image_1024`
  - `tts/tts_char`
  - `stt/stt_second`
- For each row:
  - If an active entry exists: set `raw_cost_per_unit_kopeks` to the active price and `is_active=TRUE`.
  - If no active entry exists: set `is_active=FALSE` and leave `raw_cost_per_unit_kopeks` empty.
- This enables the admin to “turn on” a modality by setting `is_active=TRUE` and providing a price.

Import semantics (per XLS row), for current `BILLING_RATE_CARD_VERSION`:
- Key: `(model_id, modality, unit)` (version is implicitly current).
- Normalize:
  - Trim strings.
  - `modality` lowercased.
  - `unit` lowercased.
  - `is_active` default TRUE.
  - `raw_cost_per_unit_kopeks` parsing:
    - required if `is_active` is TRUE
    - accept int
    - accept float if `value.is_integer()`
    - reject otherwise
- If `model_id` unknown:
  - Preview warning; Apply skips.
- If `model_id` exists but not in `scope_model_ids`:
  - Preview warning; Apply skips.
- If `is_active = TRUE`:
  - If no current active entry exists for key: create new active entry.
  - If current active entry exists:
    - if price matches: no-op.
    - if price differs: create new active entry (new `id`, `created_at=now`) and deactivate previous active entry.
- If `is_active = FALSE`:
  - If active entry exists: deactivate it.
  - Else: no-op.

Field handling for new entries:
- `provider`, `model_tier`, `is_default` are taken from XLS columns if present and non-empty.
- Empty cell / empty string means “not provided” (do not clear stored values).
- If these fields are not provided for a row:
  - If there is an existing active entry for the key, copy them from it.
  - Else default: `provider=null`, `model_tier=null`, `is_default=false`.

Full sync (`full_sync`) mode:
- Only affects models that have at least one valid row in XLS.
- For each such model, for each allowed `(modality, unit)` pair from the strict whitelist (all 5 supported units across all modalities):
  - If pair is NOT present in XLS for that model, then deactivate the current active entry for that pair (if any).
- Models selected in UI but absent in XLS: ignored (no changes).

Contracts (if any): API / events + examples

Backend base prefix:
- Existing: `/api/v1/admin/billing`.

New endpoints (in `backend/open_webui/routers/admin_billing_rate_card.py`):

1) Export XLSX
- `GET /api/v1/admin/billing/rate-card/export-xlsx`
- Auth: admin (`Depends(get_admin_user)`), must respect existing wallet enable guard (`ensure_wallet_enabled`).
- Query params:
  - `model_ids`: repeated query param.
    - Example: `/rate-card/export-xlsx?model_ids=<id1>&model_ids=<id2>`
  - `mode`: `active_only` | `all_units_template` (default `active_only`)
- Response:
  - `200` with XLSX bytes
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename=rate-cards-<YYYY-MM-DD>-<HHmm>-selected.xlsx` (exact naming is implementation detail; must include `.xlsx`)
- Behavior:
  - Always operate on current `BILLING_RATE_CARD_VERSION`.
  - For `active_only`:
    - fetch active entries for selected models
    - reduce to exactly one “latest active” row per key `(model_id, modality, unit)` by taking max(`created_at`) among active rows
  - For `all_units_template`:
    - for each selected model, generate 5 rows (strict whitelist units)
    - fill prices/is_active from latest active entries when available
  - generate `.xlsx`

2) Import Preview
- `POST /api/v1/admin/billing/rate-card/import-xlsx/preview`
- Multipart form:
  - `file`: UploadFile
  - `mode`: string enum: `patch` | `full_sync`
  - `scope_model_ids`: JSON string containing an array of model IDs (must be provided; derived from UI selection)
    - Example: `scope_model_ids='["<id1>","<id2>"]'`
- Response JSON: `RateCardXlsxImportPreviewResponse`
  - `summary`:
    - `rows_total`
    - `rows_valid`
    - `rows_invalid`
    - `creates`
    - `updates_via_create`
    - `deactivations`
    - `noops`
  - `warnings`: list of `{ row_number, code, message, model_id? }`
  - `errors`: list of `{ row_number?, column?, code, message }`
  - `actions_preview`: optional list of first N planned actions for UI display (bounded)

3) Import Apply
- `POST /api/v1/admin/billing/rate-card/import-xlsx/apply`
- Same multipart fields as preview.
- Behavior:
  - re-parse XLS and compute plan (no server-side state between preview/apply)
  - if errors → 400 with details
  - apply actions:
    - For update-via-create: create new active entry then deactivate the previous active entry (matching existing UI semantics).
    - For deactivate: update existing active entry `is_active=false`.
  - return `RateCardXlsxImportApplyResponse`:
    - `summary` counts (same fields as preview)
    - `warnings`

Notes:
- XLS parsing and workbook generation uses `openpyxl`.
- `openpyxl` is sync; heavy work must run via `run_in_threadpool`.

Data (if any): schema + migrations + compatibility
- N/A: no schema changes.

Security/validation/logging rules:
- Only admin can import/export.
- Validate file extension and content type best-effort (`.xlsx`).
- Enforce maximum row limit (10_000) to avoid memory issues; error if exceeded.
- Log server-side summary (info) and validation failures (warning/error) using `logging`.

## Implementation Plan (ordered checklist)
1. Backend: add XLS helpers
   - Create utility module: `backend/open_webui/utils/rate_card_xlsx.py`
   - Functions:
     - `build_export_workbook(entries, models_by_id, mode) -> bytes`
     - `parse_import_workbook(file_bytes) -> ParsedRows`
     - `compute_import_plan(rows, scope_model_ids, mode, current_version) -> (summary, warnings, errors, actions)`
2. Backend: add endpoints to `backend/open_webui/routers/admin_billing_rate_card.py`
   - `GET /rate-card/export-xlsx`
   - `POST /rate-card/import-xlsx/preview`
   - `POST /rate-card/import-xlsx/apply`
3. Frontend: add API functions in `src/lib/apis/admin/billing.ts`
   - `exportRateCardsXlsx(token, { model_ids, mode }) -> Blob`
   - `previewRateCardsXlsxImport(token, formData) -> PreviewResponse`
   - `applyRateCardsXlsxImport(token, formData) -> ApplyResponse`
4. Frontend: UI changes in `src/routes/(app)/admin/billing/models/+page.svelte`
   - Add “Select all visible” checkbox for filtered rows.
   - Add Export modal:
     - export mode selection (active_only vs all_units_template)
   - Add Import modal:
     - file upload
     - import mode selection (patch vs full_sync)
     - preview display and apply
   - Wire RU toasts and auto-refresh (`loadData()`).
5. i18n:
   - Add EN and RU keys for new UI strings; RU explicitly required.
6. Tests (backend):
   - Add pytest tests for export modes, parsing/plan/apply logic and endpoints.

Parallel:
- i18n updates can be done in parallel with UI.
- Backend utility module and endpoint wiring can be done in parallel with frontend API additions.

Strict order:
- Backend export/import endpoints must exist before UI wiring.

## Affected Files
- CREATE: `backend/open_webui/utils/rate_card_xlsx.py` — XLSX build/parse/plan helpers.
- UPDATE: `backend/open_webui/routers/admin_billing_rate_card.py` — add export/preview/apply endpoints.
- UPDATE: `src/lib/apis/admin/billing.ts` — add export/import API functions.
- UPDATE: `src/routes/(app)/admin/billing/models/+page.svelte` — add select-all + import/export modals.
- UPDATE: `src/lib/i18n/locales/en-US/translation.json` — new i18n keys.
- UPDATE: `src/lib/i18n/locales/ru-RU/translation.json` — new RU i18n keys.
- CREATE: `backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py` — endpoint tests.

## Testing / Acceptance
Tests: unit / integration / e2e (as needed)
- Backend (pytest):
  - Export:
    - returns `200`
    - correct content type
    - workbook has sheet `RateCards` with required columns
    - `active_only` contains only latest active row per `(model_id, modality, unit)`
    - `all_units_template` contains exactly 5 rows per model and marks missing ones as `is_active=false` with empty price
  - Preview:
    - errors on invalid template, invalid unit/modality, duplicates
    - warning (not error) for unknown model_id
    - warning (not error) for model_id not in scope
    - error when `is_active=true` and `raw_cost_per_unit_kopeks` is missing/empty
  - Apply:
    - price change creates a new active entry and deactivates old
    - unchanged price produces no-op
    - `is_active=false` deactivates active entry
    - float `150.0` accepted; `150.5` rejected
  - Full sync:
    - deactivates missing units only for models present in file
    - does not touch models absent in file even if selected
- Frontend: manual verification.

Acceptance criteria (DoD):
- [ ] Admin can select one or many models and export rate-card prices to `.xlsx`.
- [ ] Export supports modes `active_only` and `all_units_template`.
- [ ] In `all_units_template`, disabled modalities/units are visible and can be enabled by setting `is_active=true` and providing a price.
- [ ] Admin can import `.xlsx` and see Preview with counts, warnings, and errors.
- [ ] Apply is blocked when Preview contains any errors.
- [ ] Unknown model ids and model ids outside selection scope appear as warnings and are skipped on Apply.
- [ ] Import preserves history: changing price creates new row and deactivates old row.
- [ ] Import supports explicit deactivation via `is_active=false`.
- [ ] Full sync mode deactivates missing units only for models present in the file.
- [ ] UI includes RU strings for all new labels/buttons/messages.
- [ ] No new dependencies added.

## Rollout / Rollback (if prod)
Rollout:
- Standard deployment (backend + frontend).
- Feature is admin-only; no user-facing changes unless admin applies import.

Rollback:
- Revert new endpoints and UI actions.
- No data rollback needed; imports create new historical rows and deactivate old.

## Observability
- Logs:
  - Export: info log with admin id/email and number of exported rows and export mode.
  - Preview: info log with parsed row count + error/warning counts.
  - Apply: info log with create/deactivate/no-op counts.
- Metrics: N/A.
- Alerts: N/A.

## Risks / Open Questions / TBD
Risks:
- Large XLS files may cause memory/time spikes; enforce row limits.
- Full sync mode is dangerous; ensure UI copy clearly communicates risk.

Open questions:
- N/A.

## Quick start
1. Start files/modules:
   - Backend: `backend/open_webui/routers/admin_billing_rate_card.py`
   - Frontend: `src/routes/(app)/admin/billing/models/+page.svelte`
2. Commands:
   - Backend tests: `pytest backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py`
   - Frontend typecheck: `npm run check`
3. Local setup: standard dev.
4. Manual verification:
   - In Admin → Billing → Model Pricing: select models, export as `all_units_template`, set prices for disabled units, import preview, apply, verify new active entries exist and old entries are deactivated.
