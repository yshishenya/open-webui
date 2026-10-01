"""Small explicit funnel API; no arbitrary URLs, payloads or personal data."""

from __future__ import annotations

import hashlib
import time
import uuid
from typing import Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials
from open_webui.internal.db import get_async_db_context
from open_webui.models.analytics import (
    AnalyticsBinding,
    AnalyticsIdentity,
)
from open_webui.models.users import UserModel
from open_webui.utils.airis.analytics import (
    LIFETIME_EVENTS,
    add_event,
    destinations,
    enabled_at,
    merge_identity_events,
    purge_identity,
)
from open_webui.utils.auth import bearer_security, get_current_user
from open_webui.utils.rate_limit import RateLimiter
from open_webui.utils.redis import get_redis_client
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
_limiter = RateLimiter(redis_client=get_redis_client(), limit=120, window=60)


async def limit_ingestion(request: Request) -> None:
    host = request.client.host if request.client else 'unknown'
    key = hashlib.sha256(host.encode()).hexdigest()
    if await run_in_threadpool(_limiter.is_limited, f'analytics:{key}'):
        raise HTTPException(429, 'Too many analytics requests')


class Touch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    occurred_at: int
    utm_source: str | None = Field(default=None, max_length=120)
    utm_medium: str | None = Field(default=None, max_length=120)
    utm_campaign: str | None = Field(default=None, max_length=120)
    utm_content: str | None = Field(default=None, max_length=120)
    utm_term: str | None = Field(default=None, max_length=120)
    yclid: str | None = Field(default=None, max_length=120)
    gclid: str | None = Field(default=None, max_length=120)
    ymclid: str | None = Field(default=None, max_length=120)

    @model_validator(mode='after')
    def validate_touch(self) -> Touch:
        now = int(time.time())
        if not now - 90 * 86400 <= self.occurred_at <= now + 60:
            raise ValueError('Touch timestamp outside permitted interval')
        for key, value in self.model_dump(exclude_none=True).items():
            if (
                key != 'occurred_at'
                and isinstance(value, str)
                and ('@' in value or '://' in value or '\n' in value or '\r' in value)
            ):
                raise ValueError('Campaign labels must not contain personal data or URLs')
        return self


class ContextForm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    consent: Literal['granted', 'denied']
    anonymous_id: uuid.UUID
    client_id: str | None = Field(default=None, pattern=r'^\d{1,32}$')
    device: Literal['desktop', 'phone', 'tablet', 'unknown'] = 'unknown'
    first_touch: Touch | None = None
    last_touch: Touch | None = None


class ContextResponse(BaseModel):
    analytics_user_id: str | None
    first_prompt_at: int | None = None
    first_response_at: int | None = None
    server_payment_tracking: bool = False
    server_signup_tracking: bool = False
    signup_completed_at: int | None = None


EventName = Literal[
    'product_first_visit',
    'landing_cta_click',
    'signup_form_viewed',
    'signup_started',
    'onboarding_completed',
    'billing_wallet_view',
    'billing_wallet_topup_package_click',
    'billing_wallet_topup_custom_submit',
    'first_prompt_submitted',
    'first_response_received',
]


class EventForm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    anonymous_id: uuid.UUID
    event_id: uuid.UUID
    event_name: EventName
    has_content: bool | None = None


class EventResponse(BaseModel):
    accepted: bool


async def optional_user(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    auth_token: HTTPAuthorizationCredentials | None = Depends(bearer_security),
) -> UserModel | None:
    if auth_token is None and not request.cookies.get('token'):
        return None
    return await get_current_user(request, response, background_tasks, auth_token)


def ensure_owner(identity: AnalyticsIdentity | None, user: UserModel | None) -> None:
    if identity is None:
        return
    if identity.user_id and (user is None or identity.user_id != user.id):
        raise HTTPException(403, 'Analytics context belongs to another account')


async def update_context_fields(
    db: AsyncSession, identity: AnalyticsIdentity, form: ContextForm, user: UserModel | None, now: int
) -> None:
    if not identity.consent:
        identity.granted_at = now
    identity.consent = True
    if user:
        identity.user_id = user.id
    if form.client_id:
        identity.client_id = form.client_id
    if form.first_touch and 'occurred_at' not in identity.first_touch:
        identity.first_touch = {
            **identity.first_touch,
            **form.first_touch.model_dump(exclude_none=True),
        }
    if form.last_touch:
        incoming = form.last_touch.model_dump(exclude_none=True)
        if any(k != 'occurred_at' for k in incoming) and incoming.get('occurred_at', 0) >= identity.last_touch.get(
            'occurred_at', 0
        ):
            identity.last_touch = incoming
    if 'device' not in identity.first_touch:
        identity.first_touch = {**identity.first_touch, 'device': form.device}
    if user and 'signup_method' not in identity.first_touch:
        identity.first_touch = {
            **identity.first_touch,
            'signup_method': 'oauth' if getattr(user, 'oauth', None) else 'unknown',
        }
    if user and user.created_at >= max(identity.granted_at, enabled_at()):
        await add_event(
            db,
            identity,
            'signup_completed',
            'signup_completed',
            {},
            user.created_at,
        )


