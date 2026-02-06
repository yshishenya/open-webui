# admin-billing-models-table

- Date: 2026-01-24
- Owner/Agent: Codex
- Links: N/A

## Summary

- Change: Convert admin model pricing list to a responsive table with modality icons-only (pill background) and tooltip summaries.
- Outcome: Faster scanning on desktop with tabular layout, while preserving mobile readability via card view.
- Constraints/assumptions: Use existing admin styles, Tailwind utilities, and Tooltip component (tippy.js).

## Context / Problem

- Why: Current list is a flex-based row layout with long metadata and modality text chips; the view feels less structured for scanning at scale.
- Current pain: Admins need to compare models quickly; modalities should be compact and meaningful without extra text.
- If bug: N/A.

## Goals / Non-goals

Goals:

- Provide a true table layout on desktop with clear columns for Model, Modalities, Status, Lead magnet, and Actions.
- Show modalities as icon-only pills with tooltip explanations.
- Keep mobile UX readable by switching to card view.
- Add sorting for table columns (at minimum: Model and Status).
  Non-goals:
- Changing backend APIs or data models.
- Reworking the modal editor or pricing logic.
- Introducing new dependencies.

## Behavior (AS-IS → TO-BE)

AS-IS:

- Models displayed as stacked flex rows with model name/id and action button.
- Modalities shown as text chips (icon + label + text).
- No sortable columns.
  TO-BE:
- Desktop: Render a `<table>` layout with headers.
- Mobile: Render card layout (stacked blocks) with the same data.
- Modalities shown as icon-only pills; tooltip shows short descriptions.
- Sorting: column header controls for Model (A→Z/Z→A) and Status (New/Configured).
  Edge cases / failures:
- Model has no active modalities → show empty placeholder (muted) with tooltip "No modalities configured".
- Model has many modalities → icons wrap to next line within cell (desktop) or inline row (mobile).
- Empty result set respects existing empty state UI.
  Concurrency/idempotency:
- N/A (read-only UI rendering).

## Decisions (and why)

- Use icon-only pills: reduces horizontal space, improves scan speed; tooltip keeps meaning.
- Responsive table + mobile cards: best of both worlds; avoids horizontal scrolling on mobile.
- Sorting in UI only: no backend changes needed; low risk.
  Alternatives rejected:
- Full table with horizontal scroll on mobile: poor UX.
- Text labels for modalities: too verbose for table density.

## Design

Flow/components:

- Desktop:
  - Table with columns: Model | Modalities | Status | Lead magnet | Actions.
  - Model cell: name (primary) + id (secondary).
  - Modalities cell: icon-only pills with subtle background color per modality; tooltip describes modality/unit.
  - Status: existing badge styles.
  - Lead magnet: existing badge or small pill (consistent with current style).
  - Actions: existing Add/Edit button (text or icon+tooltip if needed).
- Mobile:
  - Card layout per model.
  - Top row: Model name + Add/Edit.
  - Secondary row: ID + Modalities icons.
  - Footer row: Status + Lead magnet.

Contracts (if any): API / events + examples

- N/A.

Data (if any): schema + migrations + compatibility

- N/A.

Security/validation/logging rules:

- No new data entry. Tooltip content uses static i18n strings only.

## Implementation Plan (ordered checklist)

1. Update `buildModelRows` to expose ordered active modalities (already available if present; ensure icon-only flow uses this list).
2. Create modality icon map + tooltip text map in `admin/billing/models` page.
3. Implement desktop table layout with headers and sortable columns.
4. Implement mobile card layout with same data mapping.
5. Swap modality chips to icon-only pills; tooltip uses short text.
6. Add placeholder for empty modalities with tooltip.
7. Update i18n strings for short tooltip copy (EN/RU).
8. Update tests for `buildModelRows` if sorting or modality extraction changes.

Parallel:

- i18n strings can be updated in parallel with layout changes.
  Strict order:
- Sorting logic before rendering table headers.

## Affected Files

- UPDATE: `src/routes/(app)/admin/billing/models/+page.svelte` — table layout, sorting, icon-only modalities, mobile card view.
- UPDATE: `src/lib/utils/rate-card-models.ts` — ensure modality list ordering for UI.
- UPDATE: `src/lib/utils/rate-card-models.test.ts` — extend tests for modality list ordering and active-only filtering.
- UPDATE: `src/lib/i18n/locales/en-US/translation.json` — short tooltip copy.
- UPDATE: `src/lib/i18n/locales/ru-RU/translation.json` — short tooltip copy.

## Testing / Acceptance

Tests: unit / integration / e2e (as needed)

- Unit: update `rate-card-models.test.ts` to cover active-only modalities + ordering.
- UI manual checks on desktop + mobile breakpoints.

Acceptance criteria (DoD):

- [ ] Desktop layout renders a true table with headers and columns defined above.
- [ ] Mobile layout renders cards with clear model name, id, modalities, status, lead magnet, actions.
- [ ] Modalities render as icon-only pills with tooltips containing short descriptions.
- [ ] Empty modalities show muted placeholder with tooltip "No modalities configured".
- [ ] Sorting works for Model (A/Z) and Status (Configured/New).
- [ ] Existing empty-state UX still appears when no models match filters.
- [ ] i18n keys added for all new tooltip texts (EN/RU).
- [ ] No new dependencies introduced.

## Rollout / Rollback (if prod)

Rollout:

- Deploy as part of standard frontend release.
  Rollback:
- Revert `admin/billing/models` changes and i18n entries.

## Observability

- Logs: N/A.
- Metrics: N/A.
- Alerts: N/A.

## Risks / Open Questions / TBD

Risks:

- Sorting logic may conflict with existing filters if not applied consistently.
  Open questions:
- TBD: decide whether Actions column should be icon-only on desktop to reduce width.

## Quick start

1. Start files/modules: `src/routes/(app)/admin/billing/models/+page.svelte`.
2. Commands (Docker Compose-first):
   - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"` (optional)
   - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"` if unit tests updated
3. Local setup: standard dev server.
4. Manual verification: check desktop table at ≥1024px and mobile cards at ≤640px.
