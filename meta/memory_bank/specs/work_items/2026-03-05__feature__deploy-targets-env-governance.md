# Multi-target deploy flow and env drift governance

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: feature/deploy-targets-and-env-governance
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

Current deployment flow is production-only oriented and relies on a single `.env.deploy`. Project now has three environments (local dev, demo server, prod server), and operators need a predictable way to deploy to any target and prevent `.env` key drift between servers without storing secrets in Git.

## Goal / Acceptance Criteria

- [x] Provide one command entrypoint to deploy to a selected target (`demo` or `prod`) without manual env-file swapping.
- [x] Keep target configs secret-safe (`.env` and deploy target files remain out of Git), with committed examples only.
- [x] Provide automation to check `.env` key drift versus `.env.example` on remote targets.
- [x] Provide automation to sync missing `.env` keys on remote targets (preserving current values).
- [x] Document an operator workflow for "dev -> demo -> prod" and `.env` governance.

## Non-goals

- Replacing Docker Compose deployment model.
- Migrating to external secret manager in this task.
- Changing application runtime env parsing.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Add target config examples for deploy (`deploy/targets/*.env.example`).
- Tooling/Scripts:
  - Add target-based deploy wrapper.
  - Add env target manager for remote check/sync.
  - Keep existing `scripts/deploy_prod.sh` as execution engine.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `scripts/deploy_target.sh`
  - `scripts/env_target_manager.py`
  - `deploy/targets/demo.env.example`
  - `deploy/targets/prod.env.example`
  - `docs/DEPLOY_PROD.md`
  - `meta/docs/guides/deployment.md`
- API changes:
  - None.
- Edge cases:
  - Missing target config file.
  - SSH auth/host resolution issues per target.
  - Remote env file path differs from `${PROD_PATH}/.env`.

## Upstream impact

- Upstream-owned files touched:
  - `docs/DEPLOY_PROD.md`
- Why unavoidable:
  - Main operator runbook lives here.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Additive scripts and examples; minimal doc updates in existing guide.

## Verification

- Script syntax: `bash -n scripts/deploy_prod.sh scripts/deploy_target.sh`
- Python syntax: `python3 -m py_compile scripts/env_target_manager.py`
- Help checks:
  - `scripts/deploy_target.sh --help`
  - `python3 scripts/env_target_manager.py --help`
- Deploy wrapper dry-run smoke:
  - `scripts/deploy_target.sh --target demo --yes --non-interactive --dry-run --skip-precheck`
  - `scripts/deploy_target.sh --target prod --yes --non-interactive --dry-run --skip-precheck`
- Env manager dry-run checks (local target config examples + expected failure for missing local config as applicable).
  - `python3 scripts/env_target_manager.py list`
  - `python3 scripts/env_target_manager.py check --target prod --allow-drift` (result: DRIFT found on prod)
  - `python3 scripts/env_target_manager.py sync --target prod --dry-run` (result: blocked by template hash mismatch guard)
  - `python3 scripts/env_target_manager.py sync --target prod --dry-run --allow-template-mismatch` (result: remote dry-run sync succeeded)
- SSH reachability:
  - `ssh -i ~/.ssh/airis_prod -o IdentitiesOnly=yes -o BatchMode=yes yan@185.130.212.71 'echo prod-ssh-ok'` (result: OK)
  - `ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new yan@dev.chat.airis.you 'echo demo-ssh-ok'` (result: host reachable, auth denied without machine-specific key)

## Task Entry (for branch_updates/current_tasks)

- [x] **[FEATURE][DEPLOY][ENV]** Multi-target deploy and env governance tooling
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__feature__deploy-targets-env-governance.md`
  - Owner: Codex
  - Branch: `feature/deploy-targets-and-env-governance`
  - Done: 2026-03-05
  - Summary: Added `deploy_target.sh` + `env_target_manager.py` with target templates and updated deploy docs for multi-target release flow and env drift governance.
  - Tests: `bash -n scripts/deploy_prod.sh scripts/deploy_target.sh`, `python3 -m py_compile scripts/env_target_manager.py`, `scripts/deploy_target.sh --help`, `scripts/deploy_target.sh --list-targets`, `scripts/deploy_target.sh --target prod --yes --non-interactive --dry-run --skip-precheck`, `python3 scripts/env_target_manager.py --help`, `python3 scripts/env_target_manager.py list`, `python3 scripts/env_target_manager.py check --target prod --allow-drift`, `python3 scripts/env_target_manager.py sync --target prod --dry-run`, `python3 scripts/env_target_manager.py sync --target prod --dry-run --allow-template-mismatch`
  - Risks: Low-Medium (operator tooling behavior)

## Risks / Rollback

- Risks:
  - Misconfigured target files can route deploy command to wrong host/path.
- Rollback plan:
  - Revert added scripts/docs and continue using `scripts/deploy_prod.sh` directly.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
