# Durable AIRIS email delivery

Status: Done
Owner: Codex
Started: 2026-10-02
SDD Spec: `meta/sdd/specs/completed/airis-email-delivery-queue-2026-10-02-501.json`

## Outcome and measurable acceptance

Optional onboarding and credited-payment notices survive restarts without blind SMTP retries. This work implements delivery infrastructure; scenario copy and pilot acceptance remain separately tracked.

- [x] One row per account/type/scenario; 12 concurrent inserts create one job.
- [x] Two workers cannot submit the same job or two optional messages within rolling 24 hours.
- [x] Expired pre-submission leases recover; uncertain submission becomes unknown and never automatically retries.
- [x] Explicit temporary refusal retries at 5/30/120 minutes, at most three retries; permanent refusal stops.
- [x] Opt-out, address change, complaint and account removal cancel waiting optional mail in the same persistence boundary.
- [x] Every SMTP attempt, including existing direct service calls, consumes shared transport capacity; service capacity is reserved.
- [x] Final checks enforce active account, trusted address, consent, current scenario facts and expiry.
- [x] Candidate reconciliation recovers missing welcome/payment jobs using existing facts, without altering money.
- [x] A/B default off, dry-run sends zero messages, pilot only reaches explicitly listed account IDs.
- [x] Administrator-only views expose compact content-free outcomes; unknown/accepted jobs cannot be blindly requeued.
- [x] PostgreSQL and SQLite upgrade/downgrade/reupgrade and concurrency checks pass.
- [x] Frozen-source tests, public PR and default-off production acceptance recorded before completion.

## Implementation

Reuse async SQLAlchemy, existing scheduler and EmailService. Add one delivery table, one transport window table and fork-owned delivery/scenario helpers. No broker, process, dependency, tokens, address snapshots, message bodies or payment details in the queue. Payment notice requires succeeded provider state and matching applied topup ledger credit. Service notices have no marketing expiry.

Persist a submission marker before SMTP DATA. SMTP acceptance and recipient delivery remain separate facts. A crash after this marker is unknown even if the message may not actually have reached DATA. This conservative choice requires investigation rather than risking a duplicate.

Final permission checks serialize through the account row; transactions finish before SMTP. Consent/payment/account changes after the final check and before external acceptance remain a narrow unavoidable race. Do not claim exactly-once email delivery.

Claim lease is longer than a bounded SMTP operation. Recovery never gives another owner permission while the old owner can legitimately start submission. Optional unknown results consume the frequency window. Queue limits are persistent and shared; no long database transaction surrounds SMTP.

## Dependencies and upstream impact

Reuse repo-pinned SQLAlchemy 2.0.50/Alembic 1.18.4/aiosmtplib 3.0.2. Official SQLAlchemy/Alembic operation contracts checked; Official aiosmtplib v3.0.2 send_message/sendmail source contracts checked; existing refusal/cancellation checks cover its runtime behavior. Latest stable metadata observed: SQLAlchemy 2.1.1, Alembic 1.20.0, aiosmtplib 5.1.3. No dependency introduced or replaced. The compatible runtime remains pinned; upgrade independently with existing billing/auth/SMTP regression checks rather than changing the tested runtime within this feature.

Thin hooks: email consent/account cleanup, EmailService common SMTP boundary, scheduler, router registration. Existing auth and billing contracts retained. Scenario planning stays in fork-owned modules. All proofs and recipient identities remain outside the public repository.

## Verification and release

Docker Compose-first backend and dedicated PostgreSQL concurrency tests, SMTP refusal/timeout/cancellation checks, administrator access checks, and migration reversal. Default-off release with backup, compatible rollback, source manifest and preservation of neighboring services. Pilot enabling occurs only after templates and scenario acceptance.

## Local verification (before source freeze)

Backend543 passed, three PostgreSQL-only skips covered by dedicated PostgreSQL74 passed. Frontend147 passed; full typecheck remains the unchanged8360 errors/224 warnings and the existing full ESLint crash. Frontend source/tree is unchanged. New queue files pass Black/Ruff; changed-file lint compared to the exact integration baseline. SQLite/PostgreSQL schemas, FK, unique/indexes, downgrade/reupgrade and idempotent upgrade pass. Frozen CI, image and production gates remain pending.

CI follow-up: minimally corrected the ten inherited scheduler Ruff findings; existing feature polling moved into one typed helper, rule interval and model-default payload behavior retained. Five scheduler/clock checks added; full backend548 passed. No suppression or CI configuration changes.

## Production acceptance

Frozen source `9f46bd90e69ed06af5a50e3f28fb77529c9ad4cf`; PR [#141](https://github.com/yshishenya/open-webui/pull/141) merged as `9706c09c2402cbba7480a63e666150759b01fbdc`. All exact-head CI checks passed without suppressions or check changes. Candidate image backend548 and PostgreSQL79 checks passed. Current database copy upgrade preserves existing business data; compatible old runtime imports after the additive migration.

Released image digest `sha256:200106fcddadaa37db6b6cf5fc2ddf609c95cc99804a4cee1560f461d1f1a00d`; migration `q1c020261002`. Source manifest verifies400 backend and7006 frozen frontend files. The backend static webmanifest is validated against the frozen frontend copy that normal startup installs. The frontend retains its previous source version because this release changes backend only. Checked backups, migration gate, compatible rollback and live health passed; other runtime configuration and neighboring containers are preserved.

Twelve live controls passed: default-off flags,12 concurrent inserts/one job, two independent worker processes/one claim, recovery after worker exit, unknown/no blind retry, opt-out preserving service mail, shared concurrent quota/service headroom, two optional jobs/one final permission, opt-out retaining uncertain submission semantics, real HTTP administrator/ordinary/anonymous access, fixture cleanup and direct service SMTP acceptance. Optional messages submitted:0. The service control was located once in the recipient Inbox with the configured Reply-To; transport acceptance and recipient delivery remain separate observations. Private evidence and recipient details remain outside Git.

Queue infrastructure is complete. Scenario templates, release enabling, pilot calendar windows and cohort acceptance remain separately open. Full frontend typecheck/parser failures recorded above are inherited and were not weakened; all applicable GitHub checks for this backend source passed.
