# rate_card_xls_import_export
- Date: 2026-01-27
- Owner/Agent: OpenCode
- Links: N/A

## Summary
- Change: Add XLSX export/import for admin Rate Card prices (only latest active prices for the current billing rate card version).
- Outcome: Admin can mass-edit pricing in Excel and safely apply changes while preserving historical rate-card entries.
- Constraints/assumptions:
  - Only “actual/current” pricing version is supported: always use backend `BILLING_RATE_CARD_VERSION`.
  - Only latest active prices are exported/imported (no history import).
  - Unit whitelist is enforced (`token_in`, `token_out`, `image_1024`, `tts_char`, `stt_second`).
  - Price is stored as integer kopeks; during import allow `150` and `150.0` but reject `150.5`.
  - No audit logging required for this feature.
  - Add RU i18n strings for new UI.

## Context / Problem
- Why: Current admin pricing UI requires per-model manual editing. Bulk update across many models is slow and error-prone.
- Current pain:
  - No standard offline format for pricing change review.
  - No mass import pipeline that preserves rate-card history (create new entry + deactivate old).

## Goals / Non-goals
Goals:
- Export current active rate-card prices to `.xlsx`.
- Import `.xlsx` with a preview step (dry-run) and a separate apply step.
- Preserve pricing history semantics:
  - If price changes: create a new active entry and deactivate the previous active entry.
  - If price unchanged: no-op.
- Safety-first default scope: apply import only to selected models; allow “select all” in UI.
- Allow optional “Full sync (deactivate missing)” mode, but do not affect models absent in the file.
- Provide clear RU UI copy and validation feedback.

Non-goals:
- Import/export historical rows (`created_at` timeline).
- Manage/rotate `version` via XLS.
- Add audit logs, metrics, or background jobs.
- Change billing calculation logic.

## Behavior (AS-IS → TO-BE)
AS-IS:
- Admin manages pricing per model in `src/routes/(app)/admin/billing/models/+page.svelte`.
- Backend rate-card endpoints exist in `backend/open_webui/routers/admin_billing_rate_card.py`:
  - List/create/update/delete/deactivate.
- Changing price uses history semantics (new row + deactivate old).

TO-BE:
- Add two new admin features in Model Pricing page:
  - Export current prices to `.xlsx`.
  - Import `.xlsx` with Preview + Apply.
- Import and export always operate on the current `BILLING_RATE_CARD_VERSION` only.

Edge cases / failures:
- XLS contains rows for unknown `model_id`:
  - Preview shows warnings for those rows.
  - Apply skips those rows (does not fail the whole import).
- XLS contains invalid modality/unit/price:
  - Preview returns errors; Apply is blocked until fixed.
- XLS contains duplicate keys (same `model_id+modality+unit` more than once):
  - Preview returns error listing row numbers; Apply blocked.
- XLS missing required columns/sheet:
  - Preview returns error “Invalid template”.

Concurrency/idempotency:
- Import is not strictly idempotent because price changes create new rows.
- Safe idempotency rule:
  - If a row’s desired state already matches DB (same active price and active status), action = no-op.
  - Apply should not blindly create duplicates.

## Decisions (and why)
- Two-step import (Preview then Apply): prevents surprises and makes bulk operations safe.
- XLS without `version`: avoids accidentally modifying old/non-active pricing version.
- Price parsing accepts `150.0` as 150: Excel frequently stores integers as floats.
- Strict unit whitelist: prevents importing unrecognized units that billing doesn’t use.
- Full sync mode is optional and limited:
  - Deactivates missing units only for models that are present in XLS.
  - Does not touch models absent from XLS (prevents accidental wipe).

Alternatives rejected:
- CSV: poorer UX for non-technical admins and more fragile with locales.
- “Single endpoint that both previews and applies”: harder to build safe UI.

## Design

Flow/components:
- Page: `src/routes/(app)/admin/billing/models/+page.svelte` (Model Pricing).
- Add selection UX improvement:
  - “Select all” checkbox in table header selects all currently visible (filtered) model rows.
  - Keep existing per-row checkboxes.
- Add two actions near Refresh:
  - `Export XLSX`
  - `Import XLSX`

Export flow:
1. Admin selects models (or uses Select all).
2. Click `Export XLSX`.
3. UI calls backend export endpoint (selected model ids), receives an `.xlsx` file download.

Import flow (two-stage):
1. Admin selects models (or uses Select all).
2. Click `Import XLSX`.
3. In modal:
   - upload `.xlsx`
   - choose mode:
     - Default: “Patch (only rows in file)”
     - Optional: “Full sync (deactivate missing units)”
