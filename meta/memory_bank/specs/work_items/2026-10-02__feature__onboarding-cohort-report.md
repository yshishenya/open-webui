# AIRIS registration cohort report

Status: Done (bounded implementation and release)
Owner: Codex
Branch: `codex/feature/onboarding-cohort-report`
SDD Spec: `meta/sdd/specs/completed/airis-registration-cohort-repo-2026-10-02-817.json`

## Goal and measurable acceptance

Provide one protected JSON export for registration cohorts, first foreground success, return and verified wallet credit. This is the operational onboarding report, separate from the existing consented first-visit acquisition funnel; its historical client activation proxy must not replace the server success journal.

- [x] Only ordinary accounts present at the snapshot; admins/non-user roles, explicit test IDs and registrations before observed_from are counted as separate exclusions. Inactive credentials remain registration denominators.
- [x] Exact half-open event windows [registration,registration+24h/7d/14d); fully mature denominators only, counts and fractions together, fraction null for empty denominators, immature and small-sample counts explicit.
- [x] Return means another foreground success on a different calendar date in the requested IANA timezone, within seven days of registration; same-day repeats, imported/background/client/login/click facts never qualify.
- [x] Credit requires succeeded YooKassa topup with matching amount/currency/wallet/user and applied ledger reference. Count distinct payments at ledger time, separately from distinct paid users, inside fourteen days.
- [x] Cohort rows are grouped by registration calendar day and current consent segment. Current suitable verified address and mail eligibility are operational snapshot counts; historical mail eligibility is explicitly unavailable.
- [x] Mail outcomes include type/version/status/reason and known receipt/bounce/complaint fields. Queue admission and SMTP acceptance never imply delivered/Inbox. Usefulness/clicks/causality unavailable.
- [x] Anonymous/ordinary access denied; no cache, no identifiers, addresses, names, tokens, request/response content or payment IDs in output. Invalid times/timezones rejected.
- [x] Read-only async queries, bounded report population, timeout/error handling, no new schema/service/dependency. Live aggregate cross-check after exact-source CI and frozen-image release.

## Scope and reuse

Add `/api/v1/admin/email-deliveries/cohorts` to existing fork-owned admin router, one fork-owned report helper and focused existing pytest checks. Share the existing preference evaluator and credited_condition; no duplicate permission/finance decisions. Aggregate success times in SQL; do not fetch chat content or every operation. Cap at 10000 accounts per request and reject larger ranges instead of silently truncating; narrow registration range to resolve. Explicit `start_at`, `end_at`, `observed_from` and optional timezone/test-ID exclusions are administrator inputs. `observed_from` must be the recorded durable-journal launch; the endpoint discloses the chosen boundary and cannot prove historical completeness. No implicit historical backfill; privacy-deleted accounts cannot be reconstructed.

PostgreSQL uses a repeatable-read transaction for a consistent read-only snapshot; development SQLite retains its existing transaction handling. Existing source time is the snapshot, not user-supplied historical state. Current consent grouping is observational and does not establish a causal email effect.

## Dependencies and upstream impact

Existing SQLAlchemy 2.0.50, FastAPI 0.136.3 and Pydantic 2.13.4 (pyproject.toml is authoritative; the shared stack summary is stale) are retained. Registry checked 02.10.2026: latest stable 2.1.2 / 0.142.2 / 2.13.5. Existing APIs and compatibility of the production stack take precedence over a task-local upgrade; upgrades must be separate work items with lockfiles, provider/auth compatibility and full-suite validation. Official SQLAlchemy 2.0 asyncio/select/isolation docs and 2.0 changelog consulted; version-specific framework/model documentation consulted. No dependency introduced/replaced. All runtime changes are fork-owned; no upstream component hook needed.

## Verification and release

Controlled SQLite and isolated PostgreSQL data: exact boundary seconds, immature/null cohorts, different-day return including timezone boundary, old/admin/test/inactive/existing account exclusions, changed consent/address/suppression, canceled/provider-success-without-credit and wrong ledger amount/currency, credit time versus initiation time and duplicate callbacks. HTTP authorization/validation/content privacy and database failure/timeout checks. Full backend, touched-file Ruff/Black, SDD, CI/security, fresh DB-copy compatibility, frozen source and live protected cross-check before marking complete. Real fourteen-day pilot acceptance remains a separate final-goal gate.

Rollback: previous compatible image; no schema mutation and global mail release settings remain unchanged.

## Implementation and source verification

Shared permission evaluation is extracted without changing the existing consent/credential/address/suppression order. Report reads all relevant inputs in bounded async queries; PostgreSQL repeatable-read was exercised on an isolated database. Existing `credited_condition()` now explicitly correlates only Payment so it remains valid when an outer report joins LedgerEntry; the first regression reproduced InvalidRequestError before this correction. All scenario callers retain their payment/ledger contract.

Source full Compose backend: 587 passed / 3 PostgreSQL-only skipped. Isolated PostgreSQL report/queue/first-email checks: 63 passed. These cover exact event/maturity seconds, timezone calendar return, replay, current consent/address/suppression, unmatched/canceled/incorrect credit, distinct users versus payments, empty/oversized cohorts, authorization, safe failures and content-free output. Frozen candidate, exact-source CI and live control passed; details follow. Frontend/assets and schema remain unchanged.

## Release acceptance

[PR145](https://github.com/yshishenya/open-webui/pull/145) merged. Frozen source `d37039df03d803a6d1d73b200b19163e0bb4c4a8`; integration merge `7e48763e12458deca6d142528d9ca536bc8575f6` has no runtime difference. All 13 required source checks passed. Frozen-image backend: 587 passed / 3 PostgreSQL-only skipped; isolated PostgreSQL: 63 passed. Candidate and live runtime match 408 backend and 7006 retained frontend file hashes. Fresh-copy compatibility and prior-image rollback preserve 71 tables and 15280 rows.

Read-only HTTPS acceptance: administrator receives 200 with no-store; anonymous and ordinary access denied. Independent selection matches report population, foreground success and mature denominators; no private content and unavailable metrics stay null. Controlled fixtures establish calculation behavior; the live new-registration population is empty, so this does not establish activation, return, payment conversion or a mature real pilot. Global mail controls remain disabled. No schema/dependency/frontend change.

[Acceptance record](2026-10-02__docs__cohort-release-acceptance.md). Full onboarding and real calendar gates remain separate and open.
