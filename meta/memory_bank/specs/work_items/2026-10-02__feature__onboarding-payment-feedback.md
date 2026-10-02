# AIRIS PAYG payment and feedback emails

Status: In Progress
Owner: Codex
Branch: `codex/feature/onboarding-payment-feedback`
SDD Spec: `meta/sdd/specs/active/airis-payment-and-feedback-ema-2026-10-02-917.json`

## Bounded goal and measurable criteria

Complete existing queue rendering for four B scenarios, with safe payment selection and current feedback content. No new sender, survey service, dependency or schema. Real pilot, tested paid-model example/public guide enhancement and mature calendar acceptance are separate final-plan gates; do not enable optional global mail on this implementation alone.

- [ ] One ledger-backed confirmed topup produces one credited_v1 service notice: exact amount/currency and account history link; no subscription/next-payment/upsell/fiscal-receipt claim. Mail failure never mutates money. Existing source reconciliation restores missing jobs; unique payment key prevents replay.
- [ ] payment_help selects only authoritative YooKassa canceled attempts with a provider ID. Local failed/create_failed/unknown and pending states never imply rejection; unresolved attempts block generic paid CTA.
- [ ] A matching credit applied after the failed attempt suppresses help even if the successful Payment was initiated earlier. Match all provider/user/wallet/amount/currency/ledger facts.
- [ ] Optional72h branches remain exclusive, activation/consent/time/frequency enforced at final gate. No reused checkout URL or automatic payment; help links to current account history.
- [ ] feedback14d has current started/not-started and credited/not-credited wording. Content state changed before final DATA defers proven-unsent and renders current state on the next claim; no stale payment question.
- [ ] Actual HTML/text render, escape recipient data, use configured Reply-To, existing optional unsubscribe; service contains no product unsubscribe. Name/address/credit changes are rechecked before DATA.
- [ ] SQLite/PostgreSQL regression and full backend/quality/CI, frozen source/image, DB-copy rollback, guarded release and live controlled acceptance.

## Reuse and upstream impact

Use email_onboarding context, shared credited_condition, email_scenarios, queue prepare gate and existing SMTP result model. Keep the subscription-only payment_confirmation unused for PAYG; no runtime caller exists. All changes are fork-owned. Existing SQLAlchemy2.0.50/FastAPI0.136.3/Pydantic2.13.4 and Jinja2 retained for stack compatibility; upgrades are separate with lockfile and full auth/billing validation. Jinja2 3.1.6 matches latest stable checked on 02.10.2026; official Jinja template/escaping and SQLAlchemy2.0 select/correlation docs reviewed before implementation; no dependency introduced/replaced.

## Financial and transport boundaries

Credit remains provider-verified and ledger-applied in BillingService; emails are reconstructible side effects. Do not mutate payment state from email selection. Authoritative nonfinal states remain suppressed pending their normal billing reconciliation; provider outage cannot become a failure assertion. Shared final permission check precedes the durable submitting marker and external DATA; a content change before that gate postpones without transport or unknown state. Existing queue lease, retries, uniqueness and SMTP service reserve remain intact.

## Verification

Reproduce selection bugs before fix; cover early Payment/late ledger, false failed/null details/creating/waiting_for_capture, confirmed cancellation, priority, multiple attempts, repeated credit, dynamic activation/credit/address/consent changes during SMTP AUTH, missing/cross-user credit, exact currency decimals and escaping. Full source and frozen candidate checks, read-only release controls and actual controlled mail. Real calendar and human response proof remains open.

## Source checks

Pre-fix targeted regression reproduced three failures. After correction: focused SQLite70 passed /1 PostgreSQL-only skip; isolated PostgreSQL71 passed; full backend595 passed /3 PostgreSQL-only skips. Existing warnings are recorded in private logs. Touched-file Ruff/Black and template/docs formatting passed. Frozen candidate, required CI, database-copy rollback and live acceptance remain pending.
