# Frontend Tests: Make Vitest Run Non-Interactive

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/frontend-vitest-noninteractive
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

`npm run docker:test:frontend` runs `npm run test:frontend`, which currently invokes:

`vitest --passWithNoTests`

When executed under `docker compose run` (TTY attached by default), Vitest enters watch mode and does not exit, which makes the command unusable for automation and lowers confidence in local/CI-style runs.

## Goal / Acceptance Criteria

- [ ] `npm run docker:test:frontend` exits after a single run (no watch mode).
- [ ] Existing callers that pass `-- --run ...` continue to work.

## Non-goals

- Changing the test suite itself or adding new frontend tests.

## Scope (what changes)

- Frontend:
  - Update `package.json` `test:frontend` to force non-interactive mode via `CI=1`
    (so `npm run test:frontend -- --run ...` callers don't fail on duplicated `--run`).

## Upstream impact

- Upstream-owned files touched:
  - `package.json`
- Why unavoidable:
  - Script definition is in the repo root.
- Minimization strategy:
  - Single-line script change only.

## Verification

- Frontend tests: `npm run docker:test:frontend`
- Targeted run (CI suite parity): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/routes/\\(app\\)/billing/balance/billing-balance.test.ts"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Make vitest non-interactive for docker test runs
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__frontend-vitest-noninteractive.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/frontend-vitest-noninteractive`
  - Started: 2026-02-15
  - Summary: Ensure `npm run docker:test:frontend` runs once and exits (no watch mode).
  - Tests: pending
  - Risks: Low.

## Risks / Rollback

- Risks:
  - Minimal; developers who want watch mode can run `vitest` directly.
- Rollback plan:
  - Revert this commit.
