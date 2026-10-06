"""Explicit, consent-bound events. Provider failures never affect core product flows."""

from __future__ import annotations

import asyncio
import csv
import datetime as dt
import io
import logging
import os
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import httpx
from open_webui.internal.db import get_async_db_context
from open_webui.models.analytics import (
    AnalyticsBinding,
    AnalyticsDelivery,
    AnalyticsEvent,
    AnalyticsIdentity,
)
from open_webui.utils.airis.data_retention import ANALYTICS_RETENTION_SECONDS, retained_touch
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)
Property = str | int | bool
LIFETIME_EVENTS = {
    'product_first_visit',
    'signup_completed',
    'first_prompt_submitted',
    'first_response_received',
    'first_payment_confirmed',
}
METRICA_GOALS = {
    'signup_completed': 'lead_signup_completed',
    'payment_created': 'billing_topup_payment_created',
    'payment_confirmed': 'revenue_topup_completed',
    'first_payment_confirmed': 'revenue_first_payment',
    'refund_confirmed': 'revenue_refund_confirmed',
}


def enabled_at() -> int:
    """Explicit rollout cutoff; historical events are never replayed by default."""
    try:
        return int(os.getenv('AIRIS_ANALYTICS_ENABLED_AT', '0'))
    except ValueError:
        return 0


def destinations() -> list[str]:
    if enabled_at() <= 0:
        return []
    result: list[str] = []
    if os.getenv('AIRIS_POSTHOG_KEY') and os.getenv('AIRIS_POSTHOG_HOST'):
        result.append('posthog')
    if os.getenv('AIRIS_METRICA_OAUTH_TOKEN') and os.getenv('AIRIS_METRICA_COUNTER_ID', '').isdigit():
        result.append('metrica')
    return result


async def add_event(
    db: AsyncSession,
    identity: AnalyticsIdentity,
    name: str,
    key: str,
    properties: dict[str, Property],
    occurred_at: int,
) -> bool:
    if (
        not identity.consent
        or occurred_at < max(identity.granted_at, enabled_at())
        or occurred_at <= int(time.time()) - ANALYTICS_RETENTION_SECONDS
    ):
        return False
    if name in LIFETIME_EVENTS:
        if name in (identity.lifetime or {}):
            return False
        previous = (
            await db.execute(
                select(AnalyticsEvent.occurred_at)
                .where(AnalyticsEvent.identity_id == identity.id, AnalyticsEvent.event_name == name)
                .limit(1)
            )
        ).scalar_one_or_none()
        if previous is not None:
            identity.lifetime = {**(identity.lifetime or {}), name: previous}
            return False
    event_id = f'{identity.id}:{key}'
    try:
        async with db.begin_nested():
            db.add(
                AnalyticsEvent(
                    id=event_id,
                    identity_id=identity.id,
                    event_name=name,
                    occurred_at=occurred_at,
                    properties=properties,
                )
            )
            await db.flush()
            for destination in destinations():
                if destination == 'metrica' and (name not in METRICA_GOALS):
                    continue
                db.add(
                    AnalyticsDelivery(
                        id=str(uuid.uuid4()),
                        event_id=event_id,
                        destination=destination,
                        state='pending',
                        attempts=0,
                        available_at=0,
                    )
                )
            await db.flush()
    except IntegrityError:
        return False
    if name in LIFETIME_EVENTS:
        identity.lifetime = {**(identity.lifetime or {}), name: occurred_at}
    return True


async def merge_identity_events(db: AsyncSession, account: AnalyticsIdentity, anonymous: AnalyticsIdentity) -> None:
    """Collapse lifetime collisions before joining a second observed device."""
    lifetime = dict(account.lifetime or {})
    for name, occurred_at in (anonymous.lifetime or {}).items():
        lifetime[name] = min(lifetime.get(name, occurred_at), occurred_at)
    events = (
        (
            await db.execute(
                select(AnalyticsEvent)
                .where(
                    AnalyticsEvent.identity_id.in_([account.id, anonymous.id]),
                    AnalyticsEvent.event_name.in_(LIFETIME_EVENTS),
                )
                .order_by(AnalyticsEvent.occurred_at, AnalyticsEvent.id)
            )
        )
        .scalars()
        .all()
    )
    seen: set[str] = set()
    for event in events:
        if event.event_name in seen:
            await db.execute(delete(AnalyticsDelivery).where(AnalyticsDelivery.event_id == event.id))
            await db.delete(event)
        else:
            seen.add(event.event_name)
            lifetime[event.event_name] = min(lifetime.get(event.event_name, event.occurred_at), event.occurred_at)
    account.lifetime = lifetime
    await db.flush()
    await db.execute(
        update(AnalyticsEvent).where(AnalyticsEvent.identity_id == anonymous.id).values(identity_id=account.id)
    )


