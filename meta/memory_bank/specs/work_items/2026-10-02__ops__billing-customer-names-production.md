# Deploy payment Customer names to production

- Type: ops / bugfix rollout
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-customer-names
- SDD Spec: meta/sdd/specs/completed/billing-customer-names-production-2026-10-02-002.json
- Created: 2026-10-02
- Spec: meta/memory_bank/specs/work_items/2026-10-02**bugfix**billing-customer-names.md

## Authorized scope

User explicitly requested production deployment of PR181. Preserve the current
production runtime by building an image layer on its exact digest. Replace the
compiled frontend and only the changed billing reporting helper. No schema,
provider, email, or unrelated configuration changes.

## Process and acceptance

- Account for PR CI and merge into airis_b2c.
- Freeze and build clean application sources; verify packaged reporting tests,
  file hashes, architecture, frontend version, and immutable registry digest.
- Preserve current runtime configuration and all neighboring services.
- Require validated database/data/configuration backups, 10 GiB free space,
  migration gate, original-image guard, and application-only recreation.
- Verify live image, public availability, report names and customer navigation.
- Retain the previous image as rollback; no automatic database downgrade.

## Evidence

- PR181 merged into `airis_b2c` at `8f78a9e1710590266fe598584785ea3595e9d05b`;
  all applicable CI checks passed. Application sources equal reviewed HEAD
  `ed3ea482cc3882d58cb650f1e8e5e5bd7721d892`.
- Clean native Node 22 frontend build, linux/amd64 overlay on the exact current
  production image. Packaged reporting tests: 7 passed.
- Verified 5,757 frontend files against the frozen build and 477 immutable
  backend files against the base; only `billing_reporting.py` changed.
- Packaging verification caught a nested Pyodide directory before publication;
  corrected it and confirmed all Pyodide files and paths equal the base.
- Published immutable image
  `yshishenya/yshishenya:customer-names-ed3ea482c-on-profile-20261002`,
  registry digest `sha256:c0a74440867e7c77a600e19dad05da8ee2b6fb53d10c213d2e89a74bb13effef`.
- Production deployed on 2026-10-02. Verified backups of PostgreSQL, globals,
  application data, and runtime configuration; archive checks and restore-list
  check passed. Backup directory:
  `/opt/backups/airis/20261002T195924Z-customer-names-ed3ea482c-on-profile-20261002`.
- Migration head retained at `q1c020261002`; previous image retained locally as
  rollback. The SSH connection stalled after app recreation. Reconnected and
  completed the same runtime, image, migration and health checks before atomic
  selector persistence, then closed the stale task-owned SSH connection.
- Verified live registry digest/platform, 5,757 frontend hashes and 476 immutable
  backend hashes. Runtime-generated `site.webmanifest` matches the verified
  frontend static copy. Environment, mounts, networks, ports, restart policy,
  command and all 14 neighboring container IDs are preserved.
- `.env` persists the new image selector; app healthy with zero restarts and
  11,633,000 KiB free disk, above the required 10 GiB threshold.
- Public `/health` and `/_app/version.json` return HTTP 200, with reviewed source
  marker `ed3ea482cc3882d58cb650f1e8e5e5bd7721d892`.
- Real production reporting route checked 8 payments: 8 nonempty profile names,
  all equal current profile values; no personal/payment data emitted in proof.
- Customer navigation and missing-name fallback verified by mounted frontend
  tests. Direct production admin browser inspection is unavailable in the current
  session because it has no admin role; no privilege changes were made.

Private operational artifacts:
/Users/yshishenya/.codex/private-artifacts/airis-customer-names-20261002
