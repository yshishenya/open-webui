# Frontend build version cache-bust for production chat

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-05
- Updated: 2026-08-05

## Context

Production was serving `/_app/version.json` with `dev-build`. The SvelteKit client therefore could not detect a newly deployed frontend while an existing tab remained open. The affected tab can keep stale JavaScript and leave chat navigation or message submission on the loading state even though the chat API returns `200`.

## Goal / Acceptance Criteria

- [x] Production serves a non-default immutable frontend build identifier.
- [x] Existing tabs can detect the new build and reload through the existing SvelteKit update path.
- [x] Production health, database revision, and persistent volumes remain intact.
- [x] A verified backup exists for the rollout and the previous image remains available for rollback.

## Non-goals

- No database schema or data migration.
- No deletion or recreation of PostgreSQL or application volumes.
- No change to chat API behavior.

## Scope

- Backend: none.
- Frontend: runtime build identifier only.
- Config/Env: derived production image layer changes `/_app/version.json` from `dev-build` to the immutable release identifier.
- Data model / migrations: none.

## Implementation Notes

- Reuse the current production image and add one small immutable layer; avoid a full frontend rebuild because the deployed application code is unchanged.
- Deploy through `scripts/deploy_guarded.sh --no-pull`, which creates and validates PostgreSQL/application-data backups, runs Alembic `upgrade head` as a hard gate, and preserves the previous image.

## Verification

- Confirm derived image `/_app/version.json` contains the release identifier.
- Run guarded production deploy.
- Verify `/health`, container health/restart count, Alembic revision, backup checksums, `pg_restore --list`, and tar listing.
- Confirm production image and volume identities after rollout.

## Result

- Derived image: `airis:cache-bust-20260805-fb13512cd` (`sha256:b7fcad7602f8c36f0d6461860b71755d15a5b3fbbb8aefd8e0c0e2b4e83e5f`).
- Production marker: `https://chat.airis.you/_app/version.json` → `fb13512cd`.
- Backup: `/opt/backups/airis/20260805T103400Z-cache-bust-20260805-fb13512cd/`.
- Production health: `{"status":true}`; PostgreSQL: healthy; users: 80; chats: 108; Alembic: `a91c0d8e4f62`; restarts: 0.
- No database migration was applied and no persistent volume was removed or recreated.

## Upstream impact

- Upstream-owned files touched: none.
- Why unavoidable: not applicable.
- Minimization strategy: production-only immutable image layer; source and API contracts unchanged.

## Risks / Rollback

- Risk: short `airis` container recreate during rollout.
- Rollback: use the rollback image retained by the guarded deploy; database is not downgraded automatically.
