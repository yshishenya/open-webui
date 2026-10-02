"""Delivery replay, crash recovery, permission and capacity regression checks."""

import asyncio
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import aiosmtplib
import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from open_webui.internal.db import Base
from open_webui.models import auths, users
from open_webui.models import email_delivery as journal
from open_webui.models import email_preferences as prefs
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User, UserModel
from open_webui.routers.airis import email_delivery as routes
from open_webui.utils import email
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from open_webui.utils.auth import get_current_user
from sqlalchemy import func, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        os.getenv('EMAIL_DELIVERY_TEST_DATABASE_URL', f'sqlite+aiosqlite:///{tmp_path / "queue.db"}')
    )
    tables = [
        User.__table__,
        Auth.__table__,
        prefs.EmailPreference.__table__,
        prefs.EmailPreferenceEvent.__table__,
        prefs.EmailUnsubscribeToken.__table__,
        TaskSuccess.__table__,
        Payment.__table__,
        LedgerEntry.__table__,
        journal.EmailDelivery.__table__,
        journal.EmailTransportWindow.__table__,
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    factory = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def context(db: AsyncSession | None = None) -> AsyncIterator[AsyncSession]:
        if db is not None:
            yield db
        else:
            async with factory() as session:
                yield session

    for module in [journal, prefs, users, auths, worker, scenarios, routes]:
        monkeypatch.setattr(module, 'get_async_db_context', context)
    monkeypatch.setattr(scenarios, '_account_cursor', (0, ''))
    monkeypatch.setattr(scenarios, '_payment_cursor', (0, ''))
    monkeypatch.setattr(email, 'AIRIS_PRODUCT_EMAILS_ENABLED', True)
    monkeypatch.setattr(email, 'FRONTEND_URL', 'https://chat.airis.you')
    monkeypatch.setenv('FRONTEND_URL', 'https://chat.airis.you')
    async with factory() as session:
        now = int(time.time())
        for number in ['1', '2']:
            session.add(
                User(
                    id=number,
                    email=f'person{number}@airis.you',
                    name='Test',
                    role='user',
                    email_verified=True,
                    created_at=now - 3 * 86400,
                    updated_at=now,
                    last_active_at=now,
                )
            )
            session.add(Auth(id=number, email=f'person{number}@airis.you', password='unused', active=True))
        await session.commit()
    for number in ['1', '2']:
        await prefs.set_product_preference(number, True, 'settings')
    yield factory
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.drop_all(sync, tables=tables))
    await engine.dispose()


def config() -> scenarios.EmailQueueConfig:
    return scenarios.EmailQueueConfig(
        enabled=True,
        release_a=True,
        release_b=True,
        dry_run=False,
        pilot_only=True,
        pilot_user_ids=frozenset({'1'}),
        start_at=1,
        credited_start_at=1,
    )


def test_flags_are_default_off_and_release_b_does_not_leak_into_a() -> None:
    defaults = scenarios.EmailQueueConfig()
    assert not defaults.allows('1', 'welcome') and defaults.dry_run and defaults.pilot_only
    first_release = replace(config(), release_b=False)
    assert first_release.allows('1', 'welcome')
    assert not first_release.allows('1', 'topup_credited')
    assert not first_release.allows('2', 'welcome')
    assert not replace(first_release, pilot_user_ids=frozenset()).allows('1', 'welcome')


async def enqueue(
    factory: async_sessionmaker[AsyncSession], email_type: journal.EmailType = 'welcome', key: str = 'onboarding_v1'
) -> str:
    now = int(time.time())
    async with factory() as session:
        result = await journal.enqueue_email(
            session,
            '1',
            email_type,
            key,
            now,
            None if email_type == 'topup_credited' else now + 4 * 86400,
            payment_id=key if email_type == 'topup_credited' else None,
        )
        await session.commit()
        return result


