"""Common account deletion, rollback and real PostgreSQL lock boundaries."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import HTTPException
from open_webui.internal.db import Base
from open_webui.models import chats, groups, users
from open_webui.models.analytics import AnalyticsBinding, AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
from open_webui.models.billing_wallet import LedgerEntry, Payment, Wallet
from open_webui.routers import airis_analytics as routes
from open_webui.utils.airis import analytics as core
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests

queue_database = queue_tests.database


@pytest_asyncio.fixture
async def database(
    queue_database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    tables = [
        AnalyticsIdentity.__table__,
        AnalyticsBinding.__table__,
        AnalyticsEvent.__table__,
        AnalyticsDelivery.__table__,
        Wallet.__table__,
    ]
    async with queue_database() as session:
        conn = await session.connection()
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        await session.commit()
    for module in [routes, core]:
        monkeypatch.setattr(module, 'get_async_db_context', users.get_async_db_context)
    monkeypatch.setattr(groups.Groups, 'remove_user_from_all_groups', AsyncMock())
    monkeypatch.setattr(chats.Chats, 'delete_chats_by_user_id', AsyncMock(return_value=True))
    monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '1')
    monkeypatch.setenv('AIRIS_POSTHOG_KEY', 'fixture-only')
    monkeypatch.setenv('AIRIS_POSTHOG_HOST', 'https://analytics.invalid')
    for account in ['1', '2']:
        user = await users.Users.get_user_by_id(account)
        assert user is not None
        await routes.set_context(routes.ContextForm(consent='granted', anonymous_id=uuid.uuid4()), user)
        assert await core.record_account_event(account, 'billing_wallet_view', 'fixture-view', {})
    yield queue_database
    async with queue_database() as session:
        conn = await session.connection()
        await conn.run_sync(lambda sync: Base.metadata.drop_all(sync, tables=tables))
        await session.commit()


async def rows(session: AsyncSession, model: type[Base]) -> list[dict[str, object]]:
    return [dict(row) for row in (await session.execute(select(model.__table__))).mappings()]


@pytest.mark.asyncio
async def test_stale_authenticated_context_cannot_link_a_disappeared_account(
    database: async_sessionmaker[AsyncSession],
) -> None:
    user = await users.Users.get_user_by_id('1')
    assert user is not None
    async with database() as session:
        await session.delete(await session.get(users.User, '1'))
        await session.commit()
        before = await rows(session, AnalyticsBinding)
    with pytest.raises(HTTPException) as error:
        await routes.set_context(routes.ContextForm(consent='granted', anonymous_id=uuid.uuid4()), user)
    assert error.value.status_code == 401
    async with database() as session:
        assert await rows(session, AnalyticsBinding) == before


@pytest.mark.asyncio
async def test_common_delete_removes_only_account_analytics_and_rejects_stale_context(
    database: async_sessionmaker[AsyncSession],
) -> None:
    user = await users.Users.get_user_by_id('1')
    assert user is not None
    stale = routes.ContextForm(consent='granted', anonymous_id=uuid.uuid4())
    await routes.set_context(stale, user)
    async with database() as session:
        session.add(
            Wallet(id='wallet', user_id='1', currency='RUB', balance_topup_kopeks=50123, created_at=1, updated_at=1)
        )
        session.add(
            Payment(
                id='payment',
                provider='fixture',
                status='succeeded',
                kind='topup',
                amount_kopeks=50123,
                currency='RUB',
                user_id='1',
                created_at=1,
                updated_at=1,
            )
        )
        session.add(
            LedgerEntry(
                id='ledger',
                user_id='1',
                wallet_id='wallet',
                currency='RUB',
                type='topup',
                amount_kopeks=50123,
                balance_included_after=0,
                balance_topup_after=50123,
                created_at=1,
            )
        )
        await session.commit()
        financial = [await rows(session, model) for model in [Wallet, Payment, LedgerEntry]]
        other_identity = await session.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.user_id == '2'))
        other_events = await rows(session, AnalyticsEvent)
        other_events = [row for row in other_events if row['identity_id'] == other_identity]
        jobs = list(await session.scalars(select(AnalyticsDelivery.id)))
    assert await users.Users.delete_user_by_id('1')
    assert await users.Users.delete_user_by_id('1')
    async with database() as session:
        assert await session.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.user_id == '1')) is None
        assert await session.scalar(select(func.count()).select_from(AnalyticsIdentity)) == 1
        assert (await rows(session, AnalyticsEvent)) == other_events
        assert await session.scalar(select(func.count()).select_from(AnalyticsBinding)) == 1
        assert [await rows(session, model) for model in [Wallet, Payment, LedgerEntry]] == financial
    assert not await core.record_account_event('1', 'billing_wallet_view', 'late', {})
    with pytest.raises(HTTPException) as error:
        await routes.set_context(stale, user)
    assert error.value.status_code == 401
    calls: list[httpx.Request] = []

    def reject(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(reject)) as client:
        # The remaining other account may send; the deleted account's saved IDs may not.
        async with database() as session:
            remaining = set(await session.scalars(select(AnalyticsDelivery.id)))
        for job in jobs:
            if job not in remaining:
                await core.deliver_one(job, client)
    assert calls == []


@pytest.mark.asyncio
async def test_failed_analytics_purge_rolls_back_common_account_deletion(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = core.purge_identity

    async def fail(session: AsyncSession, identity: AnalyticsIdentity) -> None:
        await original(session, identity)
        raise SQLAlchemyError('fixture failure after purge')

    monkeypatch.setattr(core, 'purge_identity', fail)
    async with database() as session:
        before = [
            await rows(session, model)
            for model in [users.User, AnalyticsIdentity, AnalyticsEvent, AnalyticsDelivery, AnalyticsBinding]
        ]
    with pytest.raises(SQLAlchemyError):
        await users.Users.delete_user_by_id('1')
    async with database() as session:
        assert [
            await rows(session, model)
            for model in [users.User, AnalyticsIdentity, AnalyticsEvent, AnalyticsDelivery, AnalyticsBinding]
        ] == before


@pytest.mark.asyncio
async def test_worker_skips_locked_identity_without_holding_delivery(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as owner:
        if owner.get_bind().dialect.name != 'postgresql':
            pytest.skip('Independent PostgreSQL row locks required')
        identity = await owner.scalar(
            select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == '1').with_for_update()
        )
        job = await owner.scalar(
            select(AnalyticsDelivery.id)
            .join(AnalyticsEvent, AnalyticsEvent.id == AnalyticsDelivery.event_id)
            .where(AnalyticsEvent.identity_id == identity.id)
        )
        calls: list[httpx.Request] = []

        def reject(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            return httpx.Response(200)

        async with httpx.AsyncClient(transport=httpx.MockTransport(reject)) as client:
            await asyncio.wait_for(core.deliver_one(job, client), timeout=2)
        # A third connection can still own the job; the skipped worker held no lock.
        async with database() as observer:
            assert (
                await observer.scalar(
                    select(AnalyticsDelivery.id).where(AnalyticsDelivery.id == job).with_for_update(skip_locked=True)
                )
                == job
            )
        assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize('delete_account', [False, True])
async def test_inflight_send_serializes_workers_and_account_deletion(
    database: async_sessionmaker[AsyncSession],
    delete_account: bool,
) -> None:
    async with database() as session:
        if session.get_bind().dialect.name != 'postgresql':
            pytest.skip('Independent PostgreSQL row locks required')
        identity_id = await session.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.user_id == '1'))
        job = await session.scalar(
            select(AnalyticsDelivery.id)
            .join(AnalyticsEvent, AnalyticsEvent.id == AnalyticsDelivery.event_id)
            .where(AnalyticsEvent.identity_id == identity_id)
        )
    started, finish = asyncio.Event(), asyncio.Event()
    calls: list[httpx.Request] = []

    async def send(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        started.set()
        await finish.wait()
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(send)) as client:
        worker = asyncio.create_task(core.deliver_one(job, client))
        deletion = None
        try:
            await asyncio.wait_for(started.wait(), 2)
            await asyncio.wait_for(core.deliver_one(job, client), 2)
            assert len(calls) == 1
            if delete_account:
                deletion = asyncio.create_task(users.Users.delete_user_by_id('1'))
                with pytest.raises(TimeoutError):
                    await asyncio.wait_for(asyncio.shield(deletion), 0.15)
            finish.set()
            await asyncio.wait_for(worker, 2)
            if deletion is not None:
                assert await asyncio.wait_for(deletion, 2)
            await core.deliver_one(job, client)
            assert len(calls) == 1
        finally:
            finish.set()
            for task in [worker, deletion]:
                if task is not None and not task.done():
                    task.cancel()
            await asyncio.gather(*[task for task in [worker, deletion] if task is not None], return_exceptions=True)
    async with database() as session:
        if delete_account:
            assert await session.get(users.User, '1') is None
            assert await session.get(AnalyticsIdentity, identity_id) is None
            assert await session.get(AnalyticsDelivery, job) is None
        else:
            assert (await session.get(AnalyticsDelivery, job)).state == 'delivered'


@pytest.mark.asyncio
async def test_metrica_reacquires_identity_before_delivery_after_ambiguous_marker(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with database() as session:
        if session.get_bind().dialect.name != 'postgresql':
            pytest.skip('Independent PostgreSQL row locks required')
        identity = await session.scalar(select(AnalyticsIdentity).where(AnalyticsIdentity.user_id == '1'))
        identity.client_id = '123456'
        event = await session.scalar(select(AnalyticsEvent).where(AnalyticsEvent.identity_id == identity.id))
        event.event_name = 'signup_completed'
        job = await session.scalar(select(AnalyticsDelivery).where(AnalyticsDelivery.event_id == event.id))
        job.destination = 'metrica'
        identity_id, job_id = identity.id, job.id
        await session.commit()
    monkeypatch.setenv('AIRIS_METRICA_OAUTH_TOKEN', 'fixture-only')
    monkeypatch.setenv('AIRIS_METRICA_COUNTER_ID', '123')
    committed, resume = asyncio.Event(), asyncio.Event()
    original_commit = AsyncSession.commit

    async def commit_and_pause(session: AsyncSession) -> None:
        await original_commit(session)
        if not committed.is_set():
            committed.set()
            await resume.wait()

    monkeypatch.setattr(AsyncSession, 'commit', commit_and_pause)
    calls: list[httpx.Request] = []

    def send(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={'uploading': {'id': 'fixture-upload'}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(send)) as client:
        worker = asyncio.create_task(core.deliver_one(job_id, client))
        try:
            await asyncio.wait_for(committed.wait(), 2)
            async with database() as owner:
                assert (
                    await owner.scalar(
                        select(AnalyticsIdentity.id).where(AnalyticsIdentity.id == identity_id).with_for_update()
                    )
                    == identity_id
                )
                resume.set()
                await asyncio.wait_for(worker, 2)
                async with database() as observer:
                    assert (
                        await observer.scalar(
                            select(AnalyticsDelivery.id)
                            .where(AnalyticsDelivery.id == job_id)
                            .with_for_update(skip_locked=True)
                        )
                        == job_id
                    )
                assert calls == []
        finally:
            resume.set()
            if not worker.done():
                worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)


@pytest.mark.asyncio
async def test_changed_event_owner_is_retried_without_sending_stale_identity(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with database() as session:
        identity_id = await session.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.user_id == '1'))
        next_owner = await session.scalar(select(AnalyticsIdentity.id).where(AnalyticsIdentity.user_id == '2'))
        event_id = await session.scalar(select(AnalyticsEvent.id).where(AnalyticsEvent.identity_id == identity_id))
        job_id = await session.scalar(select(AnalyticsDelivery.id).where(AnalyticsDelivery.event_id == event_id))
    original_scalar = AsyncSession.scalar
    changed = False

    async def scalar(session: AsyncSession, statement: object, *args: object, **kwargs: object) -> object:
        nonlocal changed
        value = await original_scalar(session, statement, *args, **kwargs)
        if not changed and value == identity_id:
            changed = True
            async with database() as merger:
                event = await merger.get(AnalyticsEvent, event_id)
                event.identity_id = next_owner
                await merger.commit()
        return value

    monkeypatch.setattr(AsyncSession, 'scalar', scalar)
    calls: list[httpx.Request] = []

    def send(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(send)) as client:
        await core.deliver_one(job_id, client)
        assert calls == []
        async with database() as session:
            assert (await session.get(AnalyticsDelivery, job_id)).state == 'pending'
        await core.deliver_one(job_id, client)
    assert len(calls) == 1
    assert json.loads(calls[0].content)['distinct_id'] == next_owner
