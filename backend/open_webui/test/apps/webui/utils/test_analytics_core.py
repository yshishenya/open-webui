"""Isolated checks for consent, lifetime deduplication, identity joins and retries."""

import asyncio
import time
import uuid
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import pytest
from open_webui.models.analytics import (
    AnalyticsBinding,
    AnalyticsDelivery,
    AnalyticsEvent,
    AnalyticsIdentity,
)
from open_webui.models.users import User
from open_webui.routers import airis_analytics as router
from open_webui.utils.airis import analytics as core
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

RunCase = Callable[[Callable[[async_sessionmaker[AsyncSession]], Awaitable[None]]], None]


@pytest.fixture
def run_case(monkeypatch: pytest.MonkeyPatch) -> RunCase:
    def run(test: Callable[[async_sessionmaker[AsyncSession]], Awaitable[None]]) -> None:
        async def execute() -> None:
            engine = create_async_engine('sqlite+aiosqlite:///:memory:')
            tables = [
                User.__table__,
                AnalyticsIdentity.__table__,
                AnalyticsBinding.__table__,
                AnalyticsEvent.__table__,
                AnalyticsDelivery.__table__,
            ]
            async with engine.begin() as conn:
                for table in tables:
                    await conn.run_sync(table.create)
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as db:
                for account in ['private-account-id', 'new-account', 'financial-account', 'existing-account']:
                    db.add(User(id=account, name='Fixture', email=f'{account}@example.com'))
                await db.commit()

            @asynccontextmanager
            async def context():
                async with factory() as db:
                    yield db

            monkeypatch.setattr(router, 'get_async_db_context', context)
            monkeypatch.setattr(core, 'get_async_db_context', context)
            monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '1')
            await test(factory)
            await engine.dispose()

        asyncio.run(execute())

    return run


def test_lifetime_merge_and_revoke(run_case):
    async def case(factory):
        anonymous = uuid.uuid4()
        ctx = router.ContextForm(consent='granted', anonymous_id=anonymous, client_id='12345')
        first = await router.set_context(ctx, None)
        await router.ingest_event(
            router.EventForm(
                anonymous_id=anonymous,
                event_id=uuid.uuid4(),
                event_name='product_first_visit',
            ),
            None,
        )
        user = SimpleNamespace(id='private-account-id', created_at=int(time.time()))
        linked = await router.set_context(ctx, user)
        assert linked.analytics_user_id == first.analytics_user_id
        event = router.EventForm(
            anonymous_id=anonymous,
            event_id=uuid.uuid4(),
            event_name='first_response_received',
            has_content=True,
        )
        assert (await router.ingest_event(event, user)).accepted
        assert not (await router.ingest_event(event.model_copy(update={'event_id': uuid.uuid4()}), user)).accepted
        assert not (await router.ingest_event(event.model_copy(update={'has_content': False}), user)).accepted
        second = uuid.uuid4()
        assert (
            await router.set_context(router.ContextForm(consent='granted', anonymous_id=second), user)
        ).analytics_user_id == linked.analytics_user_id
        async with factory() as db:
            events = list((await db.execute(select(AnalyticsEvent))).scalars())
            assert len([e for e in events if e.event_name == 'first_response_received']) == 1
            assert all('private-account-id' not in e.id for e in events)
        await router.set_context(router.ContextForm(consent='denied', anonymous_id=anonymous), None)
        async with factory() as db:
            assert not list((await db.execute(select(AnalyticsEvent))).scalars())
            assert not (await db.get(AnalyticsIdentity, linked.analytics_user_id)).consent

    run_case(case)


def test_delivery_retry_and_consent_guard(run_case, monkeypatch):
    monkeypatch.setenv('AIRIS_POSTHOG_KEY', 'test-key')
    monkeypatch.setenv('AIRIS_POSTHOG_HOST', 'https://eu.i.posthog.com')

    async def case(factory):
        anonymous = uuid.uuid4()
        await router.set_context(router.ContextForm(consent='granted', anonymous_id=anonymous), None)
        await router.ingest_event(
            router.EventForm(
                anonymous_id=anonymous,
                event_id=uuid.uuid4(),
                event_name='product_first_visit',
            ),
            None,
        )
        async with factory() as db:
            delivery = (await db.execute(select(AnalyticsDelivery))).scalar_one()
            delivery_id = delivery.id
        calls = []

        def fail(request):
            calls.append(request)
            return httpx.Response(503)

        async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as client:
            await core.deliver_one(delivery_id, client)
            await core.deliver_one(delivery_id, client)
        assert len(calls) == 1
        async with factory() as db:
            delivery = await db.get(AnalyticsDelivery, delivery_id)
            assert delivery.state == 'pending' and delivery.attempts == 1
        await router.set_context(router.ContextForm(consent='denied', anonymous_id=anonymous), None)
        async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as client:
            await core.deliver_one(delivery_id, client)
        assert len(calls) == 1

    run_case(case)


