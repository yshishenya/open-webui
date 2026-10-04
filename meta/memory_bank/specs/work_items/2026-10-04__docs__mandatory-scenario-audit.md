# Mandatory onboarding scenario audit

## Meta

- Type: documentation / code review
- Status: done; documentation CI tracked separately
- Owner: Codex
- Branch: codex/docs/mandatory-scenario-audit
- Scope: reconcile existing required tests and remaining browser proof gaps; no runtime changes.

## Problem and result

The required scenario matrix must distinguish assertions implemented in tests from end-to-end results. Re-run the complete backend suite on frozen source and separately prove every PostgreSQL-only skip. Do not close the overall quality gate or real pilot from isolated tests.

## Acceptance

- [x] Frozen source `82e907049618f94987f37b15a9de147e097f17e1`; backend, scripts and project configuration identical through documentation merge `ca358dd8fb19ab83d08f76c1ade0944914a8571d` and production source `cce5a05de6428ab3fd0649285f0eb6c9d9073377`.
- [x] Complete backend: 900 passed, 5 PostgreSQL-only skips, 0 failures/errors. Separate PostgreSQL: 111 passed plus 2 remaining cases, 0 skips/failures/errors. All five skipped test identities match passed PostgreSQL cases.
- [x] Real PostgreSQL checks cover concurrent consent/address changes, different mail jobs for one account, task checkpoints, observation ownership and ledger-based financial totals. Lifecycle checks also cover signup, verification, consent, two clients, replay, timing and restart.
- [x] Receipts retain exact source, JUnit test identities, commands, warnings and frozen file hashes. Databases are disposable; no production data or real mail changed.
- [x] Remaining browser gaps recorded below. Overall plan item 13.09, full type/style checks, physical-device proof and real pilot remain open.
- [ ] Documentation accepted in the integration branch after CI for its exact SHA.

## Evidence and limits

`test_product_email_preferences.py`, `test_email_delivery_queue.py`, `test_task_success.py`, `test_onboarding_lifecycle.py`, `test_onboarding_first_emails.py`, `test_onboarding_payment_feedback.py` and `test_onboarding_report.py` exercise consent, success, durable delivery, payment facts and cohort denominators. Backend billing tests cover webhook replay, quota and ledger behavior. Full-suite pass does not prove external Inbox delivery, fiscal receipts, human consent or real elapsed pilot windows.

`e2e/guide.spec.ts` verifies presets through login, explicit send behavior, unavailable-model protection and denied analytics; completion requests are aborted in draft checks. It does not assert a generated answer followed by measured quota reduction. `e2e/billing_wallet.spec.ts` mocks responses and checks top-up initiation/history separately; it does not assert one integrated checkout, credit, history and captured service email. Existing isolated checkout receipts remain separate evidence. These two complete automated browser paths are the next bounded work for matrix item 13.09; physical phone and real payment remain separate acceptance criteria.

## Verification

Docker Compose backend pytest with JUnit; four consent/queue/success/lifecycle files on PostgreSQL, then the two remaining PostgreSQL cases by node ID. Use the existing test network: creating another network hit Docker's exhausted address pool and failed before tests. The shared network was preserved. Application configuration and SMTP are test-only; test databases do not touch production.

Private receipts: `airis-required-matrix-20261004/acceptance.json`, JUnit XML, logs and frozen source hashes. Existing warnings are preserved: 25 in the full suite, 15 in the first PostgreSQL suite and 4 in the remaining two cases. No new dependencies or source changes. SDD implementation specs remain completed; this audit adds no implementation work.

## Upstream impact

None. Only fork-owned documentation and its branch update changed.
