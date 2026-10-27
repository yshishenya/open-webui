# Billing period and expired-session acceptance checks

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/billing-contact-errors-20261027
- SDD Spec: N/A — additions to existing acceptance tests, no new runtime subsystem.
- Created: 2026-10-27
- Updated: 2026-10-27

## Context / Goal

Original audit `2026-10-21__docs__billing-experience-audit.md` scenarios A08 and Q10 need executable boundary evidence, rather than treating nearby tests as the complete scenario.

## Acceptance Criteria

- [x] A08: provider payment before UTC midnight, wallet credit after it; adjacent-day and combined report selections reconcile without duplicate or missing money.
- [x] Q10: a monetary request rejected by an expired server session leads to sign-in, preserves permitted billing context, and is not automatically replayed after sign-in. No credit or credited notification is created.
- [x] Record actual execution environment/source and distinguish simulated server 401 from real JWT-clock expiration and production provider acceptance.

## Execution checkpoint

A08: three targeted tests passed; one PostgreSQL-only test skipped on SQLite. Q10: Chromium and Firefox-narrow passed against disposable exact-b2e4 compiled runtime, with a synthetic server 401 (not real JWT clock expiry). No production payment or provider/fiscal proof is claimed.

Original audit L-F5: added real keyboard test for 20 to 25 history entries; Chromium and Firefox-narrow both passed on the same disposable runtime. Ledger responses are synthetic; the test focuses Load more, uses real Enter, checks new-entry focus, then presses real Tab and checks the first added Details summary. No production data created.

Original audit A-F4: one API regression passed on disposable SQLite: finite requests quota 100 to 200 with an existing subscriber and 90 consumed requests; subscription record, paid period, payment ID and usage stay identical, with no scheduled downgrade. Existing compiled test image has identical backend runtime to b2e4. This is not PostgreSQL or production evidence.

## Scope / Non-goals

Extend existing reporting unit/integration tests and disposable onboarding full-path browser test. Test identities and fixtures only; no production writes, credentials, real payments, provider calls or commercial-rule changes. Existing non-admin API and foreign-operation tests remain separate evidence.

## Upstream impact

Fork-owned tests only; no runtime files touched by this work item.

## Verification / Rollback

Run focused existing Docker-based suites with deterministic fixtures. A test failure must be diagnosed, not skipped or weakened. Revert test-only changes if needed; no data restore.
