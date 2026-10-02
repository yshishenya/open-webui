# Shared daily mail capacity and safe quota deferral

Status: In Progress
Owner: Codex
Branch: `codex/bugfix/email-daily-capacity`
SDD Spec: `meta/sdd/specs/active/airis-daily-email-capacity-2026-10-02-104.json`

## Cause and measurable acceptance

The existing fixed-minute quota does not bound daily volume. Ordinary quota exhaustion is currently recorded as an SMTP retry; a waiting job becomes terminal after four checks even though DATA was never submitted. Reuse the current journal and transport table.

- [ ] Across two workers/direct calls, reserve both minute and UTC-day windows atomically. No reservation remains from a rejected request. Product and total ceilings remain separate, preserving service headroom.
- [ ] Default minute60/40 and UTC-day100/50. For any rolling24h the app uses at most200 total/100 product reservations. Other clients using the same SMTP account are outside app accounting; provider capacity must be checked separately.
- [ ] Day/minute keys and cleanup are isolated; current/previous day retained. Same credentials and persisted database preserve limits after sender/process restart. Zero product budget fails closed; service retains headroom.
- [ ] First-day accounting includes existing current-day minute reservations. A midday upgrade cannot silently reset the daily budget; an already full day rejects and rolls back the new minute increment.
- [ ] Capacity/DB failure before DATA defers only the currently claimed, proven-unsent job, restores its attempt count, respects expiry and rechecks current consent on next claim. Accepted/unknown/submitted/stale-owner jobs cannot become pending.
- [ ] Real SMTP errors still use the existing bounded retry policy. No secrets, addresses or payload added to quota/journal output.
- [ ] Regression fails before the fix; source/frozen image/isolated PostgreSQL/required CI and guarded rollout checks pass. Queue/global mail remain disabled until separate pilot readiness.

## Scope and upstream impact

Reuse fork-owned models/email_delivery.py and utils/airis/email_queue.py and the existing queue tests. Two environment entries in .env.example and docker-compose.yaml; no new table, migration, dependency, API or money mutation. Minimal two-line addition to upstream Compose config; no other upstream runtime change. Existing pinned ORM and SMTP interfaces retained.

One existing payment-mail test now claims at the current time after reconciliation instead of a timestamp captured before asynchronous setup; this removes a reproduced one-second scheduling race in the test.

## Verification and rollback

Compose focused/full backend checks, queue suite on isolated PostgreSQL, touched-file Black/Ruff and configuration/doc/schema checks. Frozen candidate must retain current frontend and pass source/file identity, previous-image compatibility, backup and live isolated tests without real mail submission. Preserve active controls/ENV/volumes/neighbors and minimum10GiB free. Rollback retains existing database journal; removing new day enforcement does not erase its counters.

UTC-day is a fixed window, so adjacent days can use both budgets. Direct account/password mail still reports capacity refusal through its existing result contract; this work adds durable deferral to queued jobs only.
