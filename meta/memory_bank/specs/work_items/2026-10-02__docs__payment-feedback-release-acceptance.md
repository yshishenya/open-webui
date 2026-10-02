# Payment and feedback email release acceptance

Status: Done
Owner: Codex
Branch: `codex/docs/onboarding-payment-feedback-acceptance`
Implementation Spec: [PAYG and feedback emails](2026-10-02__feature__onboarding-payment-feedback.md)
SDD Spec: `meta/sdd/specs/completed/airis-payment-and-feedback-ema-2026-10-02-917.json`

## Goal and result

Close the bounded payment selection and mail rendering change after source, frozen image and released transport validation. Optional global mail remains disabled; real pilot, paid-model guide example and calendar maturity are separate final-plan gates.

- [x] PR147 merged; required source CI passed at `65b9d088e78614f6e3372ae2f023e88da2277576`.
- [x] Source and exact frozen image passed595 backend checks and71 isolated PostgreSQL checks; touched-file quality passed.
- [x] Fresh database copy and previous-image rollback preserved tables and rows; no schema change.
- [x] Guarded release passed;416 backend and7006 retained frontend file hashes match frozen candidate; environment, mounts, ports, networks and neighboring containers preserved.
- [x] Four clearly marked controls through the released queue and real SMTP received once: credited notice, paid value, canceled-payment help and active/credited feedback.
- [x] Both HTML and text received with expected content and Reply-To. Exact minor-unit amount/history link, no service unsubscribe, optional one-click headers, neutral help and current feedback wording checked.
- [x] Artificial source facts used isolated databases; production contains zero control users/payments/credits/jobs. Test messages explicitly say no real payment or credit occurred.
- [x] SDD6/6 completed; implementation spec and branch status updated.
- [ ] Separate final gates: real checkout/payment, external mailbox placement, human responses, paid example and actual72-hour/fourteen-day pilot windows. Isolated control unsubscribe tokens do not prove the production public unsubscribe endpoint.

## Validation and upstream impact

Documentation only. Format/link/schema/policy checks apply to this acceptance update. No runtime/dependency/schema/control changes and no upstream-owned runtime files changed. Unchanged frozen runtime tests are not repeated for documentation.
