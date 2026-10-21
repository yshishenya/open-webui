# Mailu: restore validated DNS and reliable delivery

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/email-verification-login
- Workflow: bug_fix (workflow-compliance)
- SDD Spec: meta/sdd/specs/active/mailu-dns-delivery-2026-10-22-001.json
- Created: 2026-10-22

## Context / Goal

User confirms reset receipt on Yandex but Proton remains deferred: earlier TCP25 timeouts, latest4.7.5/non DNSSEC destination. SMTP inherits Docker/host DNS without validated AD; installed Unbound validates root but cannot recursively resolve Proton. A direct validated upstream answers. Repair existing services with the smallest persistent change; prove DNSSEC remains enforced, queue/data preserved, and actual Proton delivery. Do not assume DNS repair also fixes all TCP routes.

## Plan / Acceptance

- [x] Trace actual application request, Mailu queue and recipient comparison; Yandex mailbox receipt confirmed, Proton deferred.
- [x] Reuse installed Mailu2024.06.49/Unbound1.20.0; read matching official configuration documentation. No new dependency/service/provider.
- [x] Isolated Compose check of forwarding with local DNSSEC validation: valid signed domains resolve with AD; dnssec-failed.org returns SERVFAIL; unsigned zones still resolve normally. MX/A and relevant TLSA checks for Proton, Google, Yandex, Outlook, Yahoo, Mail.ru, iCloud and Fastmail. Repeat checks after cache/runtime restart.
- [x] Before production mutation: private verified config/queue backup, current-source/config compare, volume and neighboring-service inventory. Preserve original reset and all queue contents; do not print tokens/mail bodies/credentials.
- [x] Apply only proved resolver config and SMTP DNS change; preserve existing images/queue volume, DANE/DNSSEC/TLS/capacity settings and unrelated services. Roll back automatically on DNS/security/health/volume failure.
- [x] Verify effective persistent settings, service health, same queue volume, original queued mail identity and unchanged neighbors/application. Restore only own changed files if acceptance fails.
- [x] Real original Proton message accepted by recipient (or record exact residual connectivity blocker); no duplicate or fresh recovery token unless necessary/explicitly requested. Limit actual messages to owner-authorized addresses.
- [x] Connection/EHLO/STARTTLS checks for other major recipient MX; no MAIL/RCPT/DATA to unrelated recipients. Distinguish protocol access, server acceptance and Inbox receipt.
- [x] Document actual results and runnable minimal DNS/security regression check, commit/push own files. Overall task remains open if required delivery is unresolved.

## Implementation / Rollback

Applied a minimal guarded edit to the existing server Compose: SMTP DNS/dependency and two resolver mounts only. The installed Unbound template uses standard TCP forwarding with local validation and a persistent directory for the learned trust anchors. No val-permissive-mode, domain-insecure, disabled DANE or substituted transport. Original Compose bytes and learned keys are in a verified private backup. Existing anonymous /queue volume must survive SMTP recreation; verify exact volume before/after. Keep private backup on server/private storage, not full archives on Mac. Revert own config override/recreate only changed services if acceptance fails; original image/config/volume remain available.

## Upstream impact

No application/upstream files, schema or dependency changes. Infrastructure only. Add one small runnable check using installed dig and existing Docker boundary; no new framework.

## Evidence

Private: /Users/yshishenya/.codex/private-artifacts/airis-mailu-dns-repair-20261022. Preceding delivery evidence: /Users/yshishenya/.codex/private-artifacts/airis-password-reset-delivery-20261022.

## Results (2026-10-22, Istanbul; server UTC proof retained)

- [x] Isolated Compose passed for ten domains, bogus DNSSEC rejection and CD control; repeated successfully after recreation with persisted learned root anchors.
- [x] Production accepted: DNS script green; SMTP namespace preserves Proton AD and rejects bogus signatures; both services healthy, existing image IDs and exact queue volume preserved.
- [x] Compose semantic comparison allows only SMTP DNS/dependency and resolver mounts. Neighbor Mailu container IDs/environment hashes and app container ID unchanged during application.
- [x] Private backup verified: `/opt/backups/airis-mailu-dns-20261022T2326Z`; queue SHA256 `0ef276f1b369ee0a4740b7ec98836467768fa98ab469832f7ea9c32d6e66d53c`. No queue archive or environment copied to Mac/Git.
- [x] Certificate-verified STARTTLS: Gmail, Outlook, Yandex, Mail.ru, Yahoo, iCloud, Fastmail, shishenya.ru and airis.you. These are protocol checks, not Inbox delivery proofs.
- [x] Remaining Proton fault isolated: all six endpoints time out at TCP connect from AIris host and SMTP container; all six return SMTP 220 from KVN. Header-only ens1 capture sees outgoing SYN retransmissions/no response for the bounded probe. Local ruleset has no output filter, DOCKER-USER is empty, Fail2ban input match is SSH port22 only.
- [x] Existing original reset retried once after repair at23:28:06UTC; completed23:30:37UTC, deferred4.4.1. No DNSSEC error, reinjection or new token. Queue metadata preserved.
- [ ] Restore the external TCP25 path and prove actual Proton server acceptance, then owner Inbox receipt. Do not close overall delivery task or imply that protocol success proves delivery.

Guide: `meta/memory_bank/guides/mailu_dns_delivery.md`. Runtime application/backend/frontend behavior, dependencies and schema are unchanged; broad application suites are not applicable to this infrastructure-only edit. The relevant regression is the runnable installed-Docker DNS/security check, isolated recreation and production protocol acceptance.
