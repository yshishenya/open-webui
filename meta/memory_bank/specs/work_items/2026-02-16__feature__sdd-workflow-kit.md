# Universal workflow kit (sdd-workflow-kit) bootstrap

## Meta

- Type: feature
- Status: done
- Owner: codex
- Branch: detached-head (worktree)
- SDD Spec (JSON, required for non-trivial): N/A (tooling scaffolding)
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

We want a universal repository that packages our workflow (Memory Bank + SDD + helper tools + skills) and can be pulled into any repo to bootstrap and keep scaffolding in sync without breaking existing CI.

## Goal / Acceptance Criteria

- [x] `sdd-workflow-kit` exists as a standalone git repo and can be added to a project as a submodule.
- [x] Project bootstrap creates managed scaffolding without overwriting unmanaged files.
- [x] Managed files can be checked for drift in CI (`sdd-kit check`) via a new additive workflow.
- [x] Memory Bank + meta/sdd + meta/tools scaffolds can be enabled via config (Airis profile).

## Non-goals

- Auto-detecting Docker Compose service names and generating perfect project-specific docker test commands.
- Migrating existing project-specific docs into Memory Bank automatically.

## Scope (what changes)

- Backend: N/A
- Frontend: N/A
- Tooling:
  - Add submodule `.tooling/sdd-workflow-kit`
  - Add bootstrap output: `AGENTS.md`, `.sddkit/config.toml`, `meta/**`, and `.github/workflows/sdd-kit-check.yml`

## Implementation Notes

- Safe mode: kit writes only managed files (marked in header). Existing unmanaged files are skipped.
- Local overrides: `.sddkit/fragments/AGENTS.append.md`
- Profiles:
  - `generic`: docs/specs scaffolds
  - `airis`: Memory Bank + `meta/sdd` + `meta/tools` (+ optional `.codex`)

## Upstream impact

Upstream-owned files touched: none (additive only).

## Verification

- `python3 .tooling/sdd-workflow-kit/bin/sdd-kit check --project .`

## Risks / Rollback

- Risks:
  - New docs/scaffolding may not match project-specific commands until customized in Memory Bank.
- Rollback plan:
  - Remove `.tooling/sdd-workflow-kit` submodule and delete generated managed files.