4. Click `Preview`.
5. Preview results show:
   - counts: create/update-via-create/deactivate/no-op
   - warnings (unknown model ids)
   - errors (template/validation/duplicates)
6. If no errors, click `Apply import`.
7. On success, show RU toast and auto-refresh list.

XLSX template:
- One sheet: `RateCards`.
- Header row required.
- Columns (order not strict, header names strict):
  - Required:
    - `model_id` (string)
    - `modality` (string: `text|image|tts|stt`)
    - `unit` (string: strict whitelist, see below)
    - `raw_cost_per_unit_kopeks` (number: integer or float with .0)
  - Optional:
    - `is_active` (TRUE/FALSE/1/0/yes/no; default TRUE)
    - `provider` (string; optional but supported)
    - `model_tier` (string; optional)
    - `is_default` (TRUE/FALSE; optional; default false)
    - `model_name` (string; ignored)
    - `comment` (string; ignored)

Strict whitelist:
- modality → allowed units:
  - `text`: `token_in`, `token_out`
  - `image`: `image_1024`
  - `tts`: `tts_char`
  - `stt`: `stt_second`

Import semantics (per XLS row), for the current `BILLING_RATE_CARD_VERSION`:
- Key: `(model_id, modality, unit)` (version is implicitly current).
- Normalize:
  - `modality` lowercased.
  - `unit` lowercased.
  - `raw_cost_per_unit_kopeks`:
    - accept int
    - accept float if `value.is_integer()`
    - reject otherwise
  - `is_active` default TRUE.
- If `model_id` unknown:
  - Preview warning; Apply skips.
- If `is_active = TRUE`:
  - If no current active entry exists for key: create new active entry.
  - If current active entry exists:
    - if price matches: no-op.
    - if price differs: create new active entry (with new `id` and `created_at=now`) and deactivate previous active entry.
- If `is_active = FALSE`:
  - If active entry exists: deactivate it.
  - Else: no-op.

Field handling for new entries (user chose “B” option):
- `provider`, `model_tier`, `is_default` are taken from XLS columns if present.
- If those columns are missing in a row:
  - If there is an existing active entry for the key, copy them from it.
  - Else default: `provider=null`, `model_tier=null`, `is_default=false`.

Full sync (Deactivate missing units) mode:
- Only affects models that have at least one valid row in XLS.
- For each such model, for each allowed `(modality, unit)` pair:
  - If pair is NOT present in XLS for that model, then deactivate current active entry for that pair (if any).
- Models selected in UI but absent in XLS: ignored (no changes), per user decision.

Contracts (if any): API / events + examples

Backend base prefix:
- Existing: `/api/v1/admin/billing`.

New endpoints (in `backend/open_webui/routers/admin_billing_rate_card.py`):

1) Export XLSX
- `GET /api/v1/admin/billing/rate-card/export-xlsx`
- Auth: admin (`Depends(get_admin_user)`), must respect existing wallet enable guard (`ensure_wallet_enabled`).
- Query params:
  - `model_ids`: repeated query param or comma-separated string (choose one implementation; document in code and tests)
  - `only_active`: bool, always true in MVP (can be omitted)
- Behavior:
  - fetch latest active entries for current `BILLING_RATE_CARD_VERSION` and selected models
  - generate `.xlsx` and return as attachment with content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

2) Import Preview
- `POST /api/v1/admin/billing/rate-card/import-xlsx/preview`
- Multipart form:
  - `file`: UploadFile
  - `mode`: string enum: `patch` | `full_sync`
  - `scope_model_ids`: JSON array or comma-separated list of model_ids (must be provided; derived from UI selection)
- Response JSON: `RateCardXlsxImportPreviewResponse`
  - `summary`: counts
  - `warnings`: list
  - `errors`: list
  - `actions`: optional list of planned actions (bounded; include first N for UI)

3) Import Apply
- `POST /api/v1/admin/billing/rate-card/import-xlsx/apply`
- Same multipart fields as preview.
- Behavior:
  - re-parse XLS and compute actions (no server-side state between preview/apply)
  - if errors → 400 with details
  - apply actions in order:
    - create new entries
    - deactivate old entries
  - return `RateCardXlsxImportApplyResponse` with counts + warnings.

Notes:
- XLS parsing and workbook generation uses `openpyxl` (already in backend requirements).
- Because openpyxl is sync, wrap heavy work in `run_in_threadpool`.

