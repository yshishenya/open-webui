# Normalize Dev Compose UI Entrypoint

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-27
- Updated: 2026-03-27

## Context

The existing dev stack exposed the baked frontend from the backend image on `localhost:3000` while the editable Vite frontend lived on `localhost:5173`. This made it easy to validate the wrong UI and conclude local frontend fixes were broken.

## Goal / Acceptance Criteria

- [x] Provide a single standard dev command that starts the editable frontend on `localhost:3000`.
- [x] Keep backend API available on a stable separate port.
- [x] Verify both URLs respond after startup.

## Non-goals

- Rework the production compose topology.
- Remove the extra backend port published by the base compose file.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Add a package script that launches the dev stack with frontend on `3000` and API on `8081`.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `package.json`
- API changes:
  - None.
- Edge cases:
  - Host port `8080` was already occupied locally, so the helper uses `8082` for the extra baked backend port inherited from base compose.

## Upstream impact

- Upstream-owned files touched:
  - `package.json`
- Why unavoidable:
  - The repo needed a first-class dev command to make the correct local URL obvious.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Added one npm script only; no compose semantics were changed.

## Verification

- `npm run docker:up:dev`
- `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000`
- `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8081/health`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][DEV]** Normalize dev compose UI entrypoint
  - Spec: `meta/memory_bank/specs/work_items/2026-03-27__bugfix__dev-compose-single-ui-entrypoint.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-03-27
  - Summary: Added a standard `npm run docker:up:dev` command that publishes the editable Vite frontend on `3000` and keeps the backend API on `8081`, avoiding confusion with the baked UI from the backend image.
  - Tests: `npm run docker:up:dev`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8081/health`
  - Risks: Low (dev-only launch helper).

## Risks / Rollback

- Risks:
  - Minimal; this only affects the new helper command.
- Rollback plan:
  - Remove the `docker:up:dev` script from `package.json`.

## Completion Checklist

- [x] No SDD spec required for this trivial bugfix.
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
