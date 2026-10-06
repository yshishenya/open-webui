# Activation reminder boundary acceptance

Status: Done (test implementation; integration acceptance separate)
Workflow: code_review (verification of existing implementation)
Owner: Codex
Branch: `codex/test/activation-time-boundaries`
SDD Spec: meta/sdd/specs/completed/airis-activation-time-boundaries-2026-10-06-001.json

## Goal and measurable acceptance

Complete the implementation verification for plan item 08.08. Preserve the
separate requirement for the real 24-hour pilot window.

- [x] Trace reconciliation, claim recovery, permission checks and SMTP submission.
- [x] Verify the 24-hour and seven-day boundaries at one-second precision;
      a late verified address never receives welcome and activation together.
- [x] Recover an abandoned claim across UTC midnight with one SMTP submission;
      a stale owner and repeated reconciliation produce zero duplicates.
- [x] A public unsubscribe before submission produces zero SMTP deliveries,
      including a second client's repeated request.
- [x] A completed temporary task from two callers leaves one success fact and
      suppresses activation, including completion during SMTP connection.
- [x] Run the relevant suites on SQLite and PostgreSQL against the unchanged
      accepted application image; retain exact-source evidence for integration CI.

## Scope and upstream impact

Extend the existing lifecycle regression and task documents only. Reuse its
clock, real routes, disposable database and isolated SMTP boundary. No new
runtime code, dependency, schema, configuration or application rollout.
No upstream-owned application files touched.

## Verification and limits

Docker Compose runs the lifecycle, first-email, queue, preference and task-success
regressions. Explicit domain timestamps do not accelerate the physical clock.
Local SMTP acceptance is not external Inbox delivery. API clients are not a
physical phone or human usefulness evaluation. Real pilot remains open.

## Risks and rollback

Test-only change. Revert the regression commit if necessary. Preserve current
production, private evidence and unrelated primary checkout edits.

## Results

The accepted compiled application passed 140/140 checks on disposable PostgreSQL.
SQLite passed 137 with three PostgreSQL-only cases, each matched by full test
identity to a passing PostgreSQL case. The lifecycle subset is 14/14, including
eight added cases and concurrent replay of the existing temporary-task test.
No failures; 19 existing dependency/import warnings on PostgreSQL and 22 on
SQLite are retained in the private logs. Changed-file Black/Ruff pass.

A first diagnostic used SQLite for the preference/success fixtures inside the
PostgreSQL run and therefore skipped two cases; it is not final acceptance.
The final run sets all three database boundaries explicitly. Midnight recovery
resets process-local scan cursors and reclaims the persisted lease using fresh
sessions; it is a deterministic restart simulation, not a physical midnight
observation. Local SMTP and controlled clocks do not complete the real pilot.

Application source, dependencies, configuration and schema are unchanged.
Integration CI, source/merge tree equality and production identity are recorded
separately before closing the private plan item. No additional rollout needed.
