# Fix deploy SSH precheck key hint and guidance

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/deploy-ssh-precheck-public-key-hint
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

During production deploy, `scripts/deploy_prod.sh` can fail on SSH precheck and prints a hint that says the "public key" path is `~/.ssh/airis_prod` (private key path without `.pub`). This is misleading and causes wrong troubleshooting actions.

## Goal / Acceptance Criteria

- [x] SSH precheck failure hint points to an actual public key path (`.pub`).
- [x] Copy/paste example remains correct when custom key/port are configured.
- [x] SSH precheck output includes underlying SSH diagnostic (e.g. hostname resolution failure).
- [x] Script behavior for successful deploy flow stays unchanged.

## Non-goals

- No redesign of deploy workflow.
- No change of default host/user semantics.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - None.
- Scripts:
  - Update SSH precheck troubleshooting output in `scripts/deploy_prod.sh`.

## Implementation Notes

- Key files/entrypoints:
  - `scripts/deploy_prod.sh` (SSH precheck troubleshooting output)
- API changes:
  - None.
- Edge cases:
  - `PROD_SSH_KEY` unset (fallback path)
  - `PROD_SSH_KEY` set with `~`
  - `PROD_SSH_PORT` set (non-default)

## Upstream impact

- Upstream-owned files touched:
  - `scripts/deploy_prod.sh`
- Why unavoidable:
  - User-visible deploy troubleshooting text is defined in this script.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Localized, minimal string/arg composition changes in precheck block only.

## Verification

- Syntax check: `bash -n scripts/deploy_prod.sh`
- Help smoke: `scripts/deploy_prod.sh --help`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][DEPLOY]** Fix misleading public key hint in deploy SSH precheck
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__bugfix__deploy-ssh-precheck-public-key-hint.md`
  - Owner: Codex
  - Branch: `bugfix/deploy-ssh-precheck-public-key-hint`
  - Done: 2026-03-05
  - Summary: SSH precheck now shows exact SSH error, points to `.pub` key path, and prints a copy/paste-safe `ssh-copy-id` command (including custom SSH port when configured).
  - Tests: `bash -n scripts/deploy_prod.sh`, `scripts/deploy_prod.sh --help`, `PROD_HOST=airis-prod PROD_SSH_KEY=~/.ssh/airis_prod scripts/deploy_prod.sh --yes --non-interactive --dry-run --skip-precheck`
  - Risks: Low (error-message only in deploy script)

## Risks / Rollback

- Risks:
  - Low; deploy runtime logic is unchanged.
- Rollback plan:
  - Revert this branch commit.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
