"""Restricted operational views of the content-free delivery journal."""

import logging
import time
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from open_webui.internal.db import get_async_db_context
from open_webui.models.email_delivery import DeliveryView, EmailDelivery, requeue_email
from open_webui.models.users import UserModel
from open_webui.utils.auth import get_admin_user
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()
log = logging.getLogger(__name__)
DeliveryStatus = Literal['pending', 'claimed', 'retry', 'accepted', 'unknown', 'suppressed', 'expired', 'failed']


class DeliveryCount(BaseModel):
    status: str
    category: str
    reason: str | None
    count: int


class QueueReport(BaseModel):
    generated_at: int
    total: int
    counts: list[DeliveryCount]
    items: list[DeliveryView]


@router.get('', response_model=QueueReport)
async def delivery_report(
    response: Response,
    status: DeliveryStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    admin: UserModel = Depends(get_admin_user),
) -> QueueReport:
    """Acceptance is distinct from delivery; no recipient address or body is exposed."""
    response.headers['Cache-Control'] = 'no-store'
    try:
        async with get_async_db_context() as session:
            query = select(EmailDelivery)
            if status:
                query = query.where(EmailDelivery.status == status)
            items = (
                await session.scalars(
                    query.order_by(EmailDelivery.created_at.desc(), EmailDelivery.id).limit(limit).offset(offset)
                )
            ).all()
            counts = (
                await session.execute(
                    select(EmailDelivery.status, EmailDelivery.category, EmailDelivery.reason, func.count()).group_by(
                        EmailDelivery.status, EmailDelivery.category, EmailDelivery.reason
                    )
                )
            ).all()
            return QueueReport(
                generated_at=int(time.time()),
                total=sum(row[3] for row in counts),
                counts=[DeliveryCount(status=s, category=c, reason=r, count=n) for s, c, r, n in counts],
                items=[DeliveryView.model_validate(row) for row in items],
            )
    except SQLAlchemyError as error:
        log.error('Email report unavailable error_type=%s', type(error).__name__)
        raise HTTPException(503, 'Email report temporarily unavailable') from error


@router.post('/{delivery_id}/retry')
async def retry_delivery(
    delivery_id: str, response: Response, admin: UserModel = Depends(get_admin_user)
) -> dict[str, bool]:
    response.headers['Cache-Control'] = 'no-store'
    try:
        requeued = await requeue_email(delivery_id, int(time.time()))
    except SQLAlchemyError as error:
        log.error('Email retry unavailable error_type=%s', type(error).__name__)
        raise HTTPException(503, 'Email retry temporarily unavailable') from error
    if not requeued:
        raise HTTPException(409, 'Only proven-unsent temporary failures can be retried')
    return {'success': True}
