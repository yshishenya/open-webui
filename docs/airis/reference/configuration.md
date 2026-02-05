# Configuration Reference

## Sources of configuration

- `.env.example`: documented environment variables (do not commit `.env`)
- Backend env parsing: [`backend/open_webui/env.py`](../../../backend/open_webui/env.py)
- Persistent config defaults: [`backend/open_webui/config.py`](../../../backend/open_webui/config.py)

## Common Airis flags

### Billing modes

- `ENABLE_BILLING_WALLET=true|false` (PAYG wallet + rate cards)
- `ENABLE_BILLING_SUBSCRIPTIONS=true|false` (plans/subscriptions)
- `LEAD_MAGNET_ENABLED=true|false` (quota mode for limited models)

Billing + YooKassa setup (RU): [BILLING_SETUP.md](../../../BILLING_SETUP.md).

### OAuth (RU providers)

See [README-B2C-IMPLEMENTATION.md](../../../README-B2C-IMPLEMENTATION.md) and [`.qoder/RUSSIAN_OAUTH_SETUP.md`](../../../.qoder/RUSSIAN_OAUTH_SETUP.md).

### SMTP (transactional email)

See [README-B2C-IMPLEMENTATION.md](../../../README-B2C-IMPLEMENTATION.md).

## Keeping `.env` synced safely

- `python3 scripts/sync_env.py --env .env`

The script writes a timestamped backup (`.env.bak.<timestamp>`) and does not print secret values.
