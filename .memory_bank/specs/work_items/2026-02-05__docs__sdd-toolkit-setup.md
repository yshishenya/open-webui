# SDD toolkit: first-time project setup

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

We want to use the SDD (Spec-Driven Development) toolkit in this repo. The toolkit expects a small set of
project-local `.claude/` config files for permissions and behaviour.

## Goal / Acceptance Criteria

- [x] SDD install is verified (`sdd skills-dev verify-install --json` returns `overall: fully_installed`)
- [x] `.claude/settings.local.json` exists and `setup-permissions check` reports `fully_configured`
- [x] `.claude/git_config.json` exists and `session-summary` reports `git.needs_setup: false`
- [x] `.claude/sdd_config.json` exists (quiet + compact JSON output defaults)

## Non-goals

- No app/runtime behavior changes (backend/frontend)
- No new dependencies

## Scope (what changes)

- Config/Env:
  - Add `.claude/settings.local.json` (SDD permissions, git read-only)
  - Add `.claude/git_config.json` (git integration enabled, auto-branch/commit disabled by default)
  - Add `.claude/sdd_config.json` (quiet + compact JSON output, doc context enabled)

## Implementation Notes

- Commands used:
  - `sdd skills-dev verify-install --json`
  - `sdd skills-dev setup-permissions update . --non-interactive --enable-git --no-git-write`
  - `sdd skills-dev start-helper setup-git-config . --non-interactive --enabled --no-auto-branch --no-auto-commit --no-auto-push --show-files --no-ai-pr`
  - `sdd skills-dev start-helper ensure-sdd-config .`

## Upstream impact

- Upstream-owned files touched: none
- Why unavoidable: N/A
- Minimization strategy: additive local config only

## Verification

- `sdd skills-dev setup-permissions check . --json`
- `sdd skills-dev start-helper session-summary . --json`
- `sdd skills-dev start-helper inspect-config . --json`

## Task Entry (for branch_updates/current_tasks)

- [x] **[DEV]** SDD toolkit: first-time project setup
  - Spec: `.memory_bank/specs/work_items/2026-02-05__docs__sdd-toolkit-setup.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-02-05
  - Summary: Configure `.claude/` SDD permissions + defaults (git integration is read-only; no auto-commit/branch by default).
  - Tests: `sdd skills-dev setup-permissions check . --json`, `sdd skills-dev start-helper session-summary . --json`
  - Risks: N/A (local dev tooling config only)

## Risks / Rollback

- Risks:
  - If a dev expects auto-commit/auto-branch, they must enable git write permissions + update `.claude/git_config.json`.
- Rollback plan:
  - Delete `.claude/settings.local.json`, `.claude/git_config.json`, `.claude/sdd_config.json`.