@asynccontextmanager
async def account_session(db: AsyncSession | None) -> AsyncIterator[AsyncSession]:
    if db is not None:
        yield db
    else:
        async with get_async_db_context() as session:
            yield session


async def record_account_event(
    user_id: str,
    event_name: str,
    event_key: str,
    properties: dict[str, Property],
    occurred_at: int | None = None,
    db: AsyncSession | None = None,
) -> bool:
    """Financial callers supply verified facts, never browser-supplied payment data."""
    async with account_session(db) as session:
        identity = (
            await session.execute(
                select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == user_id).with_for_update()
            )
        ).scalar_one_or_none()
        if identity is None:
            return False
        result = await add_event(
            session,
            identity,
            event_name,
            event_key,
            properties,
            occurred_at or int(time.time()),
        )
        if db is None:
            await session.commit()
        return result


async def purge_identity(db: AsyncSession, identity: AnalyticsIdentity) -> None:
    event_ids = select(AnalyticsEvent.id).where(AnalyticsEvent.identity_id == identity.id)
    await db.execute(delete(AnalyticsDelivery).where(AnalyticsDelivery.event_id.in_(event_ids)))
    await db.execute(delete(AnalyticsEvent).where(AnalyticsEvent.identity_id == identity.id))
    identity.consent = False
    identity.client_id = None
    identity.first_touch = {}
    identity.last_touch = {}


async def delete_account_analytics(db: AsyncSession, user_id: str) -> None:
    """Erase local analytics in the account transaction, after its User lock."""
    identity = await db.scalar(select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == user_id).with_for_update())
    if identity is None:
        return
    await purge_identity(db, identity)
    await db.execute(delete(AnalyticsBinding).where(AnalyticsBinding.identity_id == identity.id))
    await db.delete(identity)


