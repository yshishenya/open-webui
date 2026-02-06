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

Billing + YooKassa setup (RU): [billing_setup.md](../guides/billing_setup.md).

### OAuth (RU providers)

See [b2c_implementation.md](./b2c_implementation.md) and [`.qoder/RUSSIAN_OAUTH_SETUP.md`](../../../.qoder/RUSSIAN_OAUTH_SETUP.md).

### SMTP (transactional email)

See [b2c_implementation.md](./b2c_implementation.md).

## Keeping `.env` synced safely

- `python3 scripts/sync_env.py --env .env`

The script writes a timestamped backup (`.env.bak.<timestamp>`) and does not print secret values.
