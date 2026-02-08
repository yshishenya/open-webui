# Deploy Script Options (No-Cache, Cached Rebuild, Safe Tagging)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: codex/feature/deploy-prod-script-options
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-08
- Updated: 2026-02-08

## Context

`scripts/deploy_prod.sh` currently accepts a single optional positional tag and otherwise tags images with
`git rev-parse --short HEAD`. This is fine for commit-based deploys, but it is awkward when:

- You want an explicit "no-cache" rebuild (e.g. to ensure a truly clean build).
- You want a fast rebuild using cache, while still guaranteeing that uncommitted local changes (dirty tree)
  are deployed under a unique tag (so prod actually pulls/runs the changed image).

## Goal / Acceptance Criteria

- [x] Script supports fast rebuild with cache (default) and explicit `--no-cache`.
- [x] Script can optionally pull base layers with `--pull`.
- [x] Script can force remote container recreation (`--force-recreate`) to avoid "same tag, no restart" surprises.
- [x] Default tag is safe for dirty working trees: if there are local diffs, tag becomes `<sha>-dirty-<hash>`.
- [x] Script offers an interactive dialog when invoked without arguments in a TTY (with a `--non-interactive` escape hatch).
- [x] Backward compatibility: `scripts/deploy_prod.sh <tag>` still works.
- [x] Deploy docs reflect the new flags and tagging behavior.

## Non-goals

- Changing the production compose model to build on prod.
- Adding new dependencies or CI changes.

## Scope (what changes)

- Backend: N/A
- Frontend: N/A
- Config/Env:
  - No required changes; `.env.deploy` remains supported.
- Data model / migrations: N/A

## Implementation Notes

- Key files/entrypoints:
  - `scripts/deploy_prod.sh`
  - `docs/DEPLOY_PROD.md`
- Tagging:
  - If the working tree is clean and no tag is provided: `TAG=<short-sha>`.
  - If dirty: `TAG=<short-sha>-dirty-<sha256-of-diffs>`.
  - Optional `--unique-tag` appends a UTC timestamp suffix.
- Remote deploy:
  - Keep `docker compose pull` + `docker compose up -d --no-build`.
  - Add optional `--force-recreate` on the remote `up`.

## Upstream impact

- Upstream-owned files touched: N/A
- Why unavoidable: N/A
- Minimization strategy: N/A

## Verification

- Bash syntax check: `bash -n scripts/deploy_prod.sh`
- Dry-run (non-interactive): `scripts/deploy_prod.sh --dry-run --non-interactive --no-cache --pull --force-recreate`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[DEPLOY-02]** Deploy script build options + safe tagging
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__feature__deploy-prod-script-build-options.md`
  - Owner: Codex
  - Branch: `codex/feature/deploy-prod-script-options`
  - Started: 2026-02-08
  - Summary: Add `--no-cache`/cached rebuild flags and safe tagging so prod always runs the intended image.
  - Tests: `bash -n scripts/deploy_prod.sh`
  - Risks: Low (deploy tooling only)

## Risks / Rollback

- Risks:
  - Unexpected tag changes could disrupt workflows that rely on a stable default tag.
- Rollback plan:
  - Revert `scripts/deploy_prod.sh` and `docs/DEPLOY_PROD.md` to previous behavior.
