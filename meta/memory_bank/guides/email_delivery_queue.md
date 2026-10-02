# AIRIS durable email delivery

The queue lives in PostgreSQL and uses the existing background scheduler. It does not depend on enabled user AI automations. Every instance checks about every five minutes, scans at most 100 account/payment facts and drains at most ten jobs in its own bounded task. Slow SMTP does not pause timers/calendar work.

## States and recovery

`pending`/`retry` → `claimed` → `accepted`, `failed`, `unknown`, `suppressed` or `expired`.

An account/type/scenario unique key prevents repeated signup, verification, reconciliation and provider facts creating duplicate jobs. A claim token and 180-second lease prevent simultaneous ownership. Before DATA, the worker commits a submission timestamp and renews the lease. The transport operation is bounded to 90 seconds plus SMTP cleanup; transactions finish before network submission.

An expired lease with no submission marker is safely recoverable. A persisted marker becomes `unknown`: ordinary SMTP cannot prove whether a timeout/crash reached acceptance. Never automatically retry unknown. Investigate the stable Message-ID in provider logs. `accepted` means SMTP acceptance; `delivered_at`, `bounced_at` and `complained_at` are separate nullable fields. They remain empty without verified provider evidence. Recipient delivery does not establish Inbox placement.

Explicit temporary failures retry after 5, 30 and 120 minutes, then stop; explicit terminal failures stop immediately. Accepted and unknown cannot use the administrative retry endpoint. A proven-unsent temporary terminal job may be retried after repairing transport. Every attempt rechecks current permissions and source facts.

Shared-capacity refusal before DATA waits five minutes without consuming an SMTP retry. This applies also to database unavailability in the capacity guard. Only the same claim with no submission marker can return to pending; expiry still applies, and the next attempt rechecks consent. Accepted/unknown/submitted or changed-owner jobs are never reset by quota deferral.

## Permission and source facts

Optional mail requires an active ordinary account, a trusted verified non-technical address, current address-bound product consent, no complaint/hard-bounce suppression and a current scenario window. Final permission serializes on the account row. The shared rolling 24-hour limit includes welcome. An unknown/in-flight submission conservatively reserves the full bounded submission interval. Payment help also has a rolling seven-day limit and uses only the latest appropriate terminal attempt.

Activation waits for both registration +24h and accepted welcome +24h. A successful foreground task suppresses activation. Paid-value mail requires a successful task and no credited payment or priority payment attempt. Pending/creating/waiting-for-capture payments are unresolved and never treated as a failed-payment help trigger. Feedback waits at least 14 days. Service credit notices require both authoritative provider success and a matching applied topup ledger credit; service jobs have no marketing expiry.

Opt-out, address change and account deletion affect waiting jobs in the existing database transaction. In-flight mail cannot be recalled: there is a narrow race after committed final permission and before external acceptance. Deletion anonymizes queue account links; it does not turn uncertain submission into a retry.

Missing welcome and payment jobs are reconstructed from source facts with idempotent keys. No account/payment transaction waits for mail. Each instance advances bounded in-memory scan cursors; restarting only repeats harmless reconciliation. If restart churn prevents finishing scans at substantially higher volume, persist cursors as a separate measured change.

## Environment and rollout

All new switches are passed by `docker-compose.yaml` and documented in `.env.example`:

