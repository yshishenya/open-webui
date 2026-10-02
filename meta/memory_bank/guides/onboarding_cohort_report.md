# Registration cohort report

The protected export `GET /api/v1/admin/email-deliveries/cohorts` uses administrator authentication and returns `Cache-Control: no-store`. It has no recipient, account, payment identifiers or chat content. It complements the acquisition funnel; first-visit client events do not replace the durable foreground-success journal.

Required query parameters are epoch-second `start_at`, `end_at` and `observed_from`. Registration range is [start_at,end_at); future accounts are excluded. Use the documented timestamp when durable success tracking began for observed_from. Earlier accounts are excluded, even when the requested registration range includes them. Set `timezone` to an IANA name (default UTC); repeat `exclude_user_id` for known test accounts. Test exclusions are explicit operator inputs; the system does not guess from names/addresses. Current normal-user roles form the population; inactive credentials stay in its registration denominator. Deleted history is unavailable after privacy deletion.

Each row covers one registration calendar day and current consent segment. A suitable verified address and product eligibility describe the snapshot only. Eligibility reasons reuse the sender decision. They cannot reconstruct historic permission at registration or form causal experiment groups.

Metrics include count, denominator, fraction, immature and small_sample. Only accounts aged at least the entire 24-hour/seven-day/fourteen-day duration enter that metric's denominator. Events exactly at the upper window boundary are excluded. Zero denominator gives null fraction. Groups below ten mature accounts are explicitly marked small; no statistical-confidence claim is made.

- `first_success_24h` / `first_success_7d`: at least one durable foreground success inside the account's observation window.
- `return_7d`: a later foreground success in another calendar day in the selected timezone, before registration+7d. Login, link opening and background work do not count.
- `paid_users_14d`: distinct users with a succeeded YooKassa topup and exact matching applied ledger credit before registration+14d. The event time is ledger credit time. `confirmed_payments_14d_mature` counts payments separately; it is gross conversion, without a claim about retained/refunded revenue.
- `welcome_accepted_registrations`: distinct cohort accounts with a recorded accepted welcome at snapshot; it is SMTP acceptance, without a claim about arrival in Inbox.
- `mail_outcomes`: jobs grouped by type, template_version, status and reason. Receipt/bounce/complaint fields count recorded timestamped observations only; zero records does not prove zero delivery failures.

`historical_mail_eligibility`, `delivered`, `inbox`, `useful_response` and `email_clicks` remain null where complete evidence is unavailable. Do not convert them to zero or label chronological observations as a causal email effect. Real pilot windows and human usefulness require separate dated evidence.

The report rejects ranges exceeding 366 days or 10000 candidate accounts and has a 20-second timeout; narrow the registration range if necessary. It makes no data/schema changes and does not enable mail. Roll back to the previous compatible image to remove the endpoint.