def safe_posthog_host(host: str) -> str:
    parsed = urlparse(host)
    if (
        parsed.scheme != 'https'
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError('AIRIS_POSTHOG_HOST must be an HTTPS origin')
    return host.rstrip('/')


async def deliver_metrica(
    db: AsyncSession,
    delivery: AnalyticsDelivery,
    event: AnalyticsEvent,
    identity: AnalyticsIdentity,
    client: httpx.AsyncClient,
) -> None:
    delivery_id = delivery.id
    if not identity.client_id:
        delivery.available_at = int(time.time()) + 180
        await db.commit()
        return
    counter = os.environ['AIRIS_METRICA_COUNTER_ID']
    if not counter.isdigit():
        raise ValueError('Invalid Metrica counter')
    headers = {'Authorization': f"OAuth {os.environ['AIRIS_METRICA_OAUTH_TOKEN']}"}
    base = f'https://api-metrika.yandex.net/management/v1/counter/{counter}/offline_conversions'
    comment = str(uuid.uuid5(uuid.NAMESPACE_URL, event.id))
    if delivery.state == 'uncertain':
        response = await client.get(f'{base}/uploadings', headers=headers, params={'limit': 10000})
        response.raise_for_status()
        matched = next(
            (item for item in response.json()['uploadings'] if item.get('comment') == comment),
            None,
        )
        if matched:
            delivery.upload_id = str(matched['id'])
            delivery.state = 'uploaded'
        delivery.available_at = int(time.time()) + 180
    elif delivery.state == 'uploaded':
        response = await client.get(f'{base}/uploading/{delivery.upload_id}', headers=headers)
        response.raise_for_status()
        status = response.json()['uploading']['status']
        if status == 'PROCESSED':
            delivery.state = 'delivered'
        elif status == 'LINKAGE_FAILURE':
            delivery.state = 'unmatched'
        delivery.available_at = int(time.time()) + 180
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ClientId', 'Target', 'DateTime', 'Price', 'Currency'])
        amount = event.properties.get('amount_kopeks', 0)
        writer.writerow(
            [
                identity.client_id,
                METRICA_GOALS[event.event_name],
                event.occurred_at,
                str(int(amount) / 100),
                'RUB',
            ]
        )
        # Persist an ambiguous-attempt marker BEFORE non-idempotent upload.
        # Crashes/timeouts reconcile by comment and never blindly resend.
        delivery.state = 'uncertain'
        await db.commit()
        # The marker commit released both locks: reacquire in the shared order.
        identity = (
            await db.execute(
                select(AnalyticsIdentity)
                .where(AnalyticsIdentity.id == event.identity_id)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
        if identity is None or not identity.consent:
            return
        delivery = (
            await db.execute(
                select(AnalyticsDelivery).where(AnalyticsDelivery.id == delivery_id).with_for_update(skip_locked=True)
            )
        ).scalar_one_or_none()
        if delivery is None:
            return
        response = await client.post(
            f'{base}/upload',
            params={'comment': comment},
            headers=headers,
            files={
                'file': (
                    'conversion.csv',
                    output.getvalue().encode(),
                    'text/csv',
                )
            },
        )
        response.raise_for_status()
        delivery.upload_id = str(response.json()['uploading']['id'])
        delivery.state = 'uploaded'
        delivery.available_at = int(time.time()) + 180


async def deliver_one(delivery_id: str, client: httpx.AsyncClient) -> None:
    """Hold identity lock through transmission: revoke serializes against active sends."""
    async with get_async_db_context() as db:
        # Revocation/deletion also locks Identity before deleting its delivery jobs.
        owner_id = await db.scalar(
            select(AnalyticsEvent.identity_id)
            .join(AnalyticsDelivery, AnalyticsDelivery.event_id == AnalyticsEvent.id)
            .where(AnalyticsDelivery.id == delivery_id)
        )
        identity = await db.scalar(
            select(AnalyticsIdentity).where(AnalyticsIdentity.id == owner_id).with_for_update(skip_locked=True)
        )
        if identity is None and await db.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.id == owner_id)):
            return
        delivery = (
            await db.execute(
                select(AnalyticsDelivery).where(AnalyticsDelivery.id == delivery_id).with_for_update(skip_locked=True)
            )
        ).scalar_one_or_none()
        if (
            delivery is None
            or delivery.state not in {'pending', 'uploaded', 'uncertain'}
            or delivery.available_at > int(time.time())
            or delivery.destination not in destinations()
        ):
            return
        event = await db.get(AnalyticsEvent, delivery.event_id)
        if event is None:
            await db.delete(delivery)
            await db.commit()
            return
        if event.identity_id != owner_id:
            return  # An intervening identity merge is retried with its current owner.
        if identity is None or not identity.consent or event.occurred_at < identity.granted_at:
            delivery.state = 'suppressed'
            await db.commit()
            return
        try:
            if delivery.destination == 'posthog':
                host = safe_posthog_host(os.environ['AIRIS_POSTHOG_HOST'])
                # Stable UUID allows upstream duplicate suppression after ambiguous timeouts.
                event_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, event.id))
                response = await client.post(
                    f'{host}/i/v0/e/',
                    json={
                        'api_key': os.environ['AIRIS_POSTHOG_KEY'],
                        'uuid': event_uuid,
                        'event': event.event_name,
                        'distinct_id': (
                            event.properties.get('anonymous_analytics_id', identity.id)
                            if event.event_name == '$create_alias'
                            else identity.id
                        ),
                        'timestamp': dt.datetime.fromtimestamp(event.occurred_at, dt.UTC).isoformat(),
                        'properties': {
                            **event.properties,
                            '$process_person_profile': bool(identity.user_id),
                            **{
                                f'first_{k}': v
                                for k, v in retained_touch(
                                    identity.first_touch, identity.granted_at, int(time.time())
                                ).items()
                                if k != 'occurred_at'
                            },
                            **{
                                f'last_{k}': v
                                for k, v in retained_touch(
                                    identity.last_touch, identity.granted_at, int(time.time())
                                ).items()
                                if k != 'occurred_at'
                            },
                        },
                    },
                )
                response.raise_for_status()
                delivery.state = 'delivered'
            else:
                await deliver_metrica(db, delivery, event, identity, client)
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            if (
                delivery.destination == 'metrica'
                and isinstance(exc, httpx.HTTPStatusError)
                and exc.request.method == 'POST'
                and 400 <= exc.response.status_code < 500
            ):
                delivery.state = 'pending'
            # Never log payload, tokens, URLs or identifying values.
            delivery.attempts += 1
            delivery.available_at = int(time.time()) + min(3600, 30 * 2 ** min(delivery.attempts, 7))
            if delivery.attempts >= 12:
                delivery.state = 'failed'
            log.warning(
                'Analytics delivery failed: destination=%s attempt=%s',
                delivery.destination,
                delivery.attempts,
            )
        await db.commit()