async def state(factory: async_sessionmaker[AsyncSession], job_id: str) -> journal.DeliveryView:
    async with factory() as session:
        return journal.DeliveryView.model_validate(await session.get(journal.EmailDelivery, job_id))


@pytest.mark.asyncio
async def test_concurrent_replay_one_owner_and_restart(database: async_sessionmaker[AsyncSession]) -> None:
    ids = await asyncio.gather(*(enqueue(database) for _ in range(12)))
    assert sum(value is not None for value in ids) == 1
    jobs = await asyncio.gather(*(journal.claim_email(int(time.time())) for _ in range(2)))
    job = next(job for job in jobs if job is not None)
    assert sum(value is not None for value in jobs) == 1
    assert await journal.claim_email(int(time.time())) is None
    recovered = await journal.claim_email(int(time.time()) + journal.LEASE_SECONDS + 1)
    assert recovered.id == job.id and recovered.claim_id != job.claim_id
    assert await worker.prepare_email(job, config()) is None
    async with database() as db:
        assert await db.scalar(select(func.count()).select_from(journal.EmailDelivery)) == 1


@pytest.mark.asyncio
async def test_submitting_crash_is_unknown_and_never_retried(database: async_sessionmaker[AsyncSession]) -> None:
    job_id = await enqueue(database)
    now = int(time.time())
    job = await journal.claim_email(now)
    assert await worker.prepare_email(job, config())
    assert await worker.prepare_email(job, config(), 'person1@airis.you')
    assert await journal.claim_email(now + journal.LEASE_SECONDS + 1) is None
    result = await state(database, job_id)
    assert result.status == 'unknown' and result.submitted_at is not None
    assert not await journal.requeue_email(job_id, now)
    await journal.finish_email(job, 'accepted', False, now + 1)
    assert (await state(database, job_id)).status == 'accepted'
    assert not await journal.requeue_email(job_id, now)


@pytest.mark.asyncio
async def test_optional_frequency_and_unknown_reserve_window(database: async_sessionmaker[AsyncSession]) -> None:
    async with database() as db:
        db.add(
            TaskSuccess(
                user_id='1',
                operation_id='frequency-success',
                kind='foreground_chat',
                source='saved_chat',
                completed_at=int(time.time()),
            )
        )
        await db.commit()
    first_id = await enqueue(database)
    second_id = await enqueue(database, 'paid_value_72h')
    first = await journal.claim_email(int(time.time()))
    assert first.id in {first_id, second_id}
    # Both optional types are valid in this direct queue-frequency check.
    assert await worker.prepare_email(first, config())
    assert await worker.prepare_email(first, config(), 'person1@airis.you')
    await journal.finish_email(first, 'unknown', False, int(time.time()))
    second = await journal.claim_email(int(time.time()))
    assert await worker.prepare_email(second, config()) is None
    delayed = await state(database, second.id)
    assert delayed.reason == 'frequency' and delayed.status == 'pending'
    assert delayed.due_at >= int(time.time()) + 86400


@pytest.mark.asyncio
async def test_postgres_two_different_jobs_serialize_submission(database: async_sessionmaker[AsyncSession]) -> None:
    if not os.getenv('EMAIL_DELIVERY_TEST_DATABASE_URL', '').startswith('postgresql'):
        pytest.skip('Row locking requires production PostgreSQL')
    async with database() as db:
        db.add(
            TaskSuccess(
                user_id='1',
                operation_id='concurrent-success',
                kind='foreground_chat',
                source='saved_chat',
                completed_at=int(time.time()),
            )
        )
        await db.commit()
    await enqueue(database)
    await enqueue(database, 'paid_value_72h')
    jobs = [await journal.claim_email(int(time.time())), await journal.claim_email(int(time.time()))]
    assert all([await worker.prepare_email(job, config()) for job in jobs])
    results = await asyncio.gather(*(worker.prepare_email(job, config(), 'person1@airis.you') for job in jobs))
    assert sum(result is not None for result in results) == 1


