# AIRIS onboarding payment attempt funnel

Status: In Progress
Owner: Codex
Branch: `codex/feature/onboarding-payment-funnel`
SDD Spec: `meta/sdd/specs/active/airis-onboarding-payment-funne-2026-10-02-959.json`

## Goal and measurable criteria

Extend the existing protected registration cohort report with payment attempts created during registration+[0,14d), counting only fully mature accounts. Reuse exact provider/ledger credit proof and async ORM; no new dependency, route, schema or financial mutation.

- [ ] Attempts and users counted separately; repeated report reads never add facts. Exact matching ledger time must be inside the same14d window; future/late credit excluded from attempt conversion.
- [ ] Status groups are disjoint and sum to total attempts: credited, provider succeeded without in-window credit, authoritative cancellation, local creation failure, processing and unresolved. Current status is explicitly a snapshot, not historical status at day14.
- [ ] Fraction denominators are attempt/user populations respectively; zero denominators produce null. Immature account attempts remain outside mature conversion.
- [ ] Cancellation reason is null because source sanitization lacks detailed provider cause. Local create_failed is distinguishable; no inference that every cancellation is an AIRIS failure.
- [ ] Output contains aggregate facts only; arbitrary provider strings, payment/recipient identifiers and raw payload are not exported. Existing admin/no-store protections retained.
- [ ] Source, frozen image, PostgreSQL, required CI, compatible rollback and guarded live read-only acceptance verified.

## Reuse and upstream impact

Modify fork-owned onboarding_report and add one empty-provider-ID guard to the shared credited_condition used by every caller, reuse existing report tests, credited_condition/canceled_condition and models. No upstream-owned files or dependencies. Existing pinned SQLAlchemy2.0.50/Pydantic2.13.4 retained; their official query/correlation documentation was read for the preceding report/email implementation; no integration/API change.

## Limits and validation

A credited user can have a payment initiated before registration; the existing gross paid-user metric includes it if ledger falls within14d, while the attempt funnel includes only attempts initiated within14d. Detailed cancellation cause/history is not retained and remains unknown. Recorded current statuses and late outcomes are not rewritten as historical14d states. Backend Compose focused/full tests and touched-file Black/Ruff, exact image and isolated PostgreSQL, CI and release checks apply; frontend runtime unchanged.

Root credit guard: a nonempty provider ID is mandatory even if a malformed empty ledger reference would otherwise match. The regression checks both existing gross paid metrics and the new attempt funnel.

Source verification: empty-provider-ID regression failed before the shared guard; final full backend604 passed /3 PostgreSQL-only skips and isolated PostgreSQL80 passed. Black/Ruff and SDD schema/policy passed. Frozen image, CI, compatible rollback and live release remain pending.
