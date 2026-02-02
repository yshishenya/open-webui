# Airis B2C Notes (Auth + Email + Billing)

This repository is an Airis fork of Open WebUI.
This document captures the B2C-specific additions and the current state of the Russian-market flows.

## What’s Implemented

### Authentication

- Russian OAuth providers: VK, Yandex, Telegram
- Account merge by email (when enabled)
- OAuth router: `backend/open_webui/routers/oauth_russian.py` (mounted under `/api/v1`)

### Email flows (implemented)

Email verification and password reset are implemented in the main auth router:

- Verify email: `GET /api/v1/auths/verify-email?token=...`
- Resend verification: `POST /api/v1/auths/resend-verification`
- Request password reset: `POST /api/v1/auths/request-password-reset`
- Validate reset token: `GET /api/v1/auths/validate-reset-token/{token}`
- Reset password: `POST /api/v1/auths/reset-password`

Email delivery is via SMTP using `backend/open_webui/utils/email.py` and templates in `backend/open_webui/templates/email/`.

### Billing (current product mode)

Airis billing supports multiple flags; the B2C default is PAYG wallet:

- Wallet / PAYG: `ENABLE_BILLING_WALLET=true`
- Subscriptions (optional): `ENABLE_BILLING_SUBSCRIPTIONS=false` by default
- Lead magnet quotas (optional): `LEAD_MAGNET_ENABLED=false` by default

Public pricing pages use backend-provided data:

- `GET /api/v1/billing/public/lead-magnet`
- `GET /api/v1/billing/public/pricing-config`
- `GET /api/v1/billing/public/rate-cards`

See `BILLING_SETUP.md` for the full billing + YooKassa configuration.

## Environment Variables

Note: OAuth and SMTP settings are defined as persistent configs in `backend/open_webui/config.py` and default from environment variables.

### OAuth

Set these in `.env` as needed:

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CLIENT_SCOPE`, `GITHUB_CLIENT_REDIRECT_URI`
- `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URI`
- `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME`, `TELEGRAM_AUTH_ORIGIN`
- `ENABLE_OAUTH_SIGNUP`, `OAUTH_MERGE_ACCOUNTS_BY_EMAIL`

Setup guide: `.qoder/RUSSIAN_OAUTH_SETUP.md`

### Keep `.env` in sync

When you pull updates, `.env.example` may gain new keys. To safely sync an existing `.env` with the latest
template (preserving your current values and keeping unknown custom keys), run:

- Local/dev: `python3 scripts/sync_env.py --env .env`
- Prod (example): `python3 scripts/sync_env.py --env /opt/projects/open-webui/.env`

The script writes a timestamped backup (`.env.bak.<timestamp>`) and never prints values.

### SMTP (transactional email)

- `SMTP_HOST`, `SMTP_PORT`
- `SMTP_USERNAME`, `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- `FRONTEND_URL` (used to build verification/reset links)

## Quick Smoke Test Checklist

- OAuth:
  - VK/Yandex login endpoints redirect and return a valid auth token
  - Telegram widget callback creates / merges accounts as expected
- Email:
  - `POST /api/v1/auths/resend-verification` sends an email (SMTP configured)
  - `GET /api/v1/auths/verify-email?token=...` marks user verified
  - `POST /api/v1/auths/request-password-reset` sends reset email
  - `POST /api/v1/auths/reset-password` updates password and consumes token
- Billing:
  - `/pricing` loads public rate cards + lead magnet quotas when enabled
  - Wallet topup flow works when YooKassa credentials are configured
