# Payment funnel release acceptance

Status: Done
Owner: Codex
Branch: `codex/docs/onboarding-payment-funnel-acceptance`
Implementation Spec: [Payment attempt funnel](2026-10-02__feature__onboarding-payment-funnel.md)
SDD Spec: `meta/sdd/specs/completed/airis-onboarding-payment-funne-2026-10-02-959.json`

## Goal and result

Close the bounded aggregate report change after frozen-source and released read-only validation. Real pilot and calendar maturity remain separate final-plan gates.

- [x] PR149 merged; required CI passed for `ea4ad66ab6d2aa4bf7caf18b5d03a18aa04b6493`. Runtime source-to-merge diff is zero.
- [x] Source and frozen image604 backend checks/3 PostgreSQL-only skips; isolated PostgreSQL80 passed; touched-file quality passed.
- [x] Fresh database copy and previous-image rollback preserved71 tables/15282 rows; no schema or financial mutation.
- [x] Guarded release passed;416 backend/7006 retained frontend hashes match the candidate; environment, volumes, ports, networks and neighboring containers preserved.
- [x] Live HTTPS admin200/no-store, ordinary and anonymous denied. No private identifiers or provider payload exposed.
- [x] Independent live legacy diagnostic matches15 attempts:14 credited/1 canceled. Separate attempts/users and matching ledger windows verified. Diagnostic is not a pilot or a mature new cohort.
- [x] New observed registrations0; mature24h/7d/14d0. Missing evidence and zero-denominator rates remain null. Detailed cancellation cause remains unknown because the source does not retain it.
- [x] Shared empty-provider-ID credit regression failed before the guard and passed after it, including prior paid-user metrics.
- [x] Global mail remains disabled; no repeated control messages sent. SDD6/6 completed.
- [ ] Separate final gates: real pilot, new mature cohorts, responses and actual payment acceptance.

## Validation and upstream impact

Documentation only. Format/link/schema/policy checks apply; frozen runtime checks need no rerun. No runtime/dependency/schema/control changes or upstream-owned runtime files touched.
