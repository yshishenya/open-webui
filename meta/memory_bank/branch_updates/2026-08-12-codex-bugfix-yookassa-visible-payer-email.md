### Done with external blockers

- [x] **[OPS-MAIL]** Repair Airis mail deliverability
  - Spec: `meta/memory_bank/specs/work_items/2026-08-12__bugfix__airis-mail-deliverability.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Started: 2026-08-12
  - Done: 2026-08-12
  - Summary: Renewed and synchronized the Mailu certificate, fixed ACME routing and automatic renewal hook, configured Airis to send as `yan@airis.you`, verified SMTP auth plus DKIM signing, and confirmed HOSTKEY outbound TCP/25 is now open. Barracuda reports that the IP is not currently listed as poor.
  - Tests: Certbot dry-run and renewal passed; TLS, ACME challenge, SMTP auth, local IMAP delivery, DKIM, DNS and PTR checks passed; direct TCP/25 connectivity to Google and Yandex MX servers passed; controlled test to `y.shishenya@yandex.ru` received SMTP `250 2.0.0 Ok` and left the Mailu queue on 2026-08-15.
  - Risks: Campaign remains paused until its opt-in and unsubscribe controls are approved.

- Follow-up diagnosis 2026-08-15: Rspamd logged missing `Date` and `Message-ID` on outbound Airis messages (score 3.50). A separate batch reached multiple MX servers, but Microsoft rejected the sending IP with `550 5.7.1 S3140`; further bulk sending should wait for header/unsubscribe and reputation remediation.

- Fix deployed 2026-08-15: added RFC-standard `Date`, `Message-ID`, and safe `From` formatting to the SMTP service. Production test `98ae936e68db` scored `0.00` in Rspamd, had DKIM signing, and was accepted by Yandex with SMTP `250 2.0.0 Ok`.

- [x] **[OPS-BILLING]** Remove Claude Haiku 4.5 and Gemini 3.5 Flash Light from production promo models
  - Spec: `meta/memory_bank/specs/work_items/2026-08-15__refactor__production-promo-models.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Done: 2026-08-15
  - Summary: Set `lead_magnet=false` for the two requested production models through the existing ORM path while preserving their active catalog entries and tariffs.
  - Tests: Production ORM before/after check; both models active with two active text rate cards; public rate-card endpoint; production health.
  - Risks: Low; reversible metadata-only change.
