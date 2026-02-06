# AGENTS: Require Fresh Library Docs Before New Module/Component Work

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/agents-md-fresh-docs-rule
- Created: 2026-02-06
- Updated: 2026-02-06

## Context

We frequently track near-latest stable versions of libraries/providers. An assistant (or a human) should not rely on potentially stale built-in knowledge of APIs/behavior and must verify against current official documentation before implementing a new module/component.

## Goal / Acceptance Criteria

- [x] `AGENTS.md` explicitly instructs to treat dependency/library knowledge as stale and to consult the latest official online docs and release notes before building a new module/component or using an unfamiliar library/provider.

## Non-goals

- Changing any runtime behavior.
- Updating dependencies or version pins.

## Scope (what changes)

- Backend:
  - N/A
- Frontend:
  - N/A
- Config/Env:
  - N/A
- Docs:
  - Update root `AGENTS.md` mandatory checks.

## Implementation Notes

- Key files/entrypoints:
  - `AGENTS.md`
- API changes:
  - None
- Edge cases:
  - None

## Upstream impact

- Upstream-owned files touched:
  - None (documentation-only change in fork-owned `AGENTS.md`).

## Verification

- N/A (docs-only)

## Task Entry (for branch_updates/current_tasks)

- [x] **[DOCS]** AGENTS: require fresh library docs before new module/component work
  - Spec: `meta/memory_bank/specs/work_items/2026-02-06__docs__agents-md-fresh-docs-rule.md`
  - Owner: Codex
  - Branch: `codex/docs/agents-md-fresh-docs-rule`
  - Done: 2026-02-06
  - Summary: Add an explicit “docs freshness” rule so new work is based on current official online docs and release notes for the repo's dependency versions.
  - Tests: N/A (docs-only)
  - Risks: N/A

## Risks / Rollback

- Risks:
  - N/A
- Rollback plan:
  - Revert the `AGENTS.md` doc rule.
