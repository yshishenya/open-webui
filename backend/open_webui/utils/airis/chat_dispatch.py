"""Guard the native chat handler once, across both HTTP routes and handler aliases."""

import hashlib
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, Literal
from uuid import UUID

from fastapi import HTTPException, Request
from open_webui.models.chat_dispatch import accept_dispatch, reserve_dispatch
from open_webui.models.users import UserModel
from open_webui.utils.airis.task_success import operation_id
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from starlette.responses import Response

log = logging.getLogger(__name__)
DispatchResult = Response | dict[str, object]
ChatHandler = Callable[[Request, dict[str, object], UserModel], Awaitable[DispatchResult]]


class DispatchReceipt(BaseModel):
    status: Literal[True]
    task_ids: list[Annotated[str, Field(min_length=1)]] = Field(min_length=1)
    chat_id: str = Field(min_length=1)


def dispatch_identity(request: Request, payload: dict[str, object]) -> str | None:
    """Legacy synchronous/internal calls retain their existing completion contract."""
    if (
        getattr(request.state, 'internal', False) is True
        or not payload.get('session_id')
        or not (payload.get('chat_id') or 'parent_id' in payload)
    ):
        return None
    client_id = payload.get('operation_id')
    if client_id is None and payload.get('assistant_message_id'):
        # Old clients reuse the assistant id for each intentional continuation.
        return None
    if client_id is not None:
        try:
            UUID(str(client_id))
        except ValueError as error:
            raise HTTPException(422, detail={'error': 'invalid_operation_id'}) from error
    entries = payload.get('message_ids')
    if isinstance(entries, dict):
        entries = [{'model_id': key, 'message_id': value} for key, value in entries.items()]
    if not isinstance(entries, list):
        entries = [{'message_id': payload.get('id')}]
    entries = [entry for entry in entries if isinstance(entry, dict)]
    if client_id is None and not any(entry.get('message_id') for entry in entries):
        return None
    return operation_id(client_id, entries)


def dispatch_hash(payload: dict[str, object]) -> str:
    """Only transport identifiers may change when retrying an identical operation."""
    content = {key: value for key, value in payload.items() if key != 'session_id'}
    if isinstance(content.get('metadata'), dict):
        content['metadata'] = {key: value for key, value in content['metadata'].items() if key != 'request_id'}
    encoded = json.dumps(content, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


async def dispatch_chat(
    request: Request, payload: dict[str, object], user: UserModel, handler: ChatHandler
) -> DispatchResult:
    """A committed claim prevents retries from repeating title/provider/billing effects."""
    key = dispatch_identity(request, payload)
    if key is None:
        return await handler(request, payload, user)
    try:
        digest = dispatch_hash(payload)
    except (ValueError, TypeError) as error:
        raise HTTPException(422, detail={'error': 'invalid_dispatch_payload'}) from error
    try:
        row, owned = await reserve_dispatch(user.id, key, digest)
        if row.request_hash != digest:
            raise HTTPException(409, detail={'error': 'dispatch_payload_conflict'})
        if not owned:
            if row.receipt is None:
                raise HTTPException(409, detail={'error': 'dispatch_pending_or_unknown'})
            return DispatchReceipt.model_validate(row.receipt).model_dump()
        result = await handler(request, payload, user)
        receipt = DispatchReceipt.model_validate(result).model_dump()
        await accept_dispatch(user.id, key, receipt)
        return receipt
    except SQLAlchemyError as error:
        log.error('Dispatch journal unavailable user_id=%s error_type=%s', user.id, type(error).__name__)
        raise HTTPException(503, detail={'error': 'dispatch_journal_unavailable'}) from error
