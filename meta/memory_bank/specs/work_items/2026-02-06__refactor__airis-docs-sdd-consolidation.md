# Consolidate Airis process docs + SDD specs under `meta/`

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/airis-docs-sdd-consolidation
- Created: 2026-02-06
- Updated: 2026-02-06

## Context

Prior to this work item, Airis process artifacts were split across multiple roots:

- Memory Bank: `.memory_bank/**`
- SDD specs: `specs/**`
- Airis docs: `docs/airis/**`, `docs/solutions/**`, plus Airis-specific docs at repo root

This causes constant confusion about where plans/specs live and creates tooling drift (paths differ across
commands, scripts, and docs).

## Goal / Acceptance Criteria

- [x] All Airis process/planning docs are under a single repo directory: `meta/`
- [x] Memory Bank lives at `meta/memory_bank/**` (no `.memory_bank/` left)
- [x] SDD specs live at `meta/sdd/specs/**` and are discoverable via a wrapper `meta/tools/sdd`
- [x] Airis docs live at `meta/docs/**` (migrated from `docs/airis`, `docs/solutions`, and Airis-specific root docs)
- [x] `.claude/commands/*` no longer reference removed paths and `m_refactor.md` is not a 404 stub
- [x] Link checker passes: `python3 meta/tools/check_markdown_links.py`
- [x] SDD wrapper works:
  - `meta/tools/sdd find-specs --json` points at `meta/sdd/specs`
  - `meta/tools/sdd list-specs --json` lists the same specs as before

## Non-goals

- No runtime behavior changes (backend/frontend)
- No new dependencies
- No upstream documentation reshuffle under `docs/` (except moving Airis-specific shards out)

## Scope (what changes)

- Repo structure:
  - `.memory_bank/` -> `meta/memory_bank/`
  - `specs/` -> `meta/sdd/specs/`
  - `docs/airis/` -> `meta/docs/`
  - `docs/solutions/` -> `meta/docs/solutions/`
  - `docs/telegram-auth.md` -> `meta/docs/guides/telegram-auth.md`
  - `BILLING_SETUP.md` -> `meta/docs/guides/billing_setup.md`
  - `README-B2C-IMPLEMENTATION.md` -> `meta/docs/reference/b2c_implementation.md`
  - `CONTINUITY.md` -> `meta/docs/reference/continuity.md`
- Tooling:
  - `scripts/check_markdown_links.py` -> `meta/tools/check_markdown_links.py` (update scanned directories)
  - `scripts/merge_task_updates.sh` -> `meta/tools/merge_task_updates.sh` (update paths)
  - `scripts/setup_git_hooks.sh` -> `meta/tools/setup_git_hooks.sh`
  - Add `meta/tools/sdd` wrapper (always uses `meta/sdd/specs`)
- Docs/commands:
  - Update path references throughout `AGENTS.md`, `.claude/commands/*`, and migrated docs.
  - Update `.gitignore` for SDD tool artifacts new location.
- Guardrails:
  - Add `.githooks/pre-commit` to prevent accidentally re-introducing legacy roots (`.memory_bank/`, SDD-style `specs/{pending,active,completed}/`).

## Upstream impact

- Upstream-owned files touched: none (structure-only + Airis docs/tooling)
- Why unavoidable: N/A
- Minimization strategy: `git mv` (history-preserving) and narrow, mechanical path updates

## Verification

- Link checker: `python3 meta/tools/check_markdown_links.py`
- SDD wrapper:
  - `meta/tools/sdd find-specs --json`
  - `meta/tools/sdd list-specs --json`
- Ensure old roots no longer exist:
  - `test ! -d .memory_bank`
  - `test ! -d specs`
- Grep for stale path references:
  - `rg 'airis/(memory_bank|docs|sdd|tools)/' -S .`

## Task Entry (for branch_updates/current_tasks)

- [x] **[REFACTOR][DOCS][SDD]** Consolidate Airis docs + plans + specs under `meta/`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-06__refactor__airis-docs-sdd-consolidation.md`
  - Owner: Codex
  - Branch: `codex/refactor/airis-docs-sdd-consolidation`
  - Done: 2026-02-06
  - Summary: Move Memory Bank, SDD specs, Airis docs, and process scripts into `meta/`; add SDD wrapper + guardrails; fix path references.
  - Tests: `python3 meta/tools/check_markdown_links.py`, `meta/tools/sdd find-specs --json`, `meta/tools/sdd list-specs --json`, `meta/tools/sdd schema --json`
  - Risks: Medium (large mechanical move; mitigated by wrapper + link checking + grep).

## Risks / Rollback

- Risks:
  - Broken internal links or stale command snippets after migration.
  - Developers continuing to run raw `sdd` without `--specs-dir` and creating new root `specs/`.
- Rollback plan:
  - Revert this commit set (structure-only) or move directories back with `git mv` if needed.
