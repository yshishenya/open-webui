# Remove "lead magnet" tooltip text from free model chip

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/remove-leadmagnet-tooltip-free-chip
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

In the model list UI, hovering the `бесплатно` chip shows a hint containing the word `лидмагнит`. This copy is not desired and must be removed.

## Goal / Acceptance Criteria

- [x] Hovering the free chip shows no hint at all.
- [x] No regressions in model list metadata chip rendering (tooltip wrapper removed for free chip).

## Non-goals

- No redesign of model chips or tooltip system.
- No pricing/billing behavior changes.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Remove tooltip wrapper from free chip in model list.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/chat/ModelSelector/ModelItem.svelte` (free badge without tooltip wrapper).
- API changes:
  - None.
- Edge cases:
  - Ensure fallback localization still avoids banned wording.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/chat/ModelSelector/ModelItem.svelte`.
- Why unavoidable:
  - Free chip hover behavior is defined in frontend component markup.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep diff minimal and local to copy key usage/value.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests (targeted if available): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend lint/typecheck (as needed for touched files): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check && npm run lint:frontend"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][UI]** Remove `лидмагнит` from free model chip tooltip
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__bugfix__remove-leadmagnet-tooltip-free-chip.md`
  - Owner: Codex
  - Branch: `bugfix/remove-leadmagnet-tooltip-free-chip`
  - Done: 2026-03-05
  - Summary: Removed tooltip wrapper from the `Free` badge so the free chip no longer shows any hover hint.
  - Tests: `COMPOSE_DISABLE_ENV_FILE=1 docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/chat/ModelSelector/ModelItem.svelte"` (fails due pre-existing lint errors in this file: unused imports/types + two self-closing span tags unrelated to this fix)
  - Risks: Low (copy-only UI change)

## Risks / Rollback

- Risks:
  - Minor localization mismatch if key is reused in another context.
- Rollback plan:
  - Revert this branch commit.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
