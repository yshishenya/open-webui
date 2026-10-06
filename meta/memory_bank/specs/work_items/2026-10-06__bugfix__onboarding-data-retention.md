# Onboarding data retention
## Meta
- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/onboarding-data-retention`
- Created: 2026-10-06
- SDD Spec: `meta/sdd/specs/active/airis-onboarding-data-retention-2026-10-06-001.json`

## Context and goal
Age cleanup currently covers only preference events and unsubscribe tokens.
Advertising touch fields, terminal analytics events, orphaned email jobs and
closed observation detail persist without an explicit lifecycle.
Define purpose/start/expiry/minimum replay evidence for each data class; use
the existing hourly scheduler and async ORM. Existing accounting sources and
ambiguous or live sends must remain unchanged. Full plan01.16 remains open
until source, both databases and production acceptance pass.

## Acceptance
- [x] Purpose/period/start/expiry table covers attribution, identities/events,
      mail/source receipts, success facts, consent/tokens/suppression,
      observation detail/commands and external-provider limits.
- [x] Exact expiry boundary-1/0/+1: advertising touches expire after90days;
      terminal analytics events expire after90days; live/uncertain/uploaded
      delivery remains protected and historical source replay creates0jobs.
- [x] Orphan terminal mail expires after30days from unlink/update;
      attached/unknown/live/retryable mail remains, money changes0.
- [x] Closed observation detail expires730days after closure; scopes and
      administrative replay receipts retain minimal metadata. Reports return
      explicit unavailable-history at expiry, never zero conversion.
- [x] At most1000 deleted rows per data class per pass; repeated/two-worker
      passes preserve source keys and do not send HTTP/SMTP.
- [x] SQLite and PostgreSQL regressions, Ruff/Black, SDD/link checks pass.
- [ ] Exact-source CI/merge, guarded image release/backup/health and current
      read-only preservation evidence accepted before closing01.16.

## Scope and reuse
New fork-owned retention helper; thin call from existing hourly preference
cleanup; existing analytics ingestion/repair locks and report boundary reused.
No new service, dependency, scheduler, schema or financial policy.
SQLAlchemy2.0.50 is the locked/accepted runtime: reuse its existing async ORM.
Official2.0 locking docs and current stable release inspected; dependency
upgrade is a separate compatibility-tested work item.

## Upstream impact
No upstream-owned runtime hook is required: preference cleanup and analytics/
mail report are fork-owned. Preserve current frontend bytes.

## Verification and rollback
Compose-only isolated databases; run focused expiry/replay/concurrency checks
plus existing analytics/queue/observer/report/consent regressions.
Age deletions cannot be undone by an image rollback: guarded database backup
and age-selection inventory must precede rollout. Never run experimental
cleanup on production. An unresolved send requires separate resolution, not
silent deletion. Public published90/730/180/365 semantics are preserved.


## Source verification 2026-10-06
Before implementation4failures/1pass reproduced in disposableSQLite.
Final PostgreSQL242passed/0skips;SQLite234passed/8PG-onlyskip, same cases
passed on PostgreSQL. Focused boundary/replay/concurrency, busy-lock, rollback,
1001row ceiling, expiryHTTP410/no-store/admin checks plus existing analytics/
queue/consent/dispatch/observer/report/storage suites passed.
7 existing dependency/import warnings preserved. Ruff0 diagnostics,Black9
changed files formatted;731Markdown0brokenlinks;SDD0errors/0warnings.
Existing configuration-recovery test now fixes its intended clock at100seconds
rather than inadvertently testing expired1970facts. Consent cleanup fixture
adds the actual dependent tables. First PG setup used an unavailable driver;
corrected to existing psycopg, no dependency added.
Read-only production inventory:0age candidates,5unresolved analytics protected.
This is release preflight only:production cleanup/release acceptance pending.
