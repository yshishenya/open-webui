"""Authenticated, read-only recovery of a lost foreground acknowledgement."""

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from open_webui.models.chat_dispatch import get_dispatch
from open_webui.models.users import UserModel
from open_webui.utils.airis.chat_dispatch import DispatchReceipt
from open_webui.utils.airis.task_success import operation_id
from open_webui.utils.auth import get_verified_user
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()
log = logging.getLogger(__name__)


class DispatchState(BaseModel):
    state: Literal['absent', 'unknown', 'accepted']
    receipt: DispatchReceipt | None = None


@router.get('/{client_operation_id}', response_model=DispatchState)
async def read_dispatch(
    client_operation_id: UUID,
    response: Response,
    user: UserModel = Depends(get_verified_user),
) -> DispatchState:
    """Absent is a snapshot; only the POST's unique claim may authorize dispatch."""
    response.headers['Cache-Control'] = 'no-store'
    try:
        row = await get_dispatch(user.id, operation_id(client_operation_id, []))
    except SQLAlchemyError as error:
        log.error('Dispatch lookup unavailable user_id=%s error_type=%s', user.id, type(error).__name__)
        raise HTTPException(503, detail={'error': 'dispatch_journal_unavailable'}) from error
    if row is None:
        return DispatchState(state='absent')
    if row.receipt is None:
        return DispatchState(state='unknown')
    return DispatchState(state='accepted', receipt=DispatchReceipt.model_validate(row.receipt))
