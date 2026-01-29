# Billing Configuration

<cite>
**Referenced Files in This Document**   
- [BILLING_SETUP.md](file://BILLING_SETUP.md)
- [backend/scripts/init_billing_plans.py](file://backend/scripts/init_billing_plans.py)
- [backend/open_webui/utils/billing.py](file://backend/open_webui/utils/billing.py)
- [backend/open_webui/utils/billing_integration.py](file://backend/open_webui/utils/billing_integration.py)
- [backend/open_webui/utils/yookassa.py](file://backend/open_webui/utils/yookassa.py)
- [backend/open_webui/models/billing.py](file://backend/open_webui/models/billing.py)
- [backend/open_webui/routers/billing.py](file://backend/open_webui/routers/billing.py)
- [backend/open_webui/routers/admin_billing.py](file://backend/open_webui/routers/admin_billing.py)
- [backend/open_webui/routers/admin_billing_rate_card.py](file://backend/open_webui/routers/admin_billing_rate_card.py)
- [backend/open_webui/config.py](file://backend/open_webui/config.py)
- [backend/open_webui/env.py](file://backend/open_webui/env.py)
</cite>

## Introduction

Airis billing supports two product modes:

- PAYG wallet (primary B2C mode)
- Subscription plans (optional, feature-flagged)

It also supports an optional “lead magnet” free quota system that applies only to allowlisted models.

If you are operating Airis as a B2C service, start with PAYG wallet + lead magnet. Enable subscriptions only if you explicitly need plan-based quotas.

## Billing Environment Variables

### ENABLE_BILLING_WALLET / ENABLE_BILLING_SUBSCRIPTIONS

- `ENABLE_BILLING_WALLET=true`: enables PAYG wallet + rate card charging.
- `ENABLE_BILLING_SUBSCRIPTIONS=true`: enables subscription plans and subscription UI/API.

Note: older templates may mention `BILLING_ENABLED`, but Airis uses `ENABLE_BILLING_WALLET` / `ENABLE_BILLING_SUBSCRIPTIONS`. Prefer removing legacy variables rather than adding them to your `.env`.

### LEAD_MAGNET_ENABLED

- `LEAD_MAGNET_ENABLED=true`: enables lead magnet quotas.
- Lead magnet applies only to models with `meta.lead_magnet=true`.

### YooKassa

- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`: required to create payments.
- `YOOKASSA_WEBHOOK_SECRET`: optional; enables webhook signature verification.
- Webhook endpoint is fixed: configure YooKassa to POST to `https://<your-domain>/api/v1/billing/webhook/yookassa`.

## Key Endpoints

### Wallet (PAYG)

- `GET /api/v1/billing/balance`
- `GET /api/v1/billing/ledger`
- `GET /api/v1/billing/usage-events`
- `POST /api/v1/billing/topup`
- `POST /api/v1/billing/auto-topup`
- `POST /api/v1/billing/settings`

### Subscriptions (only if ENABLE_BILLING_SUBSCRIPTIONS=true)

- `GET /api/v1/billing/plans/public`
- `GET /api/v1/billing/plans` (admin only)
- `POST /api/v1/billing/payment`
- `GET /api/v1/billing/subscription`

### Public pricing for landing pages

- `GET /api/v1/billing/public/lead-magnet`
- `GET /api/v1/billing/public/pricing-config`
- `GET /api/v1/billing/public/rate-cards`

## Plan Initialization (Subscriptions)

When subscriptions are enabled, plans can be initialized using:

```bash
python -m backend.scripts.init_billing_plans --force
```

This seeds default plans (including `free` and `payg`) from `backend/open_webui/utils/plan_templates.py`.

## Notes on “Free Tier” / Trials

The subscription system contains a `free` plan template and supports optional trial periods, but Airis B2C access is primarily modeled as:

- lead magnet quotas for “free start” (on allowlisted models)
- PAYG wallet for everything else

Keep user-facing copy aligned with PAYG-first unless you intentionally ship subscription plans.
