# Documentation + Memory Bank Consistency Cleanup

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

Documentation and `.memory_bank/` drifted over time:

- Examples contradicted project rules (e.g. `Any` in Python type-hint snippets).
- Integration-branch task consolidation left a completed `.memory_bank/branch_updates/*` entry unmerged.
- Compose command syntax drifted (`docker-compose` vs `docker compose`).

This makes onboarding slower and increases the chance of accidental guideline violations.

## Goal / Acceptance Criteria

- [x] Memory Bank rules and examples are aligned (no `Any` in examples; `requests` guidance is clear).
- [x] Integration-branch task updates are consolidated (`branch_updates` cleaned, `current_tasks` updated).
- [x] Airis-specific docs are easy to discover and navigable (sharded docs under `docs/airis/`).
- [x] Add a durable place to record “how we fixed it” for future reuse (`docs/solutions/`).

## Non-goals

- No runtime behaviour changes.
- No upstream docs rewrite (keep diffs small; prefer additive docs).

## Scope (what changes)

- Backend: N/A
- Frontend: N/A
- Config/Env: N/A
- Data model / migrations: N/A
- Docs:
  - `.memory_bank/*` consistency updates
  - `docs/airis/*` (new)
  - `docs/solutions/*` (new)

## Implementation Notes

- Key files/entrypoints:
  - `AGENTS.md`
  - `.memory_bank/guides/coding_standards.md`
  - `.memory_bank/patterns/api_standards.md`
  - `.memory_bank/workflows/code_review.md`
  - `.memory_bank/current_tasks.md`
  - `docs/airis/README.md`
  - `docs/solutions/documentation/2026-02-05__memory-bank-docs-consistency.md`
- API changes: none
- Edge cases:
  - Keep docs links relative and repo-local (no broken internal links).

## Upstream impact

- Upstream-owned files touched:
  - None (additive docs only under `docs/airis/`; existing upstream docs left intact).
- Why unavoidable:
  - N/A
- Minimization strategy:
  - Prefer additive docs + minimal edits to fork-owned documentation surfaces.

## Verification

- Docs link integrity: `python3 scripts/check_markdown_links.py` (0 broken links).
- Tests: N/A (docs-only).

## Task Entry (for branch_updates/current_tasks)

- [x] **[DOCS]** Documentation + Memory Bank consistency cleanup
  - Spec: `.memory_bank/specs/work_items/2026-02-05__docs__docs-memory-bank-consistency-cleanup.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Align Memory Bank rules/examples, consolidate task updates, standardize compose command snippets, and add sharded Airis docs + solutions log.
  - Tests: N/A (docs-only)
  - Risks: N/A

## Risks / Rollback

- Risks:
  - Low: documentation-only changes could confuse if links/paths are wrong (mitigated by link scan).
- Rollback plan:
  - Revert the docs commits (no data migrations or runtime changes).