def test_touch_and_event_boundary():
    with pytest.raises(ValueError):
        router.Touch(occurred_at=int(time.time()), utm_campaign='alice@example.com')
    with pytest.raises(ValueError):
        router.EventForm(
            anonymous_id=uuid.uuid4(),
            event_id=uuid.uuid4(),
            event_name='payment_confirmed',
            amount_kopeks=100,
        )
    with pytest.raises(ValueError):
        router.Touch(occurred_at=1)
    with pytest.raises(ValueError):
        core.safe_posthog_host('http://example.com')


def test_first_last_touch_and_grant_boundary(run_case):
    async def case(factory):
        now = int(time.time())
        anonymous = uuid.uuid4()
        first = router.Touch(occurred_at=now, utm_source='first')
        context = router.ContextForm(
            consent='granted',
            anonymous_id=anonymous,
            first_touch=first,
            last_touch=first,
        )
        identity = await router.set_context(context, None)
        user = SimpleNamespace(id='new-account', created_at=now)
        await router.set_context(context, user)
        await router.set_context(
            context.model_copy(
                update={
                    'first_touch': router.Touch(occurred_at=now, utm_source='second'),
                    'last_touch': router.Touch(occurred_at=now, utm_source='second'),
                }
            ),
            user,
        )
        await router.set_context(
            context.model_copy(update={'last_touch': router.Touch(occurred_at=now)}),
            user,
        )
        async with factory() as db:
            row = await db.get(AnalyticsIdentity, identity.analytics_user_id)
            assert row.first_touch['utm_source'] == 'first'
            assert row.last_touch['utm_source'] == 'second'
            signup = list(
                (
                    await db.execute(select(AnalyticsEvent).where(AnalyticsEvent.event_name == 'signup_completed'))
                ).scalars()
            )
            assert len(signup) == 1 and signup[0].occurred_at == now
            assert not await core.add_event(db, row, 'billing_topup_completed', 'old', {}, now - 10)

    run_case(case)


def test_metrica_ambiguous_upload_never_blindly_repeats(run_case, monkeypatch):
    monkeypatch.delenv('AIRIS_POSTHOG_KEY', raising=False)
    monkeypatch.setenv('AIRIS_METRICA_OAUTH_TOKEN', 'test-token')
    monkeypatch.setenv('AIRIS_METRICA_COUNTER_ID', '1234')

    async def case(factory):
        anonymous = uuid.uuid4()
        user = SimpleNamespace(id='financial-account', created_at=1)
        await router.set_context(
            router.ContextForm(consent='granted', anonymous_id=anonymous, client_id='123'),
            user,
        )
        assert await core.record_account_event(
            user.id,
            'payment_confirmed',
            'payment:1',
            {'amount_kopeks': 10000},
            int(time.time()),
        )
        async with factory() as db:
            delivery_id = (await db.execute(select(AnalyticsDelivery.id))).scalar_one()
        methods = []

        def handler(request):
            methods.append(request.method)
            if request.method == 'POST':
                raise httpx.ReadTimeout('ambiguous network failure')
            return httpx.Response(200, json={'uploadings': []})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await core.deliver_one(delivery_id, client)
            async with factory() as db:
                delivery = await db.get(AnalyticsDelivery, delivery_id)
                assert delivery.state == 'uncertain'
                delivery.available_at = 0
                await db.commit()
            await core.deliver_one(delivery_id, client)
        assert methods == ['POST', 'GET']

    run_case(case)