| Variable                          | Default | Purpose                                                     |
| --------------------------------- | ------- | ----------------------------------------------------------- |
| `AIRIS_EMAIL_QUEUE_ENABLED`       | false   | Candidate reconstruction and queue worker                   |
| `AIRIS_EMAIL_RELEASE_A_ENABLED`   | false   | Welcome, activation                                         |
| `AIRIS_EMAIL_RELEASE_B_ENABLED`   | false   | Credited service notice, paid value, payment help, feedback |
| `AIRIS_EMAIL_DRY_RUN`             | true    | Calculate candidates, persist/send zero jobs                |
| `AIRIS_EMAIL_PILOT_ONLY`          | true    | Restrict queued scenarios to explicit account IDs           |
| `AIRIS_EMAIL_PILOT_USER_IDS`      | empty   | Pilot account IDs; empty pilot sends nobody                 |
| `AIRIS_EMAIL_ONBOARDING_START_AT` | 0       | UTC Unix seconds; 0 disables account/help reconstruction    |
| `AIRIS_EMAIL_CREDITED_START_AT`   | 0       | Credit source cutoff; 0 disables service reconstruction     |
| `AIRIS_EMAIL_SMTP_PER_MINUTE`     | 60      | Shared fixed-minute transport capacity                      |
| `AIRIS_EMAIL_PRODUCT_PER_MINUTE`  | 40      | Optional capacity, strictly below total                     |
| `AIRIS_EMAIL_SMTP_PER_DAY`        | 100     | Shared fixed UTC-day transport capacity                     |
| `AIRIS_EMAIL_PRODUCT_PER_DAY`     | 50      | Optional UTC-day capacity, strictly below total             |

`AIRIS_PRODUCT_EMAILS_ENABLED` must also be true to submit optional mail. Never enable a release before its templates and scenario acceptance are complete. The infrastructure release stays default-off. Use explicit source cutoffs to avoid accidentally backfilling historical accounts/payments. Do not translate the service cutoff into a seven-day expiry.

Capacity is shared by transport host/port/login hash across all instances, queue jobs and existing direct service calls. Minute and UTC-day reservations commit together; a rejected reservation rolls back both. Product messages cannot consume reserved service headroom. Both are fixed windows: adjacent minutes/days can use both budgets. Defaults bound any rolling24h to at most200 app reservations/100 product reservations, including uncertain and refused submissions after reservation. Other clients of the same SMTP account are outside app accounting. Verify the provider limit and outside usage before a pilot; lower budgets when needed.

The existing transport table stores both windows without migration: the original hash key retains minutes and its `:day` namespace holds UTC-day buckets in the legacy `minute` column. Cleanup is restricted to one key and its window units, preserving current/previous days. Persisted counters survive process/sender restart. Direct account/password email reports refusal through its existing result contract; only queued jobs get durable quota deferral.

For immediate stop, set `AIRIS_EMAIL_QUEUE_ENABLED=false` and `AIRIS_PRODUCT_EMAILS_ENABLED=false` in the private deployment environment and recreate only the application using its complete production Compose set. Account/password verification service mail continues through the shared quota. Preserve pending/unknown rows for investigation. Existing SMTP credentials and Reply-To stay private.

## Administration and verification

`GET /api/v1/admin/email-deliveries` returns aggregate status/category/reason counts and at most 100 content-free rows, with bounded offset pagination. Filter with `status=unknown` for uncertain results. Access uses existing administrator checks and `Cache-Control: no-store`; ordinary/anonymous accounts are rejected. Compare counts and oldest due timestamps over time to spot queue growth or stalled SMTP.

`POST /api/v1/admin/email-deliveries/{id}/retry` returns 409 unless a live-account, unexpired job is a proven-unsent temporary `failed` result. There is no endpoint that sends an arbitrary address/body or blindly resets unknown.

Migration `q1c020261002` adds only the queue/capacity tables. Back up before upgrade. A rollback image must retain the migration file even if old runtime does not use the new tables. Do not downgrade a populated journal during ordinary rollback.

Run Compose backend checks and the queue suite against isolated PostgreSQL with `EMAIL_DELIVERY_TEST_DATABASE_URL`. Coverage includes repeated events, concurrent claims/account permission, pre/post-submission crashes, retries/expiry, opt-out during AUTH, quota headroom/direct service calls, confirmed ledger facts, late account/payment reconstruction and restricted administrative access. Calendar pilot windows remain real-time evidence and are not replaced by controlled test clocks.
