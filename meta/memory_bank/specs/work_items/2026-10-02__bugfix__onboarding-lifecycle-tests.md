# Onboarding route and timing acceptance

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/onboarding-lifecycle-tests
- SDD Spec: meta/sdd/specs/completed/airis-onboarding-lifecycle-2026-10-02-217.json
- Created: 2026-10-02

## Context

Component tests cover consent, task success and queue recovery separately. Combined evidence is missing for registration through verification, last-minute success before SMTP submission and delayed verification/restarts. Add deterministic integration tests using real routes, persistence and message rendering; replace only the external SMTP connection and isolate database access.

## Goal / Acceptance Criteria

- [x] Signup and verification use real HTTP handlers; unverified or nonconsenting accounts produce zero product sends.
- [x] Consent followed by verification queues exactly one welcome; verification replay and two authenticated clients cannot duplicate it.
- [x] Activation produces zero sends at welcome+24h-1s and one at the exact boundary.
- [x] Completion at due-60s cancels activation, including a completion committed after preparation but before final SMTP submission.
- [x] Late verification keeps a full 24h welcome window; ten-day recovery cannot replay expired welcome/activation.
- [x] Isolated SQLite and PostgreSQL checks pass without sending external mail; changed-file formatting/lint pass.

## Scope / Upstream impact

Add one fork-owned test module. Runtime, APIs, migrations, package versions and production configuration are unchanged. No upstream-owned application files are changed.

## Dependency compatibility

Reuse pytest~=8.4.1, pytest-asyncio~=1.3.0, HTTPX0.28.1 and the repository image. No installation or replacement. PyPI currently reports newer pytest9.1.1: upgrading the complete test toolchain is outside this test-only change and should be a separate compatibility item. HTTPX0.28.1 ASGITransport documentation confirms direct asynchronous handler testing; it does not trigger application lifespan. Tests mount selected real routers and explicitly prepare database and application state, avoiding production background services.

## Verification

Docker Compose isolated runs on base8f78a9e1710590266fe598584785ea3595e9d05b plus the new test:

- Full backend:623 passed,3 PostgreSQL-only skips,0 failures/errors.
- PostgreSQL16 critical:140 passed/0 skipped; lifecycle repeat on the same database:6 passed.
- Full frontend:198 passed/46files; full check4668 errors/215 warnings and frontend lint1600 errors remain existing baseline failures.
- `pytest && black .` exit0;70 source files formatted only in frozen copy and restored byte-for-byte. The new test is Black formatted and Ruff clean.
- A full run exposed mixed real/domain test clocks; the reused queue helper now shares the deterministic clock. A repeated PostgreSQL run exposed rollback of fixture DDL cleanup; the fixture creates only five extra tables and commits cleanup.
- SDD schema validated with zero errors/warnings. CI and merge require separate verification; diagnostics for the previous PR182 are unavailable. No E2E or production redeployment is required for this test-only addition. This change is evidence for deterministic rules, not proof of external inbox delivery, real provider payments or human acceptance.

## Risks / Rollback

Test-only. Remove the added tests and documents to revert; production deployment is unnecessary.