async def repair_missing_deliveries(batch_size: int = 100) -> None:
    """Backfill missing jobs after configuration recovery without replaying sent jobs."""
    cutoff = enabled_at()
    for destination in destinations():
        async with get_async_db_context() as db:
            query = (
                select(AnalyticsEvent)
                .join(AnalyticsIdentity, AnalyticsIdentity.id == AnalyticsEvent.identity_id)
                .where(
                    AnalyticsIdentity.consent.is_(True),
                    AnalyticsEvent.occurred_at >= cutoff,
                    AnalyticsEvent.occurred_at > int(time.time()) - ANALYTICS_RETENTION_SECONDS,
                    AnalyticsEvent.occurred_at >= AnalyticsIdentity.granted_at,
                    ~select(AnalyticsDelivery.id)
                    .where(
                        AnalyticsDelivery.event_id == AnalyticsEvent.id,
                        AnalyticsDelivery.destination == destination,
                    )
                    .exists(),
                )
            )
            if destination == 'metrica':
                query = query.where(AnalyticsEvent.event_name.in_(METRICA_GOALS))
            events = (
                (
                    await db.execute(
                        query.order_by(AnalyticsEvent.occurred_at, AnalyticsEvent.id).limit(
                            max(1, min(batch_size, 500))
                        )
                    )
                )
                .scalars()
                .all()
            )
            for event in events:
                # Same identity lock as revoke; the unique pair resolves competing workers.
                identity = (
                    await db.execute(
                        select(AnalyticsIdentity).where(AnalyticsIdentity.id == event.identity_id).with_for_update()
                    )
                ).scalar_one_or_none()
                if (
                    identity is None
                    or not identity.consent
                    or event.occurred_at < max(cutoff, identity.granted_at)
                    or (
                        await db.execute(select(AnalyticsEvent.id).where(AnalyticsEvent.id == event.id))
                    ).scalar_one_or_none()
                    is None
                ):
                    continue
                try:
                    async with db.begin_nested():
                        db.add(
                            AnalyticsDelivery(
                                id=str(uuid.uuid4()),
                                event_id=event.id,
                                destination=destination,
                                state='pending',
                                attempts=0,
                                available_at=0,
                            )
                        )
                        await db.flush()
                except IntegrityError:
                    # Existing delivery is authoritative, including terminal/ambiguous states.
                    continue
            await db.commit()


async def dispatch_pending() -> None:
    if enabled_at() <= 0:
        return
    await repair_missing_deliveries()
    async with get_async_db_context() as db:
        ids = list(
            (
                await db.execute(
                    select(AnalyticsDelivery.id)
                    .where(
                        AnalyticsDelivery.state.in_(['pending', 'uploaded', 'uncertain']),
                        AnalyticsDelivery.destination.in_(destinations()),
                        AnalyticsDelivery.available_at <= int(time.time()),
                    )
                    .limit(100)
                )
            ).scalars()
        )
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        for delivery_id in ids:
            await deliver_one(delivery_id, client)


async def delivery_loop() -> None:
    created_cursor: tuple[int, str] | None = None
    payment_cursor: tuple[int, str] | None = None
    refund_cursor: tuple[int, str] | None = None
    while True:
        try:
            from open_webui.utils.airis.analytics_payments import (
                repair_confirmed_payments,
                repair_confirmed_refunds,
                repair_created_payments,
            )

            created_cursor = await repair_created_payments(created_cursor)
            payment_cursor = await repair_confirmed_payments(payment_cursor)
            refund_cursor = await repair_confirmed_refunds(refund_cursor)
            await dispatch_pending()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception('Analytics dispatcher failed')
        await asyncio.sleep(30)
