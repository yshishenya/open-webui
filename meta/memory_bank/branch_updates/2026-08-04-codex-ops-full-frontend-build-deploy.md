# Operations: full frontend build and rollout

- Spec: `meta/memory_bank/specs/work_items/2026-08-04__ops__full-frontend-build-deploy.md`
- Owner: Codex
- Branch: `codex/bugfix/lead-magnet-access-grants-v011-20260804`
- Started: 2026-08-04
- Status: blocked by host memory capacity
- Summary: Ran the complete frontend build in isolated, bounded containers. The first attempt hit Node heap OOM at 1.5 GiB; the second reached the client bundle but reduced host headroom to about 100 MiB and was stopped before production was affected.
- Verification: production `airis` stayed healthy with zero restarts; PostgreSQL and persistent volumes were not recreated or modified; temporary builder and dependency volume were removed.
- Pending: build on the user's local computer or a larger CI host, then package, backup, deploy only `airis`, and complete frontend/model/billing smoke checks.
- Git handoff: fast-forward push to `origin/airis_b2c` was attempted, but the server's GitHub deploy key is read-only; a write-capable credential is required.
