# AIRIS shared send eligibility policy

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/mail-send-eligibility
- Created: 2026-10-03
- SDD Spec: meta/sdd/specs/active/airis-shared-send-eligibility--2026-10-03-0902.json

## Goal

Make the existing account/scenario/personal-frequency decision reusable by the future eligibility journal without copying rules or importing the SMTP worker. Retain the worker release/dry-run/pilot/product switches and final rechecks. This prerequisite does not implement historical observation or close plan08.09/09.07.

## Measurable acceptance

- [x] Before extraction, characterize reasons and deferral timestamps against controlled SQLite/PostgreSQL facts.
- [x] Shared decision returns the same account, address, consent, scenario and personal-frequency outcomes for ready, deleted/inactive, unverified/changed address, absent consent, complaint, expired window, activation state, unresolved payment and frequency.
- [x] Every dispatch control remains enforced before sending; disabled releases/dry-run/nonpilot/global product off never reach transport. Shared business eligibility can be ready while release is disabled, clearly distinguished from authorization to send.
- [x] Repeated decision reads execute zero DML, enqueue and SMTP calls; no new model/schema/endpoint/dependency.
- [x] Existing post-AUTH permission/content/expiry checks, replay and concurrency regressions pass. Full backend, focused PostgreSQL, changed-file Ruff/Black and exact-head CI pass.
- [ ] Frozen candidate and guarded production acceptance preserve configuration, neighbor services and mail-off settings; document evidence before closing SDD.

## Design and upstream impact

Move account_email_reason and the existing business decision sequence into a fork-owned email_eligibility helper. Keep permission_decision in email_queue as the thin release switch gate and delegate its business portion. Preserve deleted-account precedence and all existing reasons/timestamps. SMTP capacity, content rechecks and journal writes stay outside the helper. Upstream-owned files are untouched.

## Version compatibility and sources

Reuse repo/runtime SQLAlchemy2.0.50 and Pydantic2.13.4; no dependency introduced/replaced. Official SQLAlchemy2.0 asyncio/session concurrency documentation reread on2026-10-03; latest release metadata had already established the explicit compatibility exception for the read-only report block. Upgrade remains a separate locked-runtime/migration/billing verification item. Preserve AsyncSession per task and existing ORM/session boundaries.

## Remaining scope

The durable journal, declared populations, complete runs, recorded start and historical denominator remain a separate feature. No observation timestamp is inferred or backfilled by this refactor, and no pilot or production mail flag is enabled.

## Source verification

Before extraction15 explicit expected reason/deferral cases passed. After extraction88 focused SQLite passed/1 PostgreSQL-only skip;714 full backend passed/3 PostgreSQL-only skips;122 PostgreSQL queue/scenario/report checks passed. After simplifying only the test setup,22 final cases passed again on each SQLite and PostgreSQL. Changed-file Ruff/Black and SDD validation passed. No journal/schema/provider/transport configuration changes. Frozen production acceptance remains pending.