@pytest.mark.asyncio
async def test_retry_delays_limit_and_permanent_failure(database: async_sessionmaker[AsyncSession]) -> None:
    job_id = await enqueue(database)
    # Extend expiry for all three configured retries.
    async with database() as db:
        await db.execute(
            update(journal.EmailDelivery)
            .where(journal.EmailDelivery.id == job_id)
            .values(expires_at=int(time.time()) + 100000)
        )
        await db.commit()
    now = int(time.time())
    for index in range(4):
        job = await journal.claim_email(now)
        async with database() as db:
            await db.execute(
                update(journal.EmailDelivery)
                .where(journal.EmailDelivery.id == job_id)
                .values(attempts=index + 1, submitted_at=now)
            )
            await db.commit()
        await journal.finish_email(job, 'failed', True, now)
        result = await state(database, job_id)
        assert result.submitted_at is None
        if index < 3:
            assert result.status == 'retry' and result.due_at == now + journal.RETRY_SECONDS[index]
            assert await journal.claim_email(now + 1) is None
            now = result.due_at
        else:
            assert result.status == 'failed' and await journal.requeue_email(job_id, now)
    job = await journal.claim_email(now)
    await journal.finish_email(job, 'failed', False, now)
    assert not await journal.requeue_email(job_id, now)


@pytest.mark.asyncio
async def test_optout_address_and_account_cancel_without_touching_service(
    database: async_sessionmaker[AsyncSession],
) -> None:
    product_id = await enqueue(database)
    service_id = await enqueue(database, 'topup_credited', 'payment')
    await prefs.set_product_preference('1', False, 'settings')
    assert (await state(database, product_id)).reason == 'consent'
    assert (await state(database, service_id)).status == 'pending'
    async with database() as db:
        await prefs.delete_product_preferences(db, '1')
        await db.commit()
    service = await state(database, service_id)
    assert service.status == 'suppressed' and service.reason == 'deleted_account' and service.user_id is None


@pytest.mark.asyncio
async def test_shared_capacity_preserves_service_headroom(database: async_sessionmaker[AsyncSession]) -> None:
    now = 120
    results = await asyncio.gather(*(journal.reserve_transport('shared', True, 5, 3, now) for _ in range(12)))
    assert sum(results) == 3
    assert await journal.reserve_transport('shared', False, 5, 3, now)
    assert await journal.reserve_transport('shared', False, 5, 3, now)
    assert not await journal.reserve_transport('shared', False, 5, 3, now)
    assert await journal.reserve_transport('shared', True, 5, 3, now + 60)
    assert not await journal.reserve_transport('zero-product', True, 1, 0, now)