Data (if any): schema + migrations + compatibility
- N/A: no schema changes.

Security/validation/logging rules:
- Only admin can import/export.
- Validate file extension and content type best-effort (`.xlsx`).
- Enforce maximum rows (recommendation: 10_000) to avoid memory issues; return error if exceeded.
- Log server-side summary (info) and validation failures (warning/error) using `logging` (no `print`).

## Implementation Plan (ordered checklist)
1. Backend: add XLS helpers
   - Create utility module (recommendation): `backend/open_webui/utils/rate_card_xlsx.py`
   - Functions:
     - `build_export_workbook(entries, models_by_id) -> bytes`
     - `parse_import_workbook(file_bytes) -> ParsedRows`
     - `compute_import_plan(rows, scope_model_ids, mode, current_version) -> (summary, warnings, errors, actions)`
2. Backend: add endpoints to `backend/open_webui/routers/admin_billing_rate_card.py`
   - `GET /rate-card/export-xlsx`
   - `POST /rate-card/import-xlsx/preview`
   - `POST /rate-card/import-xlsx/apply`
3. Frontend: add API functions in `src/lib/apis/admin/billing.ts`
   - `exportRateCardsXlsx(token, { model_ids }) -> Blob`
   - `previewRateCardsXlsxImport(token, formData) -> PreviewResponse`
   - `applyRateCardsXlsxImport(token, formData) -> ApplyResponse`
4. Frontend: UI changes in `src/routes/(app)/admin/billing/models/+page.svelte`
   - Add “Select all” checkbox for filtered rows.
   - Add Export modal + Import modal.
   - Wire toasts and auto-refresh (`loadData()`).
5. i18n:
   - Add EN and RU keys for new UI strings; RU explicitly required.
6. Tests (backend):
   - Add pytest tests for parsing/plan/apply logic and endpoints.

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
  - Export endpoint returns `200` and correct content type for selected model(s).
  - Preview returns errors on invalid template, invalid unit/modality, duplicates.
  - Preview returns warning (not error) for unknown model_id.
  - Apply:
    - price change creates a new active entry and deactivates old.
    - unchanged price produces no-op.
    - `is_active=false` deactivates active entry.
    - float `150.0` accepted; `150.5` rejected.
  - Full sync:
    - deactivates missing units only for models present in file.
    - does not touch models absent in file even if selected.
- Frontend: manual verification (no automated tests required for MVP).

Acceptance criteria (DoD):
- [ ] Admin can select one or many models and export current rate-card prices to `.xlsx`.
- [ ] Exported `.xlsx` contains required columns and only latest active prices for current `BILLING_RATE_CARD_VERSION`.
- [ ] Admin can import `.xlsx` and see Preview with counts, warnings, and errors.
- [ ] Apply is blocked when Preview contains any errors.
- [ ] Unknown model ids in XLS show as warnings and are skipped on Apply.
- [ ] Import preserves history: changing price creates new row and deactivates old row.
- [ ] Import supports explicit deactivation via `is_active=false`.
- [ ] Full sync mode deactivates missing units only for models present in the file.
- [ ] UI includes RU strings for all new labels/buttons/messages.
- [ ] No new dependencies added.

## Rollout / Rollback (if prod)
Rollout:
- Standard deployment (backend + frontend).
- Feature is admin-only; no user-facing billing changes unless admin applies import.

Rollback:
- Revert new endpoints and UI actions.
- No data rollback needed; imports create new historical rows and deactivate old.

## Observability
- Logs:
  - Export: info log with admin id/email and number of exported rows.
  - Preview: info log with parsed row count + error/warning counts.
  - Apply: info log with create/deactivate/no-op counts.
- Metrics: N/A.
- Alerts: N/A.

## Risks / Open Questions / TBD
Risks:
- Large XLS files may cause memory/time spikes; enforce row limits.
- Full sync mode is dangerous; ensure UI copy clearly communicates risk.

Open questions:
- N/A (requirements confirmed).

## Quick start
1. Start files/modules:
   - Backend: `backend/open_webui/routers/admin_billing_rate_card.py`
   - Frontend: `src/routes/(app)/admin/billing/models/+page.svelte`
2. Commands:
   - Backend tests: `pytest backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py`
   - Frontend typecheck: `npm run check`
3. Local setup: standard dev.
4. Manual verification:
   - In Admin → Billing → Model Pricing: select models, export, edit XLS, preview import, apply, verify prices update and old entries deactivate.