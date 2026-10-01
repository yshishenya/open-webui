# Optional product email preferences

Product tips/news require an explicit server-recorded choice bound to the current address. No preference row means no consent. Legal acceptance, browser analytics, social claims and User.settings do not opt a user in. Registration presents an unchecked optional checkbox; existing/social accounts choose in Settings → Account. The user saves this choice independently of profile settings.

Service verification, password reset/change and payment notifications remain independent. Product SMTP is disabled by default with AIRIS_PRODUCT_EMAILS_ENABLED=false. Do not enable it until the durable queue, duplicate prevention, capacity and pilot gates pass. The current welcome callers use the common product sender; later sequence types must use the same sender rather than the generic SMTP helper.

## Storage and retention

The additive migration e1c020261002 creates preferences, append-only preference events and per-message unsubscribe tokens. Tokens are random, stored as SHA256, and bound to user/current address. The event journal also stores confirmed hard_bounce/complaint suppression. An authenticated opt-in cannot remove suppression. Hashes remain personal data.

- AIRIS_EMAIL_UNSUBSCRIBE_TOKEN_DAYS: default180, range30..365.
- AIRIS_EMAIL_CONSENT_HISTORY_DAYS: default730, maximum3650.
- AIRIS_EMAIL_SUPPRESSION_DAYS: default365, at least1, no longer than history.

Change retention only together with the public consent/policy text and its version; the shipped defaults match the public explanation. The existing scheduler performs bounded hourly cleanup independently of user automations. Account deletion removes preference/token rows and unlinks user_id in retained events. General Users.update_user_by_id locks the user row, revokes consent/verification, removes unsubscribe tokens and updates the auth address in the same transaction when the address changes. Verification checks the token address while holding the same lock.

## API and privacy

GET/POST /api/v1/email-preferences use only the authenticated account. POST accepts a StrictBool subscribed and rejects extra properties. Public JSON POST /unsubscribe accepts a bounded opaque token; invalid/expired/repeated links have the same response and do not expose an address. The page /unsubscribe reads token from the fragment, removes it from the URL and sends it only after confirmation. It bypasses backend bootstrap and browser analytics.

RFC8058 uses POST /api/v1/email-preferences/one-click/{token} with Content-Type application/x-www-form-urlencoded and exactly List-Unsubscribe=One-Click. GET is passive. Each product message adds both List-Unsubscribe headers and a human-readable footer. SMTP acceptance is not proof of Inbox delivery. The consent/address check runs again after connection/AUTH before each send attempt; a narrow race after the final check cannot be eliminated without holding a transaction over external I/O.

The admin-only suppression endpoint accepts a known hard_bounce or complaint. No unsigned delivery webhook or fabricated delivered status is introduced. A future provider integration must authenticate its source.

Application access logs redact the token path before logging/telemetry; request/response audit excludes these endpoints because consent already has a durable audit and unsubscribe requests contain secrets. Production proxy logging must also be protected before release:

1. Include scripts/nginx/airis-product-email-privacy.conf in nginx's http context.
2. For both HTTP/HTTPS application servers, use the existing access log destination with airis_email_privacy format; retain health/static exclusions.
3. Use $airis_email_referrer_policy for the server Referrer-Policy header.
4. Add a dedicated one-click proxy location preserving the application's upstream/headers and disabling error logging for that location (otherwise nginx upstream errors can include its secret URL).
5. Back up current config, validate nginx -t, reload and verify synthetic successful/failed one-click GET/POST do not place the token in any application/proxy logs. Never publish a real token in logs or review evidence.
6. Verify delivered DKIM covers List-Unsubscribe and List-Unsubscribe-Post before enabling a product sequence.

## Rollback

Additive tables do not require automatic downgrade. Preserve preferences and withdrawals. Never roll back to an unguarded welcome sender: the fallback image must disable product welcome/send paths while keeping service mail, or retain the new guard and matching API. Test the fallback before release. Keep product mail off until a verified queue-enabled image is restored.

## Verification

Tests: backend/open_webui/test/util/test_product_email_preferences.py, existing SMTP tests, rendered component tests and e2e/product_email_preferences.spec.ts. Run the PostgreSQL-only concurrent-row test against a disposable database using EMAIL_PREFERENCES_TEST_DATABASE_URL; it creates/drops only its fixture tables. Never point that variable at a production or shared database. Upgrade a restored disposable copy to the migration head before release.
