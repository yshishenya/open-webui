"""Restricted operational views of the content-free delivery journal."""

import asyncio
import logging
import time
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from open_webui.internal.db import get_async_db_context
from open_webui.models.email_delivery import DeliveryView, EmailDelivery, requeue_email
from open_webui.models.users import UserModel
from open_webui.utils.airis.onboarding_report import RegistrationReport, registration_report
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


@router.get('/cohorts', response_model=RegistrationReport)
async def onboarding_cohorts(
    response: Response,
    start_at: Annotated[int, Query(ge=1, le=4102444800)],
    end_at: Annotated[int, Query(ge=1, le=4102444800)],
    observed_from: Annotated[int, Query(ge=1, le=4102444800)],
    timezone: Annotated[str, Query(min_length=1, max_length=64)] = 'UTC',
    exclude_user_id: Annotated[list[str] | None, Query(max_length=1000)] = None,
    admin: UserModel = Depends(get_admin_user),
) -> RegistrationReport:
    """Operational snapshot; observation cutoff and test exclusions must be explicit."""
    response.headers['Cache-Control'] = 'no-store'
    now = int(time.time())
    if end_at <= start_at or end_at - start_at > 366 * 86400 or max(start_at, observed_from) > now:
        raise HTTPException(422, 'Invalid registration range or observation start')
    excluded = frozenset(exclude_user_id or [])
    if any(not value or len(value) > 128 for value in excluded):
        raise HTTPException(422, 'Invalid test account exclusion')
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise HTTPException(422, 'Unknown IANA timezone') from error
    try:
        return await asyncio.wait_for(
            registration_report(start_at, end_at, observed_from, now, zone, excluded),
            timeout=20,
        )
    except OverflowError as error:
        raise HTTPException(422, 'Report exceeds 10000 accounts; narrow the registration range') from error
    except (SQLAlchemyError, TimeoutError) as error:
        log.error('Registration report unavailable error_type=%s', type(error).__name__)
        raise HTTPException(503, 'Registration report temporarily unavailable') from error


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
