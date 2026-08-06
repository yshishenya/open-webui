# ruff: noqa

from __future__ import annotations

from typing import cast

from fastapi import FastAPI, Request


def bootstrap_airis(app: FastAPI) -> None:
    """Register Airis fork-owned extensions on the FastAPI app.

    Keep this logic out of upstream-owned `main.py` to reduce merge conflicts.
    """
    _bootstrap_airis_routers(app)


def _bootstrap_airis_routers(app: FastAPI) -> None:
    """Mount Airis-only routers.

    Imported lazily to avoid widening import surface in upstream-owned files.
    """
    from open_webui.routers import (
        admin_billing,
        admin_billing_reporting,
        admin_billing_lead_magnet,
        admin_billing_rate_card,
        billing,
        legal,
        oauth_russian,
    )

    app.include_router(oauth_russian.router, prefix="/api/v1", tags=["oauth", "russian"])
    app.include_router(legal.router, prefix="/api/v1/legal", tags=["legal"])

    app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(
        admin_billing.router,
        prefix="/api/v1/admin/billing",
        tags=["admin", "billing"],
    )
    app.include_router(
        admin_billing_reporting.router,
        prefix="/api/v1/admin/billing",
        tags=["admin", "billing", "reporting"],
    )
    app.include_router(
        admin_billing_rate_card.router,
        prefix="/api/v1/admin/billing",
        tags=["admin", "billing"],
    )
    app.include_router(
        admin_billing_lead_magnet.router,
        prefix="/api/v1/admin/billing",
        tags=["admin", "billing"],
    )


def extend_airis_app_config(payload: dict[str, object], request: Request) -> dict[str, object]:
    """Extend `/api/config` payload with Airis-specific fields.

    This keeps upstream-owned `main.py` close to upstream while still serving Airis UI needs.
    """
    from open_webui.config import (
        ENABLE_TELEGRAM_AUTH,
        OAUTH_PROVIDERS,
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_BOT_USERNAME,
    )
    from open_webui.env import ENABLE_BILLING_SUBSCRIPTIONS

    oauth_section_obj = payload.get("oauth")
    oauth_section: dict[str, object] | None = oauth_section_obj if isinstance(oauth_section_obj, dict) else None

    providers: dict[str, object] = {}
    for name, config in OAUTH_PROVIDERS.items():
        # Upstream returns `providers[name] = <string>`. Airis UI expects an object.
        provider_obj: dict[str, object] = {"name": config.get("name", name)}

        if name == "vk" and config.get("app_id"):
            provider_obj["app_id"] = config.get("app_id")
            provider_obj["redirect_url"] = config.get("redirect_url")

        if name == "telegram" and config.get("bot_name"):
            provider_obj["bot_name"] = config.get("bot_name")

        providers[name] = provider_obj

    if oauth_section is None:
        payload["oauth"] = {"providers": providers}
    else:
        oauth_section["providers"] = providers

    telegram_bot_username = str(TELEGRAM_BOT_USERNAME or '').strip().lstrip('@')
    telegram_enabled = bool(ENABLE_TELEGRAM_AUTH and telegram_bot_username and str(TELEGRAM_BOT_TOKEN or '').strip())
    payload["telegram"] = {
        "enabled": telegram_enabled,
        "bot_username": telegram_bot_username,
    }

    features_obj = payload.get("features")
    if isinstance(features_obj, dict):
        features = cast(dict[str, object], features_obj)
        features["enable_billing_subscriptions"] = ENABLE_BILLING_SUBSCRIPTIONS
    else:
        payload["features"] = {"enable_billing_subscriptions": ENABLE_BILLING_SUBSCRIPTIONS}

    return payload
