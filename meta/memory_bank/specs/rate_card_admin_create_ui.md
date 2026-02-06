# Admin Rate Card Create UI

Status: draft (2026-01-22)

## Goals

- Make rate card creation faster for multiple models and modalities.
- Allow admins to pick multiple units with per-unit pricing.
- Provide a clear preview of how many entries will be created.

## Non-Goals

- Changing rate card API contracts.
- Changing billing calculations.

## UI/UX

- Replace single-model inputs with a model picker:
  - Searchable list of models with multi-select checkboxes.
  - Selected count indicator.
- Modality pricing cards:
  - Each modality shows units with checkboxes.
  - Cost input enabled only when unit is selected.
  - Text modality supports a link toggle for token_in/token_out prices.
- Shared fields:
  - effective_from, effective_to, is_active.
- Summary:
  - Displays models × units = total entries created.

## Validation

- Require at least one model selected.
- Require at least one unit selected.
- Validate cost for each selected unit (non-negative integer).

## Acceptance Criteria

- Create flow supports multiple models and multiple units per modality.
- Existing edit flow remains unchanged.
- Errors are surfaced via toast messages when missing required selections.
