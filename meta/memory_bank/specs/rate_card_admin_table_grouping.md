# Admin Rate Card Table Grouping

Status: draft (2026-01-22)

## Goals

- Improve readability of rate card pricing by grouping entries per model.
- Keep entry-level edit, active toggle, and delete actions intact.
- Allow model-level selection for bulk actions.

## Non-Goals

- Changing rate card API contracts.
- Changing pricing logic or billing calculations.

## UI/UX

- Table groups rows by `model_id`.
- Group row shows:
  - Model ID and tier
  - Modality and unit chips (unique list)
  - Version/provider/effective date if consistent across entries
  - Active/default summary badges
  - Actions: delete model pricing
- Group rows are expandable/collapsible with a chevron control.
- Entry rows keep:
  - Modality/unit, raw cost, version/effective/provider
  - Active switch
  - Edit/delete actions
- Selection:
  - Page-level select-all remains
  - Group checkbox selects all entries for the model
  - Entry-level checkbox remains

## Acceptance Criteria

- Grouped table renders with same data as before.
- Entry-level actions behave unchanged.
- Bulk delete can target selected entries or models.
- Expand/collapse state toggles per model.
