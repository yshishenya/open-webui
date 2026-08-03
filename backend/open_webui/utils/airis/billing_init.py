import logging

log = logging.getLogger(__name__)


async def init_billing_on_startup() -> None:
    """
    Airis-owned startup hook.

    Purpose:
    - Keep upstream-owned `main.py` diffs minimal by delegating billing bootstrap here.
    - Initialize external billing client (YooKassa) when configured.
    - Seed default billing data (plans/rate cards) if missing.
    """

    from open_webui.utils.airis.runtime_config import refresh_lead_magnet_runtime_config

    await refresh_lead_magnet_runtime_config()

    # Initialize YooKassa billing client if configured
    from open_webui.env import (
        YOOKASSA_API_URL,
        YOOKASSA_SECRET_KEY,
        YOOKASSA_SHOP_ID,
        YOOKASSA_WEBHOOK_SECRET,
    )

    if YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY:
        from open_webui.utils.yookassa import YooKassaConfig, init_yookassa

        yookassa_config = YooKassaConfig(
            shop_id=YOOKASSA_SHOP_ID,
            secret_key=YOOKASSA_SECRET_KEY,
            webhook_secret=YOOKASSA_WEBHOOK_SECRET if YOOKASSA_WEBHOOK_SECRET else None,
            api_url=YOOKASSA_API_URL,
        )
        init_yookassa(yookassa_config)
        log.info("YooKassa billing client initialized")
    else:
        log.info("YooKassa billing not configured (set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY to enable)")

    try:
        from open_webui.utils.billing_seed import seed_default_billing_if_missing

        created = await seed_default_billing_if_missing()
        if created.get("plans") or created.get("rate_cards"):
            log.info(
                "Seeded billing defaults: plans=%s rate_cards=%s",
                created.get("plans", 0),
                created.get("rate_cards", 0),
            )
    except Exception as e:
        # This should never crash the app startup; log and continue.
        log.exception("Failed to seed default billing defaults: %s", e)
