# ruff: noqa

"""Bounded cleanup for temporary billing state."""

import asyncio
import logging

from open_webui.env import ENABLE_BILLING_WALLET
from open_webui.utils.lead_magnet import cleanup_expired_quota_reservations
from open_webui.utils.wallet import wallet_service

log = logging.getLogger(__name__)


async def billing_housekeeping_loop() -> None:
    if not ENABLE_BILLING_WALLET:
        return
    while True:
        try:
            await asyncio.to_thread(wallet_service.cleanup_expired_wallets)
            await asyncio.to_thread(cleanup_expired_quota_reservations)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Billing housekeeping iteration failed")
        await asyncio.sleep(60)
