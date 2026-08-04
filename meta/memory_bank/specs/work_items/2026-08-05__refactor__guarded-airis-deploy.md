# Guarded Airis production deployment

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/guarded-airis-production-deplo-2026-08-05-0118.json`
- Created: 2026-08-05
- Updated: 2026-08-05

## Context

Production was running an emergency imported image after Docker image transfer/build constraints. The existing deploy path restarted containers without a verified database backup or a hard-fail migration gate. The latest `origin/airis_b2c` includes the missing Alembic merge revision `a91c0d8e4f62`, so the release must be rehearsed and deployed by immutable tag.

## Goal / Acceptance Criteria

- [x] Every production rollout creates and verifies PostgreSQL and application-data backups before changing the application container.
- [x] Alembic `upgrade head` runs directly in the candidate image and blocks rollout on failure.
- [x] The image is immutable and the target platform is verified as `linux/amd64`.
- [x] Health and database smoke gates pass after recreate; a failed application rollout restores the previous image without deleting volumes or automatically downgrading the database.
- [x] The runbook describes registry and preloaded-image paths, backup location, rollback limits, and recovery commands.

## Non-goals

- Automatic destructive PostgreSQL restore or Alembic downgrade.
- Deleting Docker volumes, pruning production data, or changing production secrets.
- Replacing the existing build/push engine before a registry/build host is available.

## Scope (what changes)

- Backend: none.
- Frontend: none.
- Config/Env: guarded deploy environment variables and target path documentation.
- Data model / migrations: no migration files; the latest source's merge revision is verified by the migration gate.
- Operations: additive `scripts/deploy_guarded.sh` and production runbook updates.

## Implementation Notes

- The script uses the existing Compose files and persistent volumes.
- PostgreSQL backup uses `pg_dump -Fc`, `pg_dumpall --globals-only`, checksums, `pg_restore --list`, and an application-data tar archive.
- Image rollback is automatic only for the container image. Database rollback requires an explicit incident decision and the preserved backup.

## Upstream impact

- Upstream-owned files touched: none.
- Fork-owned additive script and documentation only.

## Verification

- `bash -n scripts/deploy_guarded.sh`
- `scripts/deploy_guarded.sh --tag c48a79e8b --dry-run`
- Remote backup checksum/archive/restore-list verification.
- Latest image build, isolated migration rehearsal, remote health and Alembic-version smoke checks.

## Risks / Rollback

- Risk: migration can succeed while the new application later fails. The previous image is retained and restored automatically on health-gate failure; the database is intentionally not downgraded.
- Rollback: use the printed immutable previous image/backup paths; restore PostgreSQL only through an explicit, reviewed incident procedure.

## Completion Checklist

- [x] SDD tasks completed and SDD spec moved to `completed`.
- [x] Production backup, isolated migration rehearsal, guarded deploy, health, and database smoke checks passed.
