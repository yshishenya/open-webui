# Fix Review Findings: Dev Port, Key Safety, Deploy Hints

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/review-findings-fixes-2026-02-24
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-24
- Updated: 2026-02-24

## Context

Detailed review on `airis_b2c` found issues that can break local dev flow and create security risk:
- Dev backend port changed to `8081`, but frontend dev API base still hardcoded to `8080`.
- Local TLS private key is present under `nginx/certs/*` and can be accidentally committed.
- Deploy troubleshooting tips around `ssh-copy-id` can be misleading when `PROD_SSH_KEY` is unset.

## Goal / Acceptance Criteria

- [x] Frontend dev API target aligns with backend dev port mapping and no hardcoded mismatch remains.
- [x] Private key/cert artifacts under `nginx/certs/` are ignored by git by default.
- [x] Deploy script/docs use safe fallback examples for SSH key path.
- [x] Targeted checks run for touched scripts/config/frontend constants (with noted environment limitation).

## Non-goals

- Full redesign/refactor of deploy workflow.
- Rotation of already-generated local cert files outside repository process.
- Broad cleanup of unrelated local working-tree changes.

## Scope (what changes)

- Backend:
  - No backend runtime logic changes.
- Frontend:
  - Align dev API port derivation in `src/lib/constants.ts` with dev compose mapping.
- Config/Env:
  - Add `.gitignore` rule for `nginx/certs/`.
  - Keep compose/docs/script hints consistent for dev/deploy path handling.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/constants.ts`
  - `docker-compose.dev.yaml`
  - `.env.example`
  - `.gitignore`
  - `scripts/deploy_prod.sh`
  - `docs/DEPLOY_PROD.md`
- API changes:
  - None.
- Edge cases:
  - Frontend dev should still work when a custom API port is provided.
  - Deploy helper output should stay copy/paste-safe with/without explicit `PROD_SSH_KEY`.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/lib/constants.ts`
  - `docker-compose.dev.yaml`
- Why unavoidable:
  - Port mismatch sits at frontend constants/dev overlay boundary.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small, localized edits only; no contract changes.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend lint (targeted): `npx eslint src/lib/constants.ts` (failed in sandbox due DNS/network to npm registry)
- Compose config sanity: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml config`
- Script syntax: `bash -n scripts/deploy_prod.sh scripts/dev_stack.sh`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][DEV][SEC]** Fix review findings for dev port sync and key safety
  - Spec: `meta/memory_bank/specs/work_items/2026-02-24__bugfix__code-review-findings-fixes.md`
  - Owner: Codex
  - Branch: `codex/bugfix/review-findings-fixes-2026-02-24`
  - Started: 2026-02-24
  - Summary: Remove frontend/backend dev port mismatch, prevent accidental TLS key commits, and fix deploy SSH key hint fallback.
  - Tests: `npx eslint src/lib/constants.ts`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml config`, `bash -n scripts/deploy_prod.sh scripts/dev_stack.sh`
  - Risks: Low-Medium (touches dev bootstrap and deploy helper docs/scripts).

## Risks / Rollback

- Risks:
  - Minor dev bootstrap behavior changes if custom local setups depend on old defaults.
- Rollback plan:
  - Revert this branch commit(s) and restore previous port/config behavior.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