@router.post('/context', response_model=ContextResponse, dependencies=[Depends(limit_ingestion)])
async def set_context(form: ContextForm, user: UserModel | None = Depends(optional_user)) -> ContextResponse:
    now = int(time.time())
    async with get_async_db_context() as db:
        identity = (
            await db.execute(
                select(AnalyticsIdentity)
                .join(
                    AnalyticsBinding,
                    AnalyticsBinding.identity_id == AnalyticsIdentity.id,
                )
                .where(AnalyticsBinding.anonymous_id == str(form.anonymous_id))
                .with_for_update()
            )
        ).scalar_one_or_none()
        account = None
        if user:
            account = (
                await db.execute(
                    select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == user.id).with_for_update()
                )
            ).scalar_one_or_none()
        if form.consent == 'denied':
            # UUID capability also permits revocation after the browser has logged out.
            for item in {item.id: item for item in (identity, account) if item is not None}.values():
                await purge_identity(db, item)
            await db.commit()
            return ContextResponse(analytics_user_id=None)
        ensure_owner(identity, user)
        if account and identity and account.id != identity.id:
            if not account.consent and identity.consent:
                account.granted_at = identity.granted_at
                account.consent = True
            # Alias contains random analytics IDs only, never application account IDs.
            await add_event(
                db,
                account,
                '$create_alias',
                f'alias:{identity.id}',
                {'anonymous_analytics_id': identity.id, 'alias': account.id},
                now,
            )
            await merge_identity_events(db, account, identity)
            if not account.first_touch or (
                identity.first_touch
                and identity.first_touch.get('occurred_at', now) < account.first_touch.get('occurred_at', now)
            ):
                account.first_touch = identity.first_touch
            await db.execute(
                update(AnalyticsBinding)
                .where(AnalyticsBinding.identity_id == identity.id)
                .values(identity_id=account.id)
            )
            await db.delete(identity)
            await db.flush()
            identity = account
        elif account:
            identity = account
        if identity is None:
            identity = AnalyticsIdentity(
                id=str(uuid.uuid4()),
                anonymous_id=str(form.anonymous_id),
                user_id=user.id if user else None,
                consent=True,
                granted_at=now,
                client_id=form.client_id,
                first_touch={},
                last_touch={},
            )
            db.add(identity)
            await db.flush()
        if await db.get(AnalyticsBinding, str(form.anonymous_id)) is None:
            db.add(AnalyticsBinding(anonymous_id=str(form.anonymous_id), identity_id=identity.id))
        await update_context_fields(db, identity, form, user, now)
        first_times = identity.lifetime or {}
        result = ContextResponse(
            analytics_user_id=identity.id,
            first_prompt_at=first_times.get('first_prompt_submitted'),
            first_response_at=first_times.get('first_response_received'),
            server_payment_tracking=enabled_at() > 0 and 'metrica' in destinations(),
            server_signup_tracking=enabled_at() > 0 and 'metrica' in destinations(),
            signup_completed_at=first_times.get('signup_completed'),
        )
        await db.commit()
        return result


@router.post('/events', response_model=EventResponse, dependencies=[Depends(limit_ingestion)])
async def ingest_event(form: EventForm, user: UserModel | None = Depends(optional_user)) -> EventResponse:
    if form.event_name in {'first_prompt_submitted', 'first_response_received'} and user is None:
        raise HTTPException(401, 'Authentication required')
    async with get_async_db_context() as db:
        if user:
            query = select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == user.id)
        else:
            query = (
                select(AnalyticsIdentity)
                .join(
                    AnalyticsBinding,
                    AnalyticsBinding.identity_id == AnalyticsIdentity.id,
                )
                .where(AnalyticsBinding.anonymous_id == str(form.anonymous_id))
            )
        identity = (await db.execute(query.with_for_update())).scalar_one_or_none()
        if identity is None:
            return EventResponse(accepted=False)
        ensure_owner(identity, user)
        if form.event_name == 'first_response_received' and not form.has_content:
            return EventResponse(accepted=False)
        key = form.event_name if form.event_name in LIFETIME_EVENTS else str(form.event_id)
        result = await add_event(db, identity, form.event_name, key, {}, int(time.time()))
        await db.commit()
        return EventResponse(accepted=result)
