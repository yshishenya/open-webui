# Repair Airis mail deliverability

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/yookassa-visible-payer-email
- SDD Spec (JSON, required for non-trivial): N/A (production configuration repair)
- Created: 2026-08-12
- Updated: 2026-08-15

## Context

The Airis mail server has a working `yan@airis.you` mailbox, but the public SMTP certificate is expired and the sending IP is listed by Barracuda. The application also contains a malformed `SMTP_FROM_EMAIL` value. These issues reduce delivery reliability for the planned product-news email.

## Goal / Acceptance Criteria

- [x] Renew and synchronize the Mailu TLS certificate.
- [x] Keep the published SPF, DKIM, and DMARC records aligned with `airis.you`.
- [x] Configure Airis to send as `yan@airis.you`.
- [x] Confirm authenticated SMTP delivery and DKIM signing on a local self-test.
- [x] Confirm the IP is no longer listed by Barracuda; no delisting request is required.

## Non-goals

- Sending the product-news campaign.
- Changing the Airis application email API.
- Adding a marketing opt-in or unsubscribe subsystem.

## Scope (what changes)

- Config/Env:
  - Production Mailu TLS and Airis SMTP sender configuration only.
- Infrastructure:
  - Host Nginx ACME challenge routing and Certbot deploy-hook.
- Data model / migrations:
  - None.

## Verification

- DNS: A, MX, SPF, DKIM, DMARC, and PTR checks.
- SMTP: TLS, authentication, sender alignment, and one controlled self-test.
- External delivery: one controlled test to Yandex accepted with SMTP `250 2.0.0 Ok` and removed from the Mailu queue on 2026-08-15.
- Reputation: DNSBL re-check and external mailbox headers where available.

## Risks / Rollback

- Risks: Certificate renewal or SMTP restart could briefly interrupt mail delivery.
- Remaining blockers: None for SMTP egress. The product-news campaign remains a separate non-goal until its opt-in and unsubscribe controls are approved.
- Follow-up diagnosis (2026-08-15): production Rspamd scored the controlled message at 3.50 because `Date` and `Message-ID` were missing. A separate campaign batch was accepted by some MX servers, while Microsoft rejected the IP with `550 5.7.1 S3140`; pause further bulk sending until message headers, unsubscribe controls, and IP reputation are addressed.
- Fix deployed (2026-08-15): the SMTP service now adds RFC-standard `Date`, `Message-ID`, and correctly formatted `From` headers. The production test scored `0.00` in Rspamd, retained DKIM signing, and was accepted by Yandex with SMTP `250 2.0.0 Ok`.
- DNS hardening (2026-08-15): changed the published SPF terminator from `~all` to `-all`; public DNS now returns `v=spf1 mx a:mail.airis.you include:spf.unisender.com -all`.
- Microsoft escalation (2026-08-15): the self-service delist portal reported the IP as not currently blocked, while a live `MAIL FROM` probe still returned `550 5.7.1 S3140`. Submitted Outlook.com sender-support request `01M02BX72RT0W7HWEN74RAETM1`; keep bulk sends to Microsoft domains paused until support confirms remediation and a probe succeeds.
- Rollback plan: restore the captured production env/certificate symlink state and restart the affected compose services.

## Completion Checklist

- [x] Production changes verified.
- [x] Branch update entry marked done.
