import logging
from typing import Optional

from fastapi import HTTPException

log = logging.getLogger(__name__)


_BILLING_BLOCK_ERROR_CODES: set[str] = {
    "insufficient_funds",
    "daily_cap_exceeded",
    "max_reply_cost_exceeded",
}


def _billing_inline_message(error_code: str) -> str:
    # Keep these aligned with existing i18n keys used in the chat UI.
    if error_code == "insufficient_funds":
        return "Top up to keep working"
    if error_code == "daily_cap_exceeded":
        return "Daily cap reached"
    if error_code == "max_reply_cost_exceeded":
        return "Max reply cost limit reached"
    return "Request blocked"


def build_task_ws_error_payload(exc: Exception) -> Optional[dict[str, object]]:
    """Convert exceptions raised inside async chat tasks to a websocket-safe payload.

    Goal: preserve machine-readable details for billing blocks while keeping the
    user-facing error content non-technical.

    Returns a dict shaped like {content: str, detail?: dict, status_code?: int},
    or None if the exception is not recognized.
    """
    if not isinstance(exc, HTTPException):
        return None

    detail_value = exc.detail
    if not isinstance(detail_value, dict):
        return None

    error_code_value = detail_value.get("error")
    if not isinstance(error_code_value, str):
        return None

    if error_code_value not in _BILLING_BLOCK_ERROR_CODES:
        return None

    # No secrets in payload; detail is already a user-level business error.
    return {
        "content": _billing_inline_message(error_code_value),
        "detail": detail_value,
        "status_code": exc.status_code,
    }
