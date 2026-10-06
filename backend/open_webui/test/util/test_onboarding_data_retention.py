"""Real expiry boundaries preserve replay receipts, unresolved jobs and money."""

import asyncio
import time
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import HTTPException
from open_webui.internal.db import Base
from open_webui.models import email_delivery as queue
from open_webui.models import email_preferences as prefs
from open_webui.models.analytics import AnalyticsBinding, AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_observation_commands import EmailObservationCommand
from open_webui.models.email_observation_schema import (
    EmailDecisionEvent,
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.models.task_success import TaskSuccess
from open_webui.routers.airis import email_observation as routes
from open_webui.utils.airis import analytics
from open_webui.utils.airis import email_scope_report as report
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests
from test.util import test_email_observation_storage as store_tests

database = queue_tests.database
journal_db = store_tests.journal_db
DAY = 86400


@pytest_asyncio.fixture
async def retention_db(
    journal_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    tables = [
        AnalyticsIdentity.__table__,
        AnalyticsBinding.__table__,
        AnalyticsEvent.__table__,
        AnalyticsDelivery.__table__,
        EmailObservationCommand.__table__,
    ]
    async with journal_db() as db:
        connection = await db.connection()
        await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
        await db.commit()
    for module in (analytics, report):
        monkeypatch.setattr(module, 'get_async_db_context', prefs.get_async_db_context)
    yield journal_db
    async with journal_db() as db:
        connection = await db.connection()
        await connection.run_sync(lambda c: Base.metadata.drop_all(c, tables=tables))
        await db.commit()


async def snapshot(db: AsyncSession, model: type[Base]) -> list[dict[str, object]]:
    return [dict(row) for row in (await db.execute(select(model.__table__))).mappings()]


async def seed(db: async_sessionmaker[AsyncSession], now: int, offset: int) -> str:
    touch_time = now - 90 * DAY + offset
    job = await queue_tests.enqueue(db, 'topup_credited', 'retained-source')
    await queue_tests.payment_fact(db, 'payment', 'succeeded', now - 731 * DAY, credit=True)
    async with db() as session:
        attached = await session.get(queue.EmailDelivery, job)
        attached.status = 'accepted'
        attached.updated_at = now - 731 * DAY
        session.add(
            AnalyticsIdentity(
                id='identity',
                anonymous_id='browser',
                user_id='1',
                consent=True,
                granted_at=now - 731 * DAY,
                client_id='123',
                first_touch={'occurred_at': touch_time, 'utm_source': 'old'},
                last_touch={'occurred_at': now, 'utm_source': 'new'},
                lifetime={'first_response_received': touch_time},
            )
        )
        session.add(AnalyticsBinding(anonymous_id='browser', identity_id='identity'))
        for state in ('delivered', 'pending', 'uploaded', 'uncertain'):
            session.add(
                AnalyticsEvent(
                    id=state,
                    identity_id='identity',
                    event_name='billing_wallet_view',
                    occurred_at=touch_time,
                    properties={},
                )
            )
            session.add(
                AnalyticsDelivery(
                    id=state, event_id=state, destination='posthog', state=state, attempts=0, available_at=0
                )
            )
        for state in ('accepted', 'unknown', 'pending', 'claimed', 'retry', 'failed'):
            session.add(
                queue.EmailDelivery(
                    id='orphan-' + state,
                    user_id=None,
                    category='product',
                    type='welcome',
                    template_version='onboarding_v1',
                    scenario_key=state,
                    due_at=now - 40 * DAY,
                    expires_at=now - 35 * DAY,
                    status=state,
                    provider_id='<fixture-' + state + '@airis.you>',
                    retryable=state == 'failed',
                    created_at=now - 40 * DAY,
                    updated_at=now - 30 * DAY + offset,
                )
            )
        session.add(
            TaskSuccess(
                user_id='1',
                operation_id='success',
                kind='foreground_chat',
                source='saved_chat',
                completed_at=now - 731 * DAY,
            )
        )
        old = now - 731 * DAY
        session.add(
            EmailObservationScope(
                id='closed',
                rule_version='onboarding_v1',
                mode='observe',
                declared_at=old,
                observed_from=old,
                closed_at=now - 730 * DAY + offset,
                registrations_from=0,
                registrations_until=now,
                payments_from=0,
                payments_until=now,
                member_count=1,
            )
        )
        await session.flush()
        session.add(EmailObservationMember(id='member', scope_id='closed', ordinal=1, user_id='1', included_at=old))
        session.add(
            EmailObservationRun(
                id='run',
                scope_id='closed',
                started_at=old,
                finished_at=old + 1,
                upper_ordinal=1,
                cursor=1,
                scanned_members=1,
                scanned_scenarios=1,
                status='completed',
            )
        )
        await session.flush()
        session.add(
            EmailScenarioObservation(
                id='observation',
                member_id='member',
                type='welcome',
                category='product',
                scenario_key='onboarding_v1',
                rule_version='onboarding_v1',
                due_at=old,
                expires_at=old + 7 * DAY,
                first_observed_at=old,
                first_eligible_at=old,
                last_observed_at=old,
                reason='ready',
                revision=1,
            )
        )
        session.add(
            EmailObservationCommand(
                actor_id='1',
                request_key='receipt',
                request_hash='a' * 64,
                action='start',
                scope_id='closed',
                run_id='run',
                created_at=old,
            )
        )
        await session.flush()
        session.add(
            EmailDecisionEvent(
                id='decision',
                observation_id='observation',
                run_id='run',
                revision=1,
                observed_at=old,
                reason='ready',
            )
        )
        await session.commit()
    return job


@pytest.mark.asyncio
@pytest.mark.parametrize('offset', [-1, 0, 1])
async def test_exact_age_boundaries_and_repeat_preserve_sources(
    retention_db: async_sessionmaker[AsyncSession],
    offset: int,
) -> None:
    now = int(time.time())
    attached = await seed(retention_db, now, offset)
    async with retention_db() as db:
        money = {model.__tablename__: await snapshot(db, model) for model in (Payment, LedgerEntry)}
        receipts = await snapshot(db, EmailObservationCommand)
    await prefs.cleanup_product_email_records()
    await prefs.cleanup_product_email_records()
    expired = offset <= 0
    async with retention_db() as db:
        identity = await db.get(AnalyticsIdentity, 'identity')
        assert identity.first_touch == (
            {} if expired else {'occurred_at': now - 90 * DAY + offset, 'utm_source': 'old'}
        )
        assert identity.last_touch == {'occurred_at': now, 'utm_source': 'new'}
        assert identity.lifetime == {'first_response_received': now - 90 * DAY + offset}
        assert await db.get(AnalyticsBinding, 'browser')
        assert (await db.get(AnalyticsEvent, 'delivered') is None) == expired
        assert (await db.get(queue.EmailDelivery, 'orphan-accepted') is None) == expired
        assert (await db.get(EmailDecisionEvent, 'decision') is None) == expired
        assert (await db.get(EmailScenarioObservation, 'observation') is None) == expired
        assert (await db.get(EmailObservationMember, 'member') is None) == expired
        for state in ('pending', 'uploaded', 'uncertain'):
            assert await db.get(AnalyticsEvent, state)
            assert await db.get(AnalyticsDelivery, state)
        for state in ('unknown', 'pending', 'claimed', 'retry', 'failed'):
            assert await db.get(queue.EmailDelivery, 'orphan-' + state)
        assert await db.get(queue.EmailDelivery, attached)
        assert await snapshot(db, EmailObservationCommand) == receipts
        assert await db.get(TaskSuccess, ('1', 'success', 'foreground_chat'))
        assert {model.__tablename__: await snapshot(db, model) for model in (Payment, LedgerEntry)} == money
        assert await queue.enqueue_email(db, '1', 'topup_credited', 'retained-source', now, None) is None
    if expired:
        with pytest.raises(HTTPException) as error:
            await routes._operation(report.scope_mail_report('closed'))
        assert error.value.status_code == 410
        assert 'expired' in str(error.value.detail).lower()
    else:
        assert (await report.scope_mail_report('closed')).scope_id == 'closed'


@pytest.mark.asyncio
async def test_old_source_replay_and_parallel_cleanup_never_send(
    retention_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '1')
    monkeypatch.setenv('AIRIS_POSTHOG_KEY', 'fixture-only')
    monkeypatch.setenv('AIRIS_POSTHOG_HOST', 'https://fixture.invalid')
    calls = AsyncMock()
    monkeypatch.setattr(analytics, 'deliver_one', calls)
    await asyncio.gather(prefs.cleanup_product_email_records(), prefs.cleanup_product_email_records())
    await analytics.repair_missing_deliveries()
    assert not await analytics.record_account_event('1', 'payment_confirmed', 'old-payment', {}, now - 90 * DAY)
    async with retention_db() as db:
        identity = await db.get(AnalyticsIdentity, 'identity')
        assert not await analytics.add_event(db, identity, 'first_response_received', 'first', {}, now)
        assert await db.get(EmailObservationScope, 'closed')
        assert await db.get(EmailObservationRun, 'run')
        assert await snapshot(db, EmailObservationCommand)
        assert len(await snapshot(db, AnalyticsDelivery)) == 3
    assert calls.await_count == 0


@pytest.mark.asyncio
async def test_expired_report_is_unavailable_before_cleanup(
    retention_db: async_sessionmaker[AsyncSession],
) -> None:
    await seed(retention_db, int(time.time()), 0)
    with pytest.raises(HTTPException) as error:
        await routes._operation(report.scope_mail_report('closed'))
    assert error.value.status_code == 410
    async with retention_db() as db:
        assert await db.get(EmailScenarioObservation, 'observation')


@pytest.mark.asyncio
async def test_batch_ceiling_drains_without_cascading_unbounded_history(
    retention_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    async with retention_db() as db:
        await db.delete(await db.get(AnalyticsEvent, 'delivered'))
        await db.delete(await db.get(AnalyticsDelivery, 'delivered'))
        for i in range(1001):
            db.add(
                AnalyticsEvent(
                    id=f'event-{i:04}',
                    identity_id='identity',
                    event_name='billing_wallet_view',
                    occurred_at=now - 90 * DAY,
                    properties={},
                )
            )
            db.add(
                AnalyticsDelivery(
                    id=f'job-{i:04}',
                    event_id=f'event-{i:04}',
                    destination='posthog',
                    state='delivered',
                    attempts=0,
                    available_at=0,
                )
            )
        for i in range(1000):
            db.add(
                EmailDecisionEvent(
                    id=f'revision-{i:04}',
                    observation_id='observation',
                    run_id='run',
                    revision=i + 2,
                    observed_at=now - 731 * DAY,
                    reason='ready',
                )
            )
        await db.commit()
    await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert len(await snapshot(db, AnalyticsEvent)) == 4  # 1 terminal plus3 unresolved.
        assert len(await snapshot(db, AnalyticsDelivery)) == 4
        assert len(await snapshot(db, EmailDecisionEvent)) == 1
        assert await db.get(EmailScenarioObservation, 'observation')
        assert await db.get(EmailObservationMember, 'member')
    await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert len(await snapshot(db, AnalyticsEvent)) == 3
        assert len(await snapshot(db, AnalyticsDelivery)) == 3
        assert not await snapshot(db, EmailDecisionEvent)
        assert not await snapshot(db, EmailScenarioObservation)
        assert not await snapshot(db, EmailObservationMember)


@pytest.mark.asyncio
@pytest.mark.parametrize('open_scope', [True, False])
async def test_open_scope_or_running_run_is_not_age_deleted(
    retention_db: async_sessionmaker[AsyncSession],
    open_scope: bool,
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    async with retention_db() as db:
        if open_scope:
            (await db.get(EmailObservationScope, 'closed')).closed_at = None
        else:
            run = await db.get(EmailObservationRun, 'run')
            run.status = 'running'
            run.cursor = run.scanned_members = run.scanned_scenarios = 0
            run.finished_at = None
            run.claim_id = 'active'
            run.lease_until = now + 100
        await db.commit()
    await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert await db.get(EmailDecisionEvent, 'decision')
        assert await db.get(EmailScenarioObservation, 'observation')
        assert await db.get(EmailObservationMember, 'member')


@pytest.mark.asyncio
async def test_cleanup_failure_rolls_back_touch_and_history(
    retention_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from open_webui.utils.airis import data_retention
    from sqlalchemy.exc import SQLAlchemyError

    now = int(time.time())
    await seed(retention_db, now, 0)
    monkeypatch.setattr(data_retention, '_orphan_mail', AsyncMock(side_effect=SQLAlchemyError('fixture')))
    with pytest.raises(SQLAlchemyError):
        await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert (await db.get(AnalyticsIdentity, 'identity')).first_touch
        assert await db.get(AnalyticsEvent, 'delivered')
        assert await db.get(AnalyticsDelivery, 'delivered')
        assert await db.get(EmailDecisionEvent, 'decision')


@pytest.mark.asyncio
async def test_provider_payload_omits_expired_touch_before_cleanup(
    retention_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '1')
    monkeypatch.setenv('AIRIS_POSTHOG_KEY', 'fixture-only')
    monkeypatch.setenv('AIRIS_POSTHOG_HOST', 'https://fixture.invalid')
    requests = []

    def receive(request: httpx.Request) -> httpx.Response:
        import json

        requests.append(json.loads(request.content))
        return httpx.Response(200, json={'ok': True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
        await analytics.deliver_one('pending', client)
    assert len(requests) == 1
    assert 'first_utm_source' not in requests[0]['properties']
    assert requests[0]['properties']['last_utm_source'] == 'new'


@pytest.mark.asyncio
async def test_report_expiry_http_has_no_store_and_preserves_authorization(
    retention_db: async_sessionmaker[AsyncSession],
) -> None:
    from fastapi import FastAPI
    from open_webui.models.users import User, UserModel
    from open_webui.utils.auth import get_current_user

    await seed(retention_db, int(time.time()), 0)
    app = FastAPI()
    app.include_router(routes.router, prefix='/observations')
    async with retention_db() as db:
        account = UserModel.model_validate(await db.get(User, '1'), from_attributes=True)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        for role in ('user', 'admin'):
            app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': role})
            result = await client.get('/observations/closed/report')
            assert result.status_code == 410 if role == 'admin' else result.status_code in {401, 403}
            assert result.headers['cache-control'] == 'no-store'
            if role == 'admin':
                assert result.json() == {'detail': 'Observation history retention expired'}


@pytest.mark.asyncio
async def test_busy_identity_is_skipped_by_real_postgres_cleanup(
    retention_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    async with retention_db() as held:
        if held.get_bind().dialect.name != 'postgresql':
            pytest.skip('requires PostgreSQL row locks')
        await held.scalar(select(AnalyticsIdentity).where(AnalyticsIdentity.id == 'identity').with_for_update())
        await asyncio.wait_for(prefs.cleanup_product_email_records(), 2)
        assert (await held.get(AnalyticsIdentity, 'identity')).first_touch
        assert await held.get(AnalyticsEvent, 'delivered')
    await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert not (await db.get(AnalyticsIdentity, 'identity')).first_touch
        assert await db.get(AnalyticsEvent, 'delivered') is None


@pytest.mark.parametrize('offset', [-1, 0, 1])
def test_touch_admission_has_the_same_expiry_boundary(offset: int, monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.routers.airis_analytics import Touch
    from pydantic import ValidationError

    now = 2000000000
    monkeypatch.setattr(time, 'time', lambda: now)
    if offset <= 0:
        with pytest.raises(ValidationError):
            Touch(occurred_at=now - 90 * DAY + offset, utm_source='boundary')
    else:
        assert Touch(occurred_at=now - 90 * DAY + offset, utm_source='boundary')


@pytest.mark.asyncio
@pytest.mark.parametrize('offset', [-1, 0, 1])
async def test_deleted_operator_receipt_expires_without_erasing_live_operator_keys(
    retention_db: async_sessionmaker[AsyncSession],
    offset: int,
) -> None:
    now = int(time.time())
    await seed(retention_db, now, 0)
    async with retention_db() as db:
        db.add(
            EmailObservationCommand(
                actor_id='removed',
                request_key='orphan',
                request_hash='b' * 64,
                action='declare',
                scope_id='closed',
                created_at=now - 30 * DAY + offset,
            )
        )
        await db.commit()
    await prefs.cleanup_product_email_records()
    async with retention_db() as db:
        assert await db.scalar(select(EmailObservationCommand.id).where(EmailObservationCommand.actor_id == '1'))
        orphan = await db.scalar(
            select(EmailObservationCommand.id).where(EmailObservationCommand.actor_id == 'removed')
        )
        assert (orphan is None) == (offset <= 0)
