# Default local Docker stack should match prod container shape

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-27
- Updated: 2026-03-27

## Context

Our default local Docker helpers were launching the split HMR stack (`airis` backend + `airis-frontend` Vite container), while production runs a single `airis` app container plus infrastructure. That mismatch caused operator confusion, wrong URL expectations, and made local runtime shape differ from prod by default.

## Goal / Acceptance Criteria

- [x] Default local `docker:up` launches a prod-like container set.
- [x] Split HMR workflow remains available as an explicit opt-in command.
- [x] Helper/docs wording makes the difference between prod-like and HMR modes obvious.
- [x] The resulting default stack is verified with live `docker compose` status and health checks.

## Non-goals

- Rewriting test commands that intentionally use `docker-compose.dev.yaml`
- Removing the HMR frontend service from the repo
- Changing production compose behavior

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Adjust npm Docker helper commands so default startup is prod-like.
  - Keep a separate explicit HMR startup helper.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `package.json`
  - `scripts/dev_stack.sh`
- API changes:
  - None.
- Edge cases:
  - `docker:down` should clean both prod-like and HMR runs.
  - `docker:logs` should not hide running services when switching modes.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - None. Local project tooling only.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the change limited to repo-local helper scripts and task docs.

## Verification

Docker Compose-first commands (adjust if needed):

- Default stack: `npm run docker:down && npm run docker:up`
- Container shape: `docker compose -f docker-compose.yaml ps`
- Health: `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/health`
- HMR opt-in still available: `npm run docker:down && npm run docker:up:hmr`
- HMR API health: `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8081/health`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[REFACTOR][DEV][DOCKER]** Make default local stack match prod container layout
  - Spec: `meta/memory_bank/specs/work_items/2026-03-27__refactor__dev-default-prod-like-compose.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Started: 2026-03-27
  - Summary: Switch the default local Docker helper to the single app-container shape used in production, while keeping split HMR as an explicit opt-in mode.
  - Tests: `npm run docker:down && npm run docker:up`; `docker compose -f docker-compose.yaml ps`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/health`; `npm run docker:down && npm run docker:up:hmr`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8081/health`
  - Risks: Low (dev tooling only; mode switching clarified).

## Risks / Rollback

- Risks:
  - Team members used to the old `docker:up` behavior may need to use the explicit HMR command.
- Rollback plan:
  - Restore previous npm helper mappings in `package.json` and helper copy in `scripts/dev_stack.sh`.

## Completion Checklist

- [ ] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [ ] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
