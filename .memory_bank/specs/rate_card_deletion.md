# Rate Card Deletion (Admin)

Status: draft (2026-01-22)

## Goals

- Allow admins to delete rate card entries to remove outdated pricing rows.
- Support bulk deletion by model or specific rate card entries.
- Prevent accidental deletes with explicit confirmation in the UI.

## Non-Goals

- Deleting models themselves.
- Modifying billing history or usage events.

## API Changes

- DELETE `/api/v1/admin/billing/rate-card/{rate_card_id}` -> `bool`.
- POST `/api/v1/admin/billing/rate-card/bulk-delete` -> `{ rate_card_ids: string[] }` -> `{ deleted: int }`.
- POST `/api/v1/admin/billing/rate-card/delete-models` -> `{ model_ids: string[] }` -> `{ deleted: int }`.

## UI Changes

- Admin `/admin/billing/models` page adds row selection with select-all for current page.
- Bulk action bar allows:
  - Delete selected entries.
  - Delete all entries for selected models.
- Row actions add:
  - Delete entry.
  - Delete model pricing (all entries with same model_id).
- Confirmation dialog requires typing `DELETE` and shows counts before executing.

## Safety

- Deletion is only performed after explicit confirmation input.
- Bulk delete is disabled when no rows are selected.

## Tests

- Router tests for single delete and bulk delete by ids/models.
