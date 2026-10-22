"""Expose reservation decisions through the existing chat event envelope, not charges."""

import logging
from collections.abc import Mapping

from open_webui.utils.billing_integration import BillingHoldContext

log = logging.getLogger(__name__)


async def emit_billing_reservation(context: BillingHoldContext | None, metadata: Mapping[str, object]) -> None:
    if context is None or context.lead_magnet_decision is None:
        return
    chat_id = metadata.get('chat_id')
    message_id = metadata.get('message_id')
    if not isinstance(chat_id, str) or not chat_id or not isinstance(message_id, str) or not message_id:
        return
    if chat_id.startswith('channel:') or metadata.get('internal') is True:
        return

    # Called once by the provider branch after successful preflight, never by stream chunks
    # or settlement. Socket delivery must not turn an otherwise valid hold into a failure.
    try:
        from open_webui.socket.main import get_event_emitter

        emitter = await get_event_emitter(
            {'user_id': context.user_id, 'chat_id': chat_id, 'message_id': message_id},
            update_db=False,
        )
        await emitter(
            {
                'type': 'billing:reservation',
                'data': {
                    'request_id': context.request_id,
                    'model_id': context.model_id,
                    'billing_source': context.billing_source,
                    'reason': context.lead_magnet_decision.reason,
                    'free_reset_at': context.lead_magnet_decision.cycle_end_at,
                },
            }
        )
    except Exception:
        log.exception('Could not emit billing reservation decision')