@pytest.mark.asyncio
async def test_capacity_delay_does_not_exhaust_smtp_retries(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    job_id = await enqueue(database)
    service = email.EmailService()
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    service.from_email = 'sender@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'email_service', service)
    capacity = AsyncMock(return_value=False)
    monkeypatch.setattr(worker, 'take_transport_capacity', capacity)
    for _ in range(5):
        monkeypatch.setattr(worker.time, 'time', lambda: now)
        job = await journal.claim_email(now)
        await worker.execute_email(job, config())
        delayed = await state(database, job_id)
        assert delayed.status == 'pending' and delayed.reason == 'transport_capacity'
        assert delayed.attempts == 0 and delayed.submitted_at is None
        assert delayed.due_at == now + worker.POLL_SECONDS
        assert await journal.claim_email(now + 1) is None
        now = delayed.due_at
    smtp.send_message.assert_not_awaited()
    monkeypatch.setattr(worker.time, 'time', lambda: now)
    capacity.return_value = True
    await worker.execute_email(await journal.claim_email(now), config())
    final = await state(database, job_id)
    assert final.status == 'accepted' and final.attempts == 1
    smtp.send_message.assert_awaited_once()


@pytest.mark.asyncio
async def test_atomic_daily_and_minute_capacity_survives_cleanup_and_restart(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = 20000 * 86400 + 120
    monkeypatch.setenv('AIRIS_EMAIL_SMTP_PER_MINUTE', '5')
    monkeypatch.setenv('AIRIS_EMAIL_PRODUCT_PER_MINUTE', '3')
    monkeypatch.setenv('AIRIS_EMAIL_SMTP_PER_DAY', '7')
    monkeypatch.setenv('AIRIS_EMAIL_PRODUCT_PER_DAY', '4')
    monkeypatch.setattr(worker.time, 'time', lambda: now)
    results = await asyncio.gather(
        *(worker.take_transport_capacity('SMTP.invalid', 25, 'Test', True) for _ in range(12))
    )
    assert sum(results) == 3
    now += 60
    assert await worker.take_transport_capacity('smtp.invalid', 25, 'test', True)
    assert not await worker.take_transport_capacity('smtp.invalid', 25, 'test', True)
    results = await asyncio.gather(
        *(worker.take_transport_capacity('smtp.invalid', 25, 'test', False) for _ in range(10))
    )
    assert sum(results) == 3
    async with database() as db:
        rows = (await db.scalars(select(journal.EmailTransportWindow))).all()
        assert sum(row.total for row in rows if row.transport_key.endswith(':day')) == 7
        assert sum(row.total for row in rows if not row.transport_key.endswith(':day')) == 7
        assert sum(row.product for row in rows if row.transport_key.endswith(':day')) == 4
    # A fresh direct sender shares the persisted daily counter.
    service = email.EmailService()
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    service.from_email = 'sender@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    refused = await service.send_email_result('person1@airis.you', 'Service', '<p>Test</p>', retry_count=1)
    assert refused.reason == 'TransportCapacityUnavailable'
    smtp.send_message.assert_not_awaited()
    now = 20001 * 86400
    assert await worker.take_transport_capacity('smtp.invalid', 25, 'test', True)
    async with database() as db:
        days = (
            await db.scalars(
                select(journal.EmailTransportWindow).where(journal.EmailTransportWindow.transport_key.endswith(':day'))
            )
        ).all()
        assert {row.minute: row.total for row in days} == {20000: 7, 20001: 1}
    now = 20003 * 86400
    assert await worker.take_transport_capacity('smtp.invalid', 25, 'test', True)
    async with database() as db:
        days = (
            await db.scalars(
                select(journal.EmailTransportWindow).where(journal.EmailTransportWindow.transport_key.endswith(':day'))
            )
        ).all()
        assert {row.minute: row.total for row in days} == {20003: 1}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'change', [{'claim_id': 'another-owner'}, {'status': 'unknown'}, {'status': 'accepted'}, {'submitted_at': 1}]
)
async def test_capacity_deferral_rejects_stale_or_submitted_jobs(
    database: async_sessionmaker[AsyncSession], change: dict[str, object]
) -> None:
    job_id = await enqueue(database)
    now = int(time.time())
    job = await journal.claim_email(now)
    assert await worker.prepare_email(job, config())
    async with database() as db:
        await db.execute(update(journal.EmailDelivery).where(journal.EmailDelivery.id == job_id).values(**change))
        await db.commit()
    before = await state(database, job_id)
    await journal.defer_email_capacity(job, now)
    assert await state(database, job_id) == before


@pytest.mark.asyncio
async def test_capacity_deferral_respects_expiry_and_consent(database: async_sessionmaker[AsyncSession]) -> None:
    job_id = await enqueue(database)
    now = int(time.time())
    job = await journal.claim_email(now)
    assert await worker.prepare_email(job, config())
    await journal.defer_email_capacity(job, now)
    await prefs.set_product_preference('1', False, 'settings')
    assert (await state(database, job_id)).status == 'suppressed'
    assert await journal.claim_email(now + worker.POLL_SECONDS) is None
    await prefs.set_product_preference('1', True, 'settings')
    job_id = await enqueue(database, key='expires-before-capacity')
    job = await journal.claim_email(now)
    assert await worker.prepare_email(job, config())
    async with database() as db:
        await db.execute(
            update(journal.EmailDelivery).where(journal.EmailDelivery.id == job_id).values(expires_at=now + 1)
        )
        await db.commit()
    await journal.defer_email_capacity(job, now)
    expired = await state(database, job_id)
    assert expired.status == 'expired' and expired.attempts == 0


@pytest.mark.asyncio
async def test_daily_zero_product_budget_and_invalid_config_fail_closed(
    database: async_sessionmaker[AsyncSession],
) -> None:
    assert not await journal.reserve_transport('zero-day', True, 5, 3, 120, 7, 0)
    assert await journal.reserve_transport('zero-day', False, 5, 3, 120, 7, 0)
    with pytest.raises(ValueError):
        await journal.reserve_transport('invalid-day', False, 5, 3, 120, 7, 7)
    async with database() as db:
        rows = (await db.scalars(select(journal.EmailTransportWindow))).all()
        assert len(rows) == 2 and all(row.total == 1 and row.product == 0 for row in rows)


@pytest.mark.asyncio
async def test_reconciliation_dry_run_pilot_and_missing_jobs(database: async_sessionmaker[AsyncSession]) -> None:
    assert await scenarios.reconcile_email_candidates(replace(config(), dry_run=True)) == 4
    async with database() as db:
        assert await db.scalar(select(func.count()).select_from(journal.EmailDelivery)) == 0
    assert await scenarios.reconcile_email_candidates(config()) == 4
    await scenarios.reconcile_email_candidates(config())
    async with database() as db:
        rows = (await db.scalars(select(journal.EmailDelivery))).all()
        assert len(rows) == 4 and {row.user_id for row in rows} == {'1'}
        columns = set(journal.EmailDelivery.__table__.columns.keys())
        assert not columns.intersection({'email', 'body', 'token', 'chat', 'amount', 'raw_payload_json'})
    assert await scenarios.reconcile_email_candidates(replace(config(), enabled=False)) == 0


@pytest.mark.asyncio
async def test_smtp_unknown_and_optout_between_auth_and_data(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = await enqueue(database)
    service = email.EmailService()
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    service.from_email = 'sender@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'email_service', service)
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPReadTimeoutError('private address/password')
    await worker.execute_email(await journal.claim_email(int(time.time())), config())
    assert (await state(database, job_id)).status == 'unknown'
    smtp.send_message.assert_awaited_once()
    # A new account job exercises cancellation in the final check.
    async with database() as db:
        second_id = await journal.enqueue_email(
            db, '2', 'welcome', 'onboarding_v1', int(time.time()), int(time.time()) + 86400
        )
        await db.commit()

    async def connect_then_opt_out() -> AsyncMock:
        await prefs.set_product_preference('2', False, 'settings')
        return smtp

    service._create_connection = connect_then_opt_out
    smtp.reset_mock()
    await worker.execute_email(
        await journal.claim_email(int(time.time())), replace(config(), pilot_user_ids=frozenset({'2'}))
    )
    smtp.send_message.assert_not_awaited()
    assert (await state(database, second_id)).reason == 'consent'


@pytest.mark.asyncio
async def test_admin_report_and_unknown_retry_are_restricted(database: async_sessionmaker[AsyncSession]) -> None:
    await enqueue(database)
    app = FastAPI()
    app.include_router(routes.router, prefix='/deliveries')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/deliveries')).status_code in {401, 403}
        async with database() as db:
            account = UserModel.model_validate(await db.get(User, '1'), from_attributes=True)
        app.dependency_overrides[get_current_user] = lambda: account
        assert (await client.get('/deliveries')).status_code in {401, 403}
        app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': 'admin'})
        response = await client.get('/deliveries')
        assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
        assert response.json()['total'] == 1 and 'person1@airis.you' not in response.text
        assert (await client.post('/deliveries/missing/retry')).status_code == 409


@pytest.mark.asyncio
async def test_scheduler_gate_does_not_block_other_background_work(monkeypatch: pytest.MonkeyPatch) -> None:
    waiting = asyncio.Event()
    started = asyncio.Event()

    async def slow_worker(settings: scenarios.EmailQueueConfig) -> None:
        started.set()
        await waiting.wait()

    monkeypatch.setattr(worker, '_worker_task', None)
    monkeypatch.setattr(worker, 'drain_email_queue', slow_worker)
    monkeypatch.setattr(scenarios.EmailQueueConfig, 'from_env', config)
    assert await worker.process_email_queue_if_due(0, 100) == 400
    await asyncio.wait_for(started.wait(), timeout=1)
    running = worker._worker_task
    await worker.process_email_queue_if_due(0, 101)
    assert worker._worker_task is running
    waiting.set()
    await running


async def payment_fact(
    factory: async_sessionmaker[AsyncSession], payment_id: str, status: str, created_at: int, credit: bool = False
) -> None:
    """Controlled source facts in an isolated DB; no provider request or real money."""
    async with factory() as db:
        db.add(
            Payment(
                id=payment_id,
                provider='yookassa',
                provider_payment_id=f'provider-{payment_id}',
                kind='topup',
                status=status,
                status_details={'yookassa_status': status},
                amount_kopeks=10000,
                currency='RUB',
                user_id='1',
                wallet_id='wallet-1',
                created_at=created_at,
                updated_at=created_at,
            )
        )
        if credit:
            db.add(
                LedgerEntry(
                    id=f'credit-{payment_id}',
                    user_id='1',
                    wallet_id='wallet-1',
                    currency='RUB',
                    type='topup',
                    amount_kopeks=10000,
                    balance_included_after=0,
                    balance_topup_after=10000,
                    reference_type='payment',
                    reference_id=f'provider-{payment_id}',
                    created_at=created_at,
                )
            )
        await db.commit()


@pytest.mark.asyncio
async def test_credited_notice_requires_both_facts_and_has_no_marketing_expiry(
    database: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await payment_fact(database, 'only-provider', 'succeeded', now - 10 * 86400)
    await scenarios.reconcile_email_candidates(config())
    async with database() as db:
        assert not await db.scalar(
            select(journal.EmailDelivery.id).where(journal.EmailDelivery.type == 'topup_credited')
        )
    await payment_fact(database, 'applied-credit', 'succeeded', now - 10 * 86400, credit=True)
    await scenarios.reconcile_email_candidates(config())
    await scenarios.reconcile_email_candidates(config())
    async with database() as db:
        service = (
            await db.scalars(select(journal.EmailDelivery).where(journal.EmailDelivery.type == 'topup_credited'))
        ).one()
        assert service.payment_id == 'applied-credit' and service.expires_at is None
    claimed = await journal.claim_email(now)
    assert claimed.id == service.id  # Service precedes older optional work.
    assert await worker.prepare_email(claimed, config())
    async with database() as db:
        await db.execute(update(Payment).where(Payment.id == 'applied-credit').values(status='pending'))
        await db.commit()
    assert await worker.prepare_email(claimed, config(), 'person1@airis.you') is None
    assert (await state(database, service.id)).reason == 'credit_unconfirmed'


@pytest.mark.asyncio
async def test_help_reconstructs_old_accounts_uses_latest_attempt_and_blocks_unresolved(
    database: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    async with database() as db:
        await db.execute(update(User).where(User.id == '1').values(created_at=now - 60 * 86400))
        await db.commit()
    await payment_fact(database, 'older-failure', 'canceled', now - 4 * 86400)
    await payment_fact(database, 'latest-failure', 'canceled', now - 3 * 86400)
    assert await scenarios.reconcile_email_candidates(config()) == 1
    async with database() as db:
        job = (await db.scalars(select(journal.EmailDelivery))).one()
        assert job.type == 'payment_help_72h' and job.payment_id == 'latest-failure'
    await payment_fact(database, 'currently-checking', 'pending', now - 100)
    claimed = await journal.claim_email(now)
    assert await worker.prepare_email(claimed, config()) is None
    assert (await state(database, job.id)).reason == 'payment_priority'


@pytest.mark.asyncio
async def test_activation_waits_for_welcome_plus_day_and_stops_after_success(
    database: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    welcome_id = await enqueue(database)
    async with database() as db:
        await db.execute(
            update(journal.EmailDelivery)
            .where(journal.EmailDelivery.id == welcome_id)
            .values(status='accepted', accepted_at=now, submitted_at=now - 10)
        )
        await db.commit()
    activation_id = await enqueue(database, 'activation_24h')
    job = await journal.claim_email(now)
    assert await worker.prepare_email(job, config()) is None
    delayed = await state(database, activation_id)
    assert delayed.due_at == now + 86400 and delayed.reason == 'welcome_window'
    async with database() as db:
        db.add(
            TaskSuccess(
                user_id='1',
                operation_id='real-foreground-fact',
                kind='foreground_chat',
                source='saved_chat',
                completed_at=now,
            )
        )
        await db.execute(
            update(journal.EmailDelivery).where(journal.EmailDelivery.id == activation_id).values(due_at=now)
        )
        await db.commit()
    assert await worker.prepare_email(await journal.claim_email(now), config()) is None
    assert (await state(database, activation_id)).reason == 'activation'


@pytest.mark.asyncio
@pytest.mark.parametrize('change', [{'role': 'admin'}, {'email_verified': False}, {'email': 'technical@vk.local'}])
async def test_final_check_rejects_account_and_address_changes(
    database: async_sessionmaker[AsyncSession], change: dict[str, object]
) -> None:
    job_id = await enqueue(database)
    job = await journal.claim_email(int(time.time()))
    async with database() as db:
        await db.execute(update(User).where(User.id == '1').values(**change))
        await db.commit()
    assert await worker.prepare_email(job, config()) is None
    assert (await state(database, job_id)).status == 'suppressed'


@pytest.mark.asyncio
async def test_welcome_callback_enqueues_once_never_sends_and_does_not_catch_up_old_accounts(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scenarios.EmailQueueConfig, 'from_env', config)
    results = await asyncio.gather(*(email.EmailService().send_welcome_email('1') for _ in range(12)))
    assert sum(results) == 1
    async with database() as db:
        row = (await db.scalars(select(journal.EmailDelivery))).one()
        assert row.status == 'pending' and row.attempts == 0 and row.submitted_at is None
        await db.execute(update(User).where(User.id == '2').values(created_at=int(time.time()) - 10 * 86400))
        await db.commit()
    assert not await email.EmailService().send_welcome_email('2')


@pytest.mark.asyncio
async def test_direct_service_calls_share_the_same_smtp_capacity(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_now = int(time.time())
    monkeypatch.setattr(worker.time, 'time', lambda: fixed_now)
    monkeypatch.setenv('AIRIS_EMAIL_SMTP_PER_MINUTE', '2')
    monkeypatch.setenv('AIRIS_EMAIL_PRODUCT_PER_MINUTE', '1')
    service = email.EmailService()
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    service.from_email = 'sender@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    assert (await service.send_product_email('1', 'Test', '<p>Test</p>', 'Test', retry_count=1)).status == 'accepted'
    assert (
        await service.send_email_result('person1@airis.you', 'Service', '<p>Test</p>', retry_count=1)
    ).status == 'accepted'
    exhausted = await service.send_email_result('person1@airis.you', 'Service', '<p>Test</p>', retry_count=1)
    assert exhausted.status == 'failed' and exhausted.retryable
    assert smtp.send_message.await_count == 2


@pytest.mark.asyncio
async def test_account_address_hook_and_complaint_cancel_waiting_jobs(
    database: async_sessionmaker[AsyncSession],
) -> None:
    job_id = await enqueue(database)
    await users.Users.update_user_by_id('1', {'email': 'changed@airis.you'})
    assert (await state(database, job_id)).reason == 'invalid_address'
    async with database() as db:
        second_id = await journal.enqueue_email(
            db, '2', 'welcome', 'onboarding_v1', int(time.time()), int(time.time()) + 86400
        )
        await db.commit()
    await prefs.suppress_product_address('person2@airis.you', 'complaint')
    assert (await state(database, second_id)).status == 'suppressed'


@pytest.mark.asyncio
async def test_expiry_and_disabled_release_do_not_attempt_smtp(database: async_sessionmaker[AsyncSession]) -> None:
    job_id = await enqueue(database)
    now = int(time.time())
    async with database() as db:
        await db.execute(update(journal.EmailDelivery).where(journal.EmailDelivery.id == job_id).values(expires_at=now))
        await db.commit()
    assert await journal.claim_email(now) is None
    assert (await state(database, job_id)).status == 'expired'
    held_id = await enqueue(database, 'welcome', 'another-source')
    assert await worker.prepare_email(await journal.claim_email(now), replace(config(), release_a=False)) is None
    held = await state(database, held_id)
    assert held.status == 'pending' and held.reason == 'release_disabled' and held.attempts == 0


@pytest.mark.asyncio
async def test_expiry_during_permission_check_is_rechecked_before_submission(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    job_id = await enqueue(database)
    job = await journal.claim_email(now)
    async with database() as db:
        await db.execute(
            update(journal.EmailDelivery).where(journal.EmailDelivery.id == job_id).values(expires_at=now + 10)
        )
        await db.commit()
    decision = worker.permission_decision

    async def delayed_permission(
        session: AsyncSession,
        user: User | None,
        item: journal.DeliveryView,
        settings: scenarios.EmailQueueConfig,
        expected: str | None,
        when: int,
    ) -> scenarios.ScenarioDecision:
        result = await decision(session, user, item, settings, expected, when)
        monkeypatch.setattr(worker.time, 'time', lambda: now + 11)
        return result

    monkeypatch.setattr(worker, 'permission_decision', delayed_permission)
    assert await worker.prepare_email(job, config()) is None
    assert (await state(database, job_id)).status == 'expired'


@pytest.mark.asyncio
async def test_database_outage_before_data_and_after_acceptance_do_not_duplicate(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = await enqueue(database)
    service = email.EmailService()
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    service.from_email = 'sender@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'email_service', service)
    broken = OperationalError('private SQL', {}, Exception('private values'))
    real_capacity = worker.take_transport_capacity
    monkeypatch.setattr(worker, 'take_transport_capacity', AsyncMock(side_effect=broken))
    await worker.execute_email(await journal.claim_email(int(time.time())), config())
    smtp.send_message.assert_not_awaited()
    result = await state(database, job_id)
    assert result.status == 'pending' and result.reason == 'transport_capacity' and result.submitted_at is None
    assert result.attempts == 0
    monkeypatch.setattr(worker, 'take_transport_capacity', real_capacity)
    async with database() as db:
        await db.execute(
            update(journal.EmailDelivery).where(journal.EmailDelivery.id == job_id).values(due_at=int(time.time()))
        )
        await db.commit()
    job = await journal.claim_email(int(time.time()))
    monkeypatch.setattr(worker, 'finish_email', AsyncMock(side_effect=broken))
    with pytest.raises(OperationalError):
        await worker.execute_email(job, config())
    smtp.send_message.assert_awaited_once()
    assert (await state(database, job_id)).submitted_at is not None
    assert await journal.claim_email(int(time.time()) + journal.LEASE_SECONDS + 1) is None
    assert (await state(database, job_id)).status == 'unknown'
    assert not await journal.requeue_email(job_id, int(time.time()))
