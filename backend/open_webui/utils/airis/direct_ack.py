import logging
from dataclasses import dataclass
from typing import Any

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DirectAckContext:
    request_id: str
    channel: str


def coerce_direct_ack(value: Any, *, context: DirectAckContext) -> dict[str, object]:
    """Normalize Socket.IO ack payloads for direct connections.

    Upstream assumes ack is always a dict and calls `.get(...)`. In practice, client
    can ack with `null` or non-dict values (e.g. provider returns JSON null).

    Returns a dict for downstream `.get` usage or raises a user-safe exception.
    """
    if isinstance(value, dict):
        return value

    # Avoid leaking provider details; include only safe context.
    log.warning(
        "Direct connection returned invalid ack payload",
        extra={
            "request_id": context.request_id,
            "channel": context.channel,
            "ack_type": type(value).__name__,
        },
    )

    raise Exception(
        "Direct connection error: invalid response from client. Please retry, or disable direct connections."
    )
