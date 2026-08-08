# Docker Hub push authentication preflight

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/fix-dockerhub-push-auth
- SDD Spec (JSON, required for non-trivial): N/A (deployment guard and documentation)
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

Production uses the private Docker Hub image `yshishenya/yshishenya`. The build host had only a GHCR credential, so image builds succeeded and the later Docker Hub push failed with `denied: requested access to the resource is denied`. The prod host had its own Docker Hub credential, which does not authenticate the build host.

## Goal / Acceptance Criteria

- [x] Fail before an expensive build when the build host has no credential for the configured registry.
- [x] Explain the Docker Hub PAT requirement without exposing secrets.
- [x] Document the one-time login and offline fallback procedures.

## Non-goals

- No registry migration.
- No credential copying or secret rotation.
- No production application changes.

## Scope (what changes)

- Backend: none.
- Frontend: none.
- Deploy tooling: local registry credential preflight in `scripts/deploy_prod.sh`.
- Documentation: Docker Hub auth, troubleshooting, and target config guidance.

## Implementation Notes

- Resolve the registry host from `IMAGE_REPO`; unqualified repositories map to Docker Hub.
- Inspect Docker config auth entries and credential helpers without printing secret values.
- Skip the preflight for `--dry-run`; real deploys fail closed before `docker build`.

## Verification

- `bash -n scripts/deploy_prod.sh scripts/deploy_guarded.sh scripts/deploy_target.sh`
- `scripts/deploy_target.sh --target prod --tag 233c097b6 --yes --non-interactive --dry-run`
- Missing Docker Hub credential reproduced safely: local config exposes only GHCR; preflight reports the remediation before build.
- `git diff --check`

## Risks / Rollback

- Risks: Low; deploy-only preflight may require a one-time local `docker login` before registry-backed releases.
- Rollback plan: revert this commit; the existing guarded `--no-pull` offline flow remains available.

## Completion Checklist

- [x] Branch update entry marked Done.
