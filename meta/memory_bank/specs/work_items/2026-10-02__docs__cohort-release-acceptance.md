# Registration cohort release acceptance

Status: Done
Owner: Codex
Branch: `codex/docs/onboarding-cohort-acceptance`
Implementation Spec: [registration cohort report](2026-10-02__feature__onboarding-cohort-report.md)
SDD Spec: `meta/sdd/specs/completed/airis-registration-cohort-repo-2026-10-02-817.json`

## Goal

Close the bounded report implementation after release validation without claiming the real calendar pilot complete. Publish only source-level evidence; operational artifacts and recipient data remain private.

- [x] Required source CI passed on `d37039df03d803a6d1d73b200b19163e0bb4c4a8` and PR145 merged.
- [x] Exact frozen image passed 587 backend checks and 63 isolated PostgreSQL checks; touched-file quality checks passed.
- [x] Fresh database copy and previous-image rollback preserved table/row counts; no schema changes.
- [x] Released runtime matches frozen source and retained frontend hashes; health and restart checks passed.
- [x] Independent live selection agrees with report aggregates; administrator no-store HTTPS route succeeds; other roles denied.
- [x] Output contains no identifiers/content; missing observations are null. Current consent/address eligibility is a snapshot, not historical permission or causal assignment.
- [x] SDD tasks 6/6 completed; implementation spec and branch log updated.
- [ ] Real pilot and mature 24-hour/seven-day/fourteen-day cohorts: separate final-goal gates; live population currently empty.

## Validation and upstream impact

Documentation only. Format/link/schema/policy checks apply to this change; runtime checks belong to the accepted frozen source above and are not rerun for unchanged runtime. No upstream-owned runtime files changed. No dependency, migration or release-control changes.
