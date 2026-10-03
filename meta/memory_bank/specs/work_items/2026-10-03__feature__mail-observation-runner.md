# AIRIS bounded mail observation runner

Type: feature. Status: active; implemented, final verification in progress. Base: airis_b2c after accepted PR203/204. Scope: a callable observation runner, no scheduled execution, HTTP controls, enqueue or SMTP hooks. Overall plan189/244 and08.09/09.07 remain open.

## Final block result and measurable criteria

Read every declared member, including inactive/unverified/no-consent members, and save send_eligibility decisions and changed reasons in the accepted durable journal. One completed pass proves all members visited; missing original sources and bounded resource failures remain visible and cannot imply a complete eligible denominator.

- [x] All four account scenarios use canonical source windows: welcome[registration,7d), activation[24h,7d), paid value[72h,7d), feedback[14d,21d). Read all six types irrespective of global release/dry-run/pilot switches; observation alone authorizes0SMTP.
- [x] Payment keys are internal IDs. Each actual topup payment inside declared payment bounds has credited/help observations; source verification is delegated to shared send_eligibility. Provider success without an exact applied ledger entry never becomes ready.
- [x] A scope may declare an explicit future payment upper bound. Observation reads only created_at<=real current time; no future record becomes a fact. Registration membership remains a frozen existing population and no past observed_from is manufactured. Add regression tests for inverted windows and late actual payments.
- [x] If no payment exists, store bounded no_scenario_v1 negative placeholders. A later actual payment creates its own scenario without rewriting the placeholder. Deleted payment history becomes source_unavailable using its immutable original window.
- [x] An existing submission cannot be treated as a newly eligible historical fact or linked as a new job. Preserve original first_eligible_at if already observed; record historical_submission as the current negative decision. Queue data is read only.
- [x] Deleted members with existing history get deleted_account transitions; if deletion occurred before first observation, do not invent a registration window. Visit that member with0reconstructable scenarios and count it as a missing source. Reporting must treat its coverage as unavailable.
- [x] Bound pages to25members, up to100current payment sources/member and256historical scenarios/member. Detect limit+1 and fail the pass as coverage_lost, never silently truncate or complete it. Timeout<=30seconds per page; valid leases/atomic cursor semantics remain in storage.
- [x] On failure roll back the whole page; record a safe failed-run reason separately.0Payment/Ledger/consent/queue/SMTPmutations. Claim contention produces a busy result without page writes. Lost owner cannot fail another owner's pass.
- [x] SQLite/PostgreSQL: all-six-type independent expected results; source/consent changes; historical attempts; first-positive preservation;250members across bounded pages/restart; timeout/failure/cap; money and transport isolation.
- [ ] Full backend, changed-fileBlack/Ruff, exact-sourceCI and frozen-imagePostgreSQL/APIproof pass; guarded release keeps dispatchoff. Only a clearly labelled diagnostic observe group may be exercised on real ordinary accounts; it is never called a volunteer pilot.
- [ ] PublicSDD/workitem/guide/branchlog and private proofs complete. Admin controls, queue association, coverage-aware report and real24h/72h/14dpilot remain separate blocks.

## Implementation contract

Add fork-owned utils/airis/email_observer.py. Reuse declare/claim/page/save/fail storage primitives and the accepted shared eligibility helper, with independent async sessions and bounded transactions. Existing source windows must not be changed after first observation. No account_candidates filter or consent-prefiltered population is used. No raw message/address/provider response is persisted. Log only bounded reasons and exception class names.

Storage delta: allow future payment windows without allowing future registration membership; add historical_submission to the safe reason vocabulary. No schema migration or dependency change. Reuse runtimeSQLAlchemy2.0.50 under the already documented compatibility exception and async transaction/concurrency documentation. Dependency upgrade remains a separate verified-runtime rebuild.

Upstream impact: none; only fork-owned journal/helper/test/docs files. No main/router/frontend hooks in this block.

SDD Spec: meta/sdd/specs/active/airis-mail-observation-runner-2026-10-03-001.json
Branch: codex/feature/mail-observation-runner


## Dependency verification and review

Official SQLAlchemy download and 2.0 async/transaction docs checked on2026-10-03: latest stable2.1.3 (2026-10-02), maintenance2.0.54. Existing accepted image uses2.0.50; no package is introduced/replaced. Retain the storage release compatibility exception: a dependency upgrade requires an independent whole-runtime rebuild and regression proof, rather than changing the frozen observer-only patch. Reference docs: https://www.sqlalchemy.org/download.html and https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html#using-asyncsession-with-concurrent-tasks . Each page/claim/failure owns its own AsyncSession; concurrent requests never share a session.

Review found that persisted negative placeholders count towards the history capacity even after actual payments appear. The union of existing and current scenario identities must fit256 before saving any page. Regression covers both pre-existing overflow and a new payment that would exceed the total retained capacity. Identical decision replay uses a not-yet-due activation scenario; the shared welcome_pending defer intentionally moves with current time and therefore correctly creates changed-defer events.


A review also found a reporting ambiguity: missing_source_members initially counted only the current page. It now counts missing sources cumulatively among visited members, so a missing source on page1 remains visible when page2 completes. A regression test covers this exact failure. The database schema is unchanged.

Self-review complete: only fork-owned files; no transport/scheduler/router hooks; shared authoritative business decisions; no new network/dependency calls; bounded ORM reads; safe failure reasons without exception details. Independent review has not yet been obtained. Release acceptance remains pending until exact-source CI, frozen-image verification and live diagnostics finish.


## Final pre-release validation

2026-10-03: final full backend776passed/4PostgreSQL-only skips; focused real PostgreSQL63passed; changed-fileBlack/Ruff clean; git diff --check clean; SDD schema/hierarchy0errors/0warnings. Full backend warnings are existing dependency deprecations. Tests use isolated databases and transport-disabled configuration. Production release, exact-source CI and frozen candidate tests remain pending.
