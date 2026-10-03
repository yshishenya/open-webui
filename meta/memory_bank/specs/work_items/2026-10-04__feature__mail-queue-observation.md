# Atomic queue and dispatch observations

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/mail-queue-observation
- SDD Spec: meta/sdd/specs/active/airis-mail-queue-observation-2026-10-04-001.json
- Created: 2026-10-04

## Goal and measurable acceptance

The declared dispatch population must retain a factual history through queue creation and both pre-SMTP permission checks, without treating scheduled work as business-ready or a worker fact as population coverage.

- [x] All six types use canonical source windows and exact account/payment identities.
- [x] Newly inserted tasks link in the same transaction; duplicate/old tasks cannot acquire a receipt retroactively. Scheduled tasks may link before ready, with zero artificial first-positive facts.
- [x] First actual business-ready is immutable through later opt-out/address/complaint/frequency changes. Release flags and SMTP capacity do not define business readiness.
- [x] Both pre-submit checks update only proven linked scenarios; unrelated/closed/diagnostic scopes fail safely. No HTTP route permits dispatch mutation.
- [x] One bounded scheduler page scans all frozen members, retaining durable cursors, missing sources and failed coverage. A single worker fact has run_id=null and changes no page counters.
- [x] Duplicate/restart/lost-response/two-worker paths create zero duplicate tasks/events/links; journal failures roll back queue decisions while committed payment credits survive.
- [ ] SQLite and isolated PostgreSQL tests pass; full backend and required code checks run before commit; exact-source CI and guarded release preserve the current production successor.

## Implementation

Reuse enqueue_email, send_eligibility, observation decision/event storage and bounded observer. Optional AIRIS_EMAIL_OBSERVATION_SCOPE_ID defaults empty, retaining the existing path without journal queries. A selected scope must be open, dispatch, current rule version, with explicit frozen members and source boundaries. Lock order is scope -> User -> Delivery -> scenario. The scope lock serializes writers also on SQLite. New associations are allowed only for an ID returned by INSERT in the same transaction; default storage linking guards remain strict.

Canonical windows derive from User.created_at/Payment.created_at, never retry/frequency/capacity due_at. Worker facts do not start/complete population runs. Existing diagnostic groups stay unchanged. Journal failure never joins a wallet credit transaction. Selected scopes gate every enqueue and submit; old unassociated jobs are suppressed rather than added to a new cohort.

Existing SQLAlchemy 2.0.50 is retained for compatibility with the fork and tested dialects; official async-session and PostgreSQL ON CONFLICT docs checked, latest PyPI stable observed as 2.1.3. No dependency is introduced/replaced. Upgrade remains a separate compatibility work item with migration and full suite verification.

## Upstream impact

Only fork-owned email modules, config templates and tests change. No frontend or upstream chat/auth/payment logic changes; no schema migration is required.

## Verification and release

Use Docker Compose with existing dependency image and isolated databases, never production test URLs. Verify six types, future scheduling, negatives, two payments per account, consent/address changes, stale/deleted links, rollback before/after enqueue, concurrency, source loss and partial coverage. CI diagnostics use the Code Review connector. Candidate must preserve production digest sha256:1a013df1a42d245d54f84f9af510d6a4a4142c3ae5477f395fe0d515810e3653, including _app/env.js. Release flags stay off until pilot and external prerequisites are proven.

## Risks / rollback

Scope lock bounds concurrency to one journal writer per declared group; existing bounded pages limit lock duration. Disable queue/selected scope and restore the verified previous image if acceptance fails; preserve journal history, backups, financial data and adjacent containers.

## Overall-plan boundary

This block does not close report denominators, voluntary pilot, human usefulness, external inbox delivery, physical-phone acceptance or actual 24h/72h/14d windows. Overall goal remains active at 189/244 until those separate criteria are proven.

## Current verification (2026-10-04)

- Full SQLite backend: 838 passed, 4 PostgreSQL-only skips, 19 warnings. Isolated PostgreSQL mail integration: 193 passed, 4 warnings.
- Frontend: 251 passed / 51 files with one worker. Parallel launch was killed; serial rerun passed. No frontend source changes.
- Existing frontend debt unchanged: 4419 type errors / 177 warnings and 1540 ESLint errors. G14 remains open; these checks are not claimed green.
- Dependency runtime SQLAlchemy 2.0.50 confirmed. SDD validation: 0 errors / 0 warnings; 501 Markdown files / 0 broken links. npm run preflight is absent; actual project checks were run instead.
- Backup space: one old 20261002T165448Z history-dates backup copied privately to Mac; all 12 files / 1565708895 bytes matched SHA256 and size, tar/pg_restore read successfully. Server removal revalidated both copies and retained all other backups. About 11.8 GiB free afterward.
- Exact source/image/CI, production configuration and release acceptance remain task-1-4. No pilot or cohort outcome is declared completed.
