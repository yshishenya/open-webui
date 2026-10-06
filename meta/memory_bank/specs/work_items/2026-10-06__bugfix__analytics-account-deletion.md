# Remove account-bound analytics on account deletion

## Meta

- Type: bugfix
- Status: Done
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/analytics-account-deletion`
- SDD Spec: `meta/sdd/specs/completed/airis-analytics-account-deletion-2026-10-06-001.json`
- Created: 2026-10-06

## Context

Data-lifecycle review found that the common account deletion removes product
preferences and foreground success, but leaves AnalyticsIdentity.user_id,
first/last attribution, lifetime facts, bindings, events and delivery jobs.
The delivery worker locks Delivery before Identity; consent revocation locks
Identity and deletes Delivery. Adding deletion to the account transaction
requires one consistent order. An authenticated request can also outlive
its account and must not recreate the removed analytics identity.

## Goal and measurable acceptance

- [x] Reproduce retained account analytics and stale authenticated recreation
      against current integration code before fixing it.
- [x] Common account deletion removes only the selected account's analytics
      identity, bindings, events and delivery jobs in the account transaction.
- [x] The second account's analytics and financial Wallet/Payment/Ledger fields
      remain byte-equivalent; no HTTP/SMTP/provider mutation is required.
- [x] Repeated deletion leaves zero account-bound analytics; stale context and
      late account events cannot recreate the removed source.
- [x] Delivery and revocation/deletion acquire Identity before Delivery;
      an existing identity lock cannot strand a worker holding its job lock,
      including Metrica reacquisition after the uncertain marker commit.
- [x] An intervening event-owner merge is retried with the new owner;
      no request is sent under a stale analytics identity.
- [x] Two workers issue one request; account deletion waits for an already
      started send, then repeated delivery of the removed job issues zero HTTP.
- [x] A failed purge rolls back account, consent and analytics changes.
- [x] Existing consent, lifetime deduplication, ambiguous upload and recovery
      tests pass; real lock checks run on disposable PostgreSQL.

## Scope and upstream impact

Reuse purge_identity, the common Users deletion, existing async transaction
and queue fixtures. Add a small account purge helper; add thin hooks to
users.py and the analytics context route. Keep runtime changes limited to
these boundaries. The worker retains its existing missing-source and retry
semantics. No new dependency, migration, API shape or retention-period change.
Users.py is upstream-owned: only the common deletion hook is added. The
analytics implementation/routes are fork-owned.

## Verification and limits

Run new account-lifecycle tests and existing analytics/queue/preference
regressions with Docker Compose; repeat on isolated PostgreSQL. Tests use
existing actual models and common account deletion; chat/group cleanup is
isolated to avoid unrelated tables. Check current policy/version and pinned
SQLAlchemy before selecting locking APIs. Exact-source CI, compiled-image
checks and current-base guarded production acceptance remain separate gates.
No real user is deleted to test this fix. Global frontend debt, retention
age rules, external Inbox, physical phone and voluntary pilot remain open.

## Risks and rollback

Account deletion intentionally removes its local analytics; financial source
records and external provider history remain independent. Let database errors
abort the account transaction. Keep the prior image and verified backup for
an application rollback; never restore deleted users or downgrade a production
database automatically. This change does not erase historic orphan rows or
claim that providers have deleted data.


## Reproduction evidence

Disposable PostgreSQL against the pre-fix boundary: all four original cases
fail, with zero setup errors. Two added in-flight cases already pass; the
Metrica post-marker lock case fails before its correction. A separate
intervening-owner transfer also fails before the retry guard. All HTTP uses
local MockTransport; no production user or provider data is modified.
SQLAlchemy locking documentation for the 2.0 series was checked. The repository
pin and the accepted runtime image both use 2.0.50; the available 2.1.3
upgrade remains a separate compatibility work item. This patch changes no
pinned dependency and must pass both source CI and actual candidate runtime.

## Release gates

- [x] Exact source CI, including the complete backend suite, is green.
- [x] Candidate inherits the current accepted production base; precisely
      three Python files change, all frontend files/environment/base layers
      match, and actual-image SQLite/PostgreSQL acceptance passes.
- [x] Verified backup, current image/configuration CAS, migration and health
      gates pass; neighbors, money and ordinary browser flow remain intact.
- [x] Private acceptance/goal/plan retain 01.16 as open until the complete
      purpose/period/expiry table and appropriate cleanup are accepted.


## Local verification (2026-10-06)

- Docker Compose regression: PostgreSQL 77 passed / 1 existing skip;
  SQLite 72 passed / 6 skips (four real row-lock cases require PostgreSQL,
  plus two existing environment-dependent cases). Zero failures/setup errors.
- The final simplification removes an unnecessary branch around the nullable
  owner lookup. Frozen source recheck: all 22 analytics/account-lifecycle
  checks pass, including all 8 new common-boundary/concurrency/owner cases.
- Docker Ruff 0.16.10: zero diagnostics on all 5 Python files; Black check
  leaves all 5 unchanged. No suppression comment or threshold change.
- SDD validation: zero errors/warnings; 725 local Markdown files have zero
  broken links. The complete backend CI and actual image remain release gates.
- No real account, financial record or provider state was changed to test the
  fix. Preservation of financial fixture fields is separate from production
  acceptance. Four existing SQLAlchemy/migration warnings are retained.


## Accepted release

Implementation [PR308](https://github.com/yshishenya/open-webui/pull/308):
source `37d5a0beb9a67496d56d97a8839da6d422a68b59`, merge
`20f1f9fb4d06e5b744a3bd2debc13e55e8eae110`; trees equal.
11 applicable CI rows succeeded, including the full backend suite990 passed/
9 skipped and billing confidence. Dependency review skipped; CodeRabbit
reviews are disabled for this base and do not prove independent review.

Candidate `analytics-deletion-37d5a0beb-20261006`, registry digest
`sha256:088385d186716e79975cb970ea3401ef6910a78400dcacd6b76e80b5de6bfa85`:
actual runtime acceptance PG77 passed/1 skip, SQLite72 passed/6 skips.
426 runtime Python files matched the accepted candidate; precisely3 changed
from the current base. All4914 frontend files,76 base layers and image env
were preserved. Only tests were mounted for image acceptance; runtime source came from the candidate.

Guarded production release completed2026-10-06; verified backup checksums,
readable archive/dump list, hard Alembic and health gates passed. Image and
source identity matched. Financial read-only snapshots remained equal before,
after and after ordinary browser navigation (DML0). Existing environment,
Compose and DB revision remained intact. Only the selected image keys were
then persisted in the existing config without recreating the container.
Initial12 neighbors retained their identities/state;2 additional per-user
terminals predated rollout and1 arose from ordinary chat navigation. No such
container was removed or restarted to simplify acceptance.

Ordinary existing-account guide→prefilled Luna chat (no automatic submission)
→wallet path passed, without a new payment/model request or deleting a real
account. The first early container-health snapshot was `starting`; acceptance
uses the later actual `healthy` snapshot with restarts0. No physical phone,
independent usefulness, external Inbox, real volunteer or elapsed pilot window
is claimed by this release. Overall retention01.16 remains open.