@pytest.mark.parametrize('state', ['uploaded', 'uncertain'])
@pytest.mark.parametrize('status', [401, 404, 429])
def test_metrica_status_errors_never_restart_upload(
    run_case: Callable[[Callable[[async_sessionmaker[AsyncSession]], Awaitable[None]]], None],
    monkeypatch: pytest.MonkeyPatch,
    state: str,
    status: int,
) -> None:
    monkeypatch.delenv('AIRIS_POSTHOG_KEY', raising=False)
    monkeypatch.setenv('AIRIS_METRICA_OAUTH_TOKEN', 'test-token')
    monkeypatch.setenv('AIRIS_METRICA_COUNTER_ID', '1234')

    async def case(factory: async_sessionmaker[AsyncSession]) -> None:
        anonymous = uuid.uuid4()
        user = SimpleNamespace(id='financial-account', created_at=1)
        await router.set_context(router.ContextForm(consent='granted', anonymous_id=anonymous, client_id='123'), user)
        await core.record_account_event(
            user.id, 'payment_confirmed', 'payment:1', {'amount_kopeks': 10000}, int(time.time())
        )
        async with factory() as db:
            delivery = (await db.execute(select(AnalyticsDelivery))).scalar_one()
            delivery.state = state
            delivery.upload_id = 'accepted-upload' if state == 'uploaded' else None
            delivery_id, event_id, upload_id = delivery.id, delivery.event_id, delivery.upload_id
            await db.commit()
        methods: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            methods.append(request.method)
            if len(methods) == 1:
                return httpx.Response(status)
            if state == 'uploaded':
                return httpx.Response(200, json={'uploading': {'status': 'PROCESSED'}})
            comment = str(uuid.uuid5(uuid.NAMESPACE_URL, event_id))
            return httpx.Response(200, json={'uploadings': [{'id': 'accepted-upload', 'comment': comment}]})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await core.deliver_one(delivery_id, client)
            async with factory() as db:
                delivery = await db.get(AnalyticsDelivery, delivery_id)
                assert delivery.state == state and delivery.upload_id == upload_id
                delivery.available_at = 0
                await db.commit()
            await core.deliver_one(delivery_id, client)
        assert methods == ['GET', 'GET']
        async with factory() as db:
            delivery = await db.get(AnalyticsDelivery, delivery_id)
            assert delivery.state == ('delivered' if state == 'uploaded' else 'uploaded')
            assert delivery.upload_id == 'accepted-upload'

    run_case(case)


def test_populated_device_merge_and_lifetime_after_regrant(run_case):
    async def case(factory):
        first = uuid.uuid4()
        second = uuid.uuid4()
        user = SimpleNamespace(id='existing-account', created_at=1)
        first_context = router.ContextForm(consent='granted', anonymous_id=first)
        account = await router.set_context(first_context, user)
        await router.ingest_event(
            router.EventForm(anonymous_id=first, event_id=uuid.uuid4(), event_name='product_first_visit'), user
        )
        await router.ingest_event(
            router.EventForm(anonymous_id=first, event_id=uuid.uuid4(), event_name='first_prompt_submitted'), user
        )
        response_event = router.EventForm(
            anonymous_id=first, event_id=uuid.uuid4(), event_name='first_response_received', has_content=True
        )
        assert (await router.ingest_event(response_event, user)).accepted
        second_context = router.ContextForm(consent='granted', anonymous_id=second)
        await router.set_context(second_context, None)
        await router.ingest_event(
            router.EventForm(anonymous_id=second, event_id=uuid.uuid4(), event_name='product_first_visit'), None
        )
        linked = await router.set_context(second_context, user)
        assert linked.analytics_user_id == account.analytics_user_id
        assert not (
            await router.ingest_event(
                router.EventForm(anonymous_id=second, event_id=uuid.uuid4(), event_name='product_first_visit'), user
            )
        ).accepted
        async with factory() as db:
            visits = list(
                (
                    await db.execute(
                        select(AnalyticsEvent).where(
                            AnalyticsEvent.identity_id == account.analytics_user_id,
                            AnalyticsEvent.event_name == 'product_first_visit',
                        )
                    )
                ).scalars()
            )
            assert len(visits) == 1
        await router.set_context(router.ContextForm(consent='denied', anonymous_id=first), user)
        regrant = await router.set_context(first_context, user)
        assert regrant.first_prompt_at is not None and regrant.first_response_at is not None
        assert not (
            await router.ingest_event(response_event.model_copy(update={'event_id': uuid.uuid4()}), user)
        ).accepted
        async with factory() as db:
            assert not list((await db.execute(select(AnalyticsEvent))).scalars())
            assert not list((await db.execute(select(AnalyticsDelivery))).scalars())

    run_case(case)


