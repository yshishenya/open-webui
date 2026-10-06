# Billing receipt consistency

Status: Done (test implementation; integration acceptance separate)
Workflow: code_review
Owner: Codex
Branch: `codex/test/billing-receipt-contract`
SDD Spec: meta/sdd/specs/completed/airis-billing-receipt-contract-2026-10-06-001.json

## Goal and measurable acceptance

Verify the existing receipt path for onboarding plan item 10.07. Preserve the
distinction between a wallet credit notification, registered fiscal receipt
and customer Inbox delivery.

- [x] Trace all three payment creation callers to the common receipt builder.
- [x] A runnable regression verifies exact Decimal amount/currency, customer
      contact fallback, missing contact rejection, disabled receipt behavior,
      optional tax configuration and unchanged provider request envelope.
- [x] Read existing succeeded payments and associated receipts using provider
      GET only; reconcile amount/currency/association/status/fiscal fields.
- [x] Record unavailable historical provider records separately; no invented
      registration/delivery proof, no new payment/refund/receipt or database writes.
- [x] Review and prepare exact test source for integration; preserve current production and
      unrelated work. Record private acceptance and remaining limitations.

## Implementation and upstream impact

Add only a focused backend regression and task documents. Reuse BillingService,
YooKassaClient and pytest already present. Runtime, API, configuration, schema
and dependencies stay unchanged. No upstream-owned application files touched.
The private read audit and customer/provider data stay outside Git.

## Verification

Use isolated Docker Compose with the current compiled image and disposable
SQLite database. Run the new contract plus existing billing service checks;
check formatting/lint and SDD schema. Separately compare production image,
configuration hashes and neighboring containers before/after read-only audit.

## Risks / rollback

No runtime rollout needed. Revert the test commit if required. A succeeded
local record does not substitute for the provider object; registered receipt
does not prove customer delivery or validate the business's tax policy.

## Results and limits

The isolated Docker Compose run passed 61/61 tests: eight new receipt contract
cases and 53 existing billing service regressions. No failures or skips; 17
existing import/dependency deprecation warnings remain. Changed-file Ruff and
Black with the repository's string normalization policy pass.

The private provider audit uses the current deployed client's GET transport,
existing succeeded records and the official OpenAPI payment/receipt contract.
It records registered receipts and an unavailable historical provider record
separately. No provider or database mutation, no new payment or delivery claim.
Onboarding plan item 10.07 remains open while that exception is unresolved.
Integration/CI source and deployment identity are recorded separately.
