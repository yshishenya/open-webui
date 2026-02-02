# <Title>

## Meta

- Type: feature | bugfix | refactor | docs
- Status: draft | active | done
- Owner: <name/agent>
- Branch: <branch>
- Created: <YYYY-MM-DD>
- Updated: <YYYY-MM-DD>

## Context

What problem are we solving and why now?

## Goal / Acceptance Criteria

- [ ] …

## Non-goals

- …

## Scope (what changes)

- Backend:
  - …
- Frontend:
  - …
- Config/Env:
  - …
- Data model / migrations:
  - …

## Implementation Notes

- Key files/entrypoints:
  - …
- API changes:
  - …
- Edge cases:
  - …

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: `npm run docker:test:backend`
- Backend lint (ruff): `npm run docker:lint:backend`
- Frontend tests: `npm run docker:test:frontend`
- Frontend typecheck: `npm run docker:check:frontend`
- Frontend lint: `npm run docker:lint:frontend`
- E2E (when relevant): `npm run docker:test:e2e`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `.memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `.memory_bank/current_tasks.md`:

- [ ] **[<TAG>]** <Short title>
  - Spec: `.memory_bank/specs/work_items/<THIS FILE>`
  - Owner: <name/agent>
  - Branch: `<branch-name>`
  - Started: <YYYY-MM-DD>
  - Summary: <1–2 lines>
  - Tests: <what was run, or "N/A (docs-only)">
  - Risks: <1 line, or "N/A">

## Risks / Rollback

- Risks:
  - …
- Rollback plan:
  - …
