# AIRIS durable mail eligibility journal storage

Type: feature. Status: active; implementation and local verification complete; release pending.
Dependency: shared send eligibility helper accepted in production before this work.

## Result and release boundaries

Store a declared population, real observation start, complete/incomplete runs, immutable first positive observations and later decision transitions. All operations are async ORM inside explicitly owned transactions. The first storage release does not enable a scheduled observer, mail dispatch or report denominators. Subsequent work must connect the observer, queue and read-only report before plan08.09/09.07 can close.

## Data contract

1. Scope: opaque ID; rule version; mode observe/dispatch; registration lower/upper and payment lower/upper boundaries; declaration time; nullable real first-run time; nullable closed time; member count. Existing data has no generated past observation timestamp.
2. Member: opaque ID; scope FK cascade; ordinal stable within scope; nullable user FK SET NULL; included time. Unique(scope,ordinal), unique(scope,user) while user exists. Scope membership frozen before any run. Query population is declared ordinary accounts, including inactive/unverified/no-consent accounts.
3. Run: opaque ID; scope FK; start/finish; fixed membership upper ordinal; cursor; scanned members/scenarios; running/completed/failed status; lease token/until; public safe failure reason. Exactly one live lease per scope. Completed only after final page. Page updates and cursor commit together. Expired lease may resume; stale token cannot write.
4. Scenario observation: opaque ID; scope/member FKs; one of six types; category; scenario key/rule; original due/expiry; nullable payment internal ID; nullable delivery FK; first_observed_at; immutable nullable first_eligible_at; last_observed_at; last reason/defer; revision. Unique(member,type,scenario_key,rule_version). No message/address/token/provider reply fields.
5. Decision event: scenario FK; revision; run FK; observed_at; reason/defer. Unique(observation,revision). Only changed decisions add a transition; repeated identical decisions only advance last_observed_at.

## Write invariants

- Scope creation and members are one transaction. Reject duplicate/nonexistent IDs and malformed windows; dates supplied by operator can bound source cohorts but cannot impersonate past observation.
- Claim/run/append/finish use a valid current lease, scope identity and monotonically increasing time. Losing a lease gives no write permission.
- First ready sets first_eligible_at only if NULL. Later ready never replaces it; later negative records reason. Earlier observations cannot overwrite newer state.
- Original scenario window and identity are immutable. Dispatch link checks the exact member/user, type and scenario key, never only an ID supplied by a client.
- Queue association never retroactively declares an old accepted job eligible; first positive time and matched scope/window are required.
- Scope mode is a reporting fact, not authorization. No storage function invokes enqueue or SMTP. Monetary transactions complete separately.
- Deleted user/payment/job links become NULL and coverage loss remains visible. No email hash or substitute identity restores deletion.

## Acceptance checkboxes

- [x] Add only five new tables and bounded indexes; verify existing money/queue table schemas and rows unchanged.
- [x] SQLite/PostgreSQL migration upgrade, downgrade and repeat upgrade pass on isolated databases.
- [x] Empty population, duplicate IDs, invalid source windows and deleted membership covered.
- [x] 250 members paginate100+100+50 exactly once; interrupt after100 leaves incomplete run; resume completes250.
- [x] Page failure rolls back decisions/events/cursor/counts together.
- [x] Two independent sessions compete for one run; exactly one current lease writes. Expired token and wrong scope rejected.
- [x] Two writers/replay/restart preserve exactly one scenario, one first positive time and one event per distinct transition.
- [x] Negative→ready→negative sequence retains positive timestamp and last negative reason; repeated same reason/defer adds0events.
- [x] Stale timestamp, mismatched immutable window and wrong-account/type/scenario job association rejected.
- [x] User deletion, job deletion and payment deletion do not resurrect identity; orphan links detectable.
- [x] Artificial journal failures change0Payment/Ledger rows and invoke0SMTP/enqueue.
- [ ] Full backend + focused PostgreSQL + changed-file Ruff/Black + exact-source CI pass.
- [ ] Frozen image proof; backup; guarded production migration; preserved dispatch switches and neighboring containers.
- [ ] Public work item/SDD/branch log and private release evidence complete; final plan remains189/244 until full report requirements pass.

## Compatibility

Reuse runtime SQLAlchemy2.0.50 and project dialect_insert with ORM constraints, per-task AsyncSession. Stable upstream2.1.3 (2026-10-02), maintenance2.0.54 (2026-09-15) checked2026-10-03; no new dependency. Existing compatibility exception is retained because this block extends the validated runtime and does not replace the database library. Upgrade path: separate locked-runtime rebuild, full migration/payment/concurrency verification and guarded release. Official SQLAlchemy2.0 asyncio, PostgreSQL/SQLite ON CONFLICT and release notes reread.

SDD Spec: meta/sdd/specs/active/airis-mail-journal-storage-2026-10-03-001.json
Branch: codex/feature/mail-journal-storage

Upstream impact: none; fork-owned model and additive migration/test modules only. No API or frontend changes.

## Local verification and review

- Final runtime: 746 backend tests passed; three existing PostgreSQL-only skips.
- Real isolated PostgreSQL: 32 journal tests passed, including concurrent claim/write and static migration roundtrip.
- Changed-file Black and Ruff pass. Existing ORM/upstream deprecation warnings remain visible.
- Canonical account keys and payment IDs are enforced; invented orphan scenarios and replacement of deleted delivery links are rejected.
- Schema and persistence are separate modules below 500 lines. Transaction primitives retain cohesive lock/savepoint boundaries; the few longer functions deliberately keep atomic steps visible together.
- Code review: no route/background job/transport hooks; no monetary DML; database constraints and caller transaction ownership checked.
- Production and exact-source CI are still pending. No claim of continuously observed cohorts is made by a completed storage run.