def test_server_tracking_requires_configured_destination(run_case, monkeypatch):
    async def case(factory):
        anonymous = uuid.uuid4()
        form = router.ContextForm(consent='granted', anonymous_id=anonymous)
        monkeypatch.delenv('AIRIS_METRICA_OAUTH_TOKEN', raising=False)
        response = await router.set_context(form, None)
        assert not response.server_payment_tracking and not response.server_signup_tracking
        monkeypatch.setenv('AIRIS_METRICA_OAUTH_TOKEN', 'test-token')
        monkeypatch.setenv('AIRIS_METRICA_COUNTER_ID', '12345')
        response = await router.set_context(form, None)
        assert response.server_payment_tracking and response.server_signup_tracking
        monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '0')
        response = await router.set_context(form, None)
        assert not response.server_payment_tracking and not response.server_signup_tracking

    run_case(case)


def test_delivery_configuration_recovery(run_case, monkeypatch):
    async def case(factory):
        for key in ('AIRIS_POSTHOG_KEY', 'AIRIS_POSTHOG_HOST', 'AIRIS_METRICA_OAUTH_TOKEN'):
            monkeypatch.delenv(key, raising=False)
        async with factory() as db:
            identity = AnalyticsIdentity(
                id='recovery',
                anonymous_id='recovery',
                client_id='1234567890123456789',
                consent=True,
                granted_at=10,
                first_touch={},
                last_touch={},
                lifetime={},
            )
            db.add(identity)
            await db.flush()
            assert await core.add_event(db, identity, 'billing_wallet_view', 'wallet', {}, 20)
            assert await core.add_event(db, identity, 'payment_confirmed', 'payment', {}, 20)
            for state in ('uploaded', 'uncertain', 'delivered'):
                event_id = f'recovery:{state}'
                db.add(
                    AnalyticsEvent(
                        id=event_id,
                        identity_id=identity.id,
                        event_name='payment_confirmed',
                        occurred_at=20,
                        properties={},
                    )
                )
                db.add(
                    AnalyticsDelivery(
                        id=state,
                        event_id=event_id,
                        destination='metrica',
                        state=state,
                        attempts=4,
                        available_at=0 if state == 'uploaded' else 99,
                        upload_id='accepted',
                    )
                )
            db.add(
                AnalyticsIdentity(
                    id='denied',
                    anonymous_id='denied',
                    consent=False,
                    granted_at=10,
                    first_touch={},
                    last_touch={},
                    lifetime={},
                )
            )
            for event_id, owner, timestamp in [
                ('denied-event', 'denied', 20),
                ('before-grant', 'recovery', 5),
                ('before-cutoff', 'recovery', 0),
            ]:
                db.add(
                    AnalyticsEvent(
                        id=event_id,
                        identity_id=owner,
                        event_name='payment_confirmed',
                        occurred_at=timestamp,
                        properties={},
                    )
                )
            await db.commit()

        def unexpected_request(request: httpx.Request) -> httpx.Response:
            raise AssertionError('Disabled destination must not send HTTP requests')

        async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected_request)) as client:
            await core.deliver_one('uploaded', client)
        async with factory() as db:
            guarded = await db.get(AnalyticsDelivery, 'uploaded')
            assert (guarded.state, guarded.attempts) == ('uploaded', 4)
        monkeypatch.setenv('AIRIS_POSTHOG_KEY', 'test')
        monkeypatch.setenv('AIRIS_POSTHOG_HOST', 'https://analytics.example.com')
        monkeypatch.setenv('AIRIS_METRICA_OAUTH_TOKEN', 'test')
        monkeypatch.setenv('AIRIS_METRICA_COUNTER_ID', '123')
        await core.repair_missing_deliveries(batch_size=2)
        await core.repair_missing_deliveries()
        await core.repair_missing_deliveries()
        async with factory() as db:
            jobs = (await db.execute(select(AnalyticsDelivery))).scalars().all()
            assert len(jobs) == 9  # Five PostHog, four allowed Metrica events.
            assert not any(job.event_id in {'denied-event', 'before-grant', 'before-cutoff'} for job in jobs)
            assert not any(job.event_id == 'recovery:wallet' and job.destination == 'metrica' for job in jobs)
            for state in ('uploaded', 'uncertain', 'delivered'):
                job = await db.get(AnalyticsDelivery, state)
                assert (job.state, job.attempts, job.available_at, job.upload_id) == (
                    state,
                    4,
                    0 if state == 'uploaded' else 99,
                    'accepted',
                )
            identity = await db.get(AnalyticsIdentity, 'recovery')
            await core.purge_identity(db, identity)
            await db.commit()
        await core.repair_missing_deliveries()
        async with factory() as db:
            assert not (await db.execute(select(AnalyticsDelivery))).scalars().all()

    run_case(case)
