"""Observe declared people and authoritative facts without transport or money mutations."""

import asyncio
import json
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from open_webui.models import email_observation as store
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import EmailDelivery
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils import email
from open_webui.utils.airis import email_dispatch, email_scenarios
from open_webui.utils.airis import email_observer as observer
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests
from test.util import test_email_observation_storage as storage_tests

database = storage_tests.database
journal_db = storage_tests.journal_db
DAY = email_scenarios.DAY


@pytest_asyncio.fixture
async def observed_db(
    journal_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    @asynccontextmanager
    async def context(db: AsyncSession | None = None) -> AsyncIterator[AsyncSession]:
        if db is not None:
            yield db
        else:
            async with journal_db() as session:
                yield session

    monkeypatch.setattr(observer, 'get_async_db_context', context)
    for name in ['AIRIS_EMAIL_QUEUE_ENABLED', 'AIRIS_EMAIL_RELEASE_A_ENABLED', 'AIRIS_EMAIL_RELEASE_B_ENABLED']:
        monkeypatch.setenv(name, 'false')
    monkeypatch.setenv('AIRIS_EMAIL_DRY_RUN', 'true')
    monkeypatch.setenv('AIRIS_EMAIL_PILOT_USER_IDS', '')
    yield journal_db


async def scope(factory: async_sessionmaker[AsyncSession], now: int, ids: tuple[str, ...] = ('1',)) -> str:
    async with factory() as session:
        result = await store.declare_scope(
            session,
            ids,
            now,
            registrations_from=0,
            registrations_until=now + 1,
            payments_from=0,
            payments_until=now + 30 * DAY,
        )
        await session.commit()
        return result


async def rows(factory: async_sessionmaker[AsyncSession]) -> dict[tuple[str, str], store.EmailScenarioObservation]:
    async with factory() as session:
        return {
            (row.type, row.scenario_key): row for row in await session.scalars(select(store.EmailScenarioObservation))
        }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'kind,age',
    [
        ('welcome', 0),
        ('activation_24h', 3),
        ('paid_value_72h', 3),
        ('feedback_14d', 14),
        ('topup_credited', 3),
        ('payment_help_72h', 3),
    ],
)
async def test_six_independent_ready_cases_with_all_transport_switches_off(
    observed_db: async_sessionmaker[AsyncSession], kind: str, age: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now - age * DAY))
        if kind == 'paid_value_72h':
            session.add(
                TaskSuccess(
                    user_id='1', operation_id='success', kind='foreground_chat', source='saved_chat', completed_at=now
                )
            )
        await session.commit()
    if kind == 'activation_24h':
        job_id = await queue_tests.enqueue(observed_db, 'welcome')
        async with observed_db() as session:
            await session.execute(
                update(EmailDelivery)
                .where(EmailDelivery.id == job_id)
                .values(status='accepted', submitted_at=now - 2 * DAY, accepted_at=now - 2 * DAY)
            )
            await session.commit()
    if kind in observer.PAYMENT_TYPES:
        await queue_tests.payment_fact(
            observed_db,
            'payment',
            'succeeded' if kind == 'topup_credited' else 'canceled',
            now - 3 * DAY,
            credit=kind == 'topup_credited',
        )
    smtp, enqueue = AsyncMock(), AsyncMock()
    monkeypatch.setattr(email.email_service, 'send_email_result', smtp)
    monkeypatch.setattr(email_dispatch, 'enqueue_email', enqueue)
    scope_id = await scope(observed_db, now)
    result = await observer.observe_scope_page(scope_id, now=now + 1)
    data = await rows(observed_db)
    key = 'payment' if kind in observer.PAYMENT_TYPES else 'onboarding_v1'
    assert result.completed and result.scanned_members == 1 and result.scanned_scenarios == 6
    assert data[(kind, key)].reason == 'ready' and data[(kind, key)].first_eligible_at == now + 1
    assert all(row.delivery_id is None for row in data.values())
    smtp.assert_not_called()
    enqueue.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'negative,expected',
    [
        ('unverified', 'invalid_address'),
        ('no_consent', 'consent'),
        ('inactive', 'inactive_account'),
        ('technical_address', 'invalid_address'),
    ],
)
async def test_unfiltered_population_retains_negative_members(
    observed_db: async_sessionmaker[AsyncSession], negative: str, expected: str
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        if negative == 'unverified':
            await session.execute(update(User).where(User.id == '1').values(email_verified=False))
        elif negative == 'inactive':
            await session.execute(update(Auth).where(Auth.id == '1').values(active=False))
        elif negative == 'technical_address':
            await session.execute(update(User).where(User.id == '1').values(email='internal@social.invalid'))
        await session.commit()
    if negative == 'no_consent':
        from open_webui.models.email_preferences import set_product_preference

        await set_product_preference('1', False, 'settings')
    result = await observer.observe_scope_page(await scope(observed_db, now), now=now + 1)
    data = await rows(observed_db)
    assert result.completed and result.scanned_members == 1 and len(data) == 6
    for kind, _, _ in observer.ACCOUNT_WINDOWS:
        row = data[(kind, 'onboarding_v1')]
        assert row.reason == expected and row.first_eligible_at is None


@pytest.mark.asyncio
async def test_declared_future_payment_window_records_later_actual_sources_only(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    scope_id = await scope(observed_db, now)
    await queue_tests.payment_fact(observed_db, 'later', 'succeeded', now + 10, credit=True)
    first = await observer.observe_scope_page(scope_id, now=now + 1)
    data = await rows(observed_db)
    assert first.completed and ('topup_credited', 'later') not in data
    assert data[('topup_credited', 'no_scenario_v1')].reason == 'no_scenario'
    second = await observer.observe_scope_page(scope_id, now=now + 11)
    data = await rows(observed_db)
    assert second.completed and len(data) == 8
    assert data[('topup_credited', 'later')].first_eligible_at == now + 11
    assert data[('topup_credited', 'no_scenario_v1')].first_eligible_at is None
    assert data[('topup_credited', 'no_scenario_v1')].last_observed_at == now + 1


@pytest.mark.asyncio
@pytest.mark.parametrize('mutation', ['registration_future', 'payments_inverted', 'registrations_inverted'])
async def test_invalid_source_windows_leave_no_scope(
    observed_db: async_sessionmaker[AsyncSession], mutation: str
) -> None:
    now = int(time.time())
    fields = dict(registrations_from=0, registrations_until=now + 1, payments_from=0, payments_until=now + DAY)
    if mutation == 'registration_future':
        fields['registrations_until'] = now + DAY
    elif mutation == 'payments_inverted':
        fields['payments_from'] = fields['payments_until']
    else:
        fields['registrations_from'] = fields['registrations_until']
    async with observed_db() as session:
        with pytest.raises(ValueError):
            await store.declare_scope(session, ('1',), now, **fields)
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize('status,submitted', [('accepted', True), ('unknown', False), ('failed', True)])
async def test_past_submission_never_invents_first_positive(
    observed_db: async_sessionmaker[AsyncSession],
    status: str,
    submitted: bool,
) -> None:
    now = int(time.time())
    job_id = await queue_tests.enqueue(observed_db)
    async with observed_db() as session:
        await session.execute(
            update(EmailDelivery)
            .where(EmailDelivery.id == job_id)
            .values(status=status, submitted_at=now - 2 * DAY if submitted else None, accepted_at=None)
        )
        await session.commit()
    await observer.observe_scope_page(await scope(observed_db, now), now=now + 1)
    row = (await rows(observed_db))[('welcome', 'onboarding_v1')]
    assert row.reason == 'historical_submission' and row.first_eligible_at is None and row.delivery_id is None
    async with observed_db() as session:
        job = await session.get(EmailDelivery, job_id)
        assert job and job.status == status and job.accepted_at is None


@pytest.mark.asyncio
async def test_provider_success_without_ledger_never_becomes_eligible(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await queue_tests.payment_fact(observed_db, 'unconfirmed', 'succeeded', now - DAY)
    await observer.observe_scope_page(await scope(observed_db, now), now=now + 1)
    row = (await rows(observed_db))[('topup_credited', 'unconfirmed')]
    assert row.reason == 'credit_unconfirmed' and row.first_eligible_at is None


@pytest.mark.asyncio
async def test_first_positive_replay_late_optout_and_deletion(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    from open_webui.models.email_preferences import set_product_preference

    now = int(time.time())
    async with observed_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now))
        await session.commit()
    scope_id = await scope(observed_db, now)
    await observer.observe_scope_page(scope_id, now=now + 1)
    async with observed_db() as session:
        events = await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent))
    await observer.observe_scope_page(scope_id, now=now + 2)
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == events
    await set_product_preference('1', False, 'settings')
    await observer.observe_scope_page(scope_id, now=now + 3)
    row = (await rows(observed_db))[('welcome', 'onboarding_v1')]
    assert row.reason == 'consent' and row.first_eligible_at == now + 1
    async with observed_db() as session:
        await session.execute(delete(User).where(User.id == '1'))
        await session.commit()
    result = await observer.observe_scope_page(scope_id, now=now + 4)
    row = (await rows(observed_db))[('welcome', 'onboarding_v1')]
    assert result.completed and result.missing_source_members == 1
    assert row.reason == 'deleted_account' and row.first_eligible_at == now + 1


@pytest.mark.asyncio
async def test_deleted_before_first_pass_does_not_invent_original_window(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    scope_id = await scope(observed_db, now)
    async with observed_db() as session:
        await session.execute(delete(User).where(User.id == '1'))
        await session.commit()
    result = await observer.observe_scope_page(scope_id, now=now + 1)
    assert result.completed and result.scanned_members == result.missing_source_members == 1
    assert result.scanned_scenarios == 0 and await rows(observed_db) == {}


async def source_snapshot(factory: async_sessionmaker[AsyncSession]) -> str:
    async with factory() as session:
        values = []
        for model in [Payment, LedgerEntry, EmailDelivery]:
            values.append(
                [dict(row) for row in (await session.execute(select(model.__table__).order_by(model.id))).mappings()]
            )
        return json.dumps(values, sort_keys=True, default=str)


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['exception', 'timeout', 'payment_cap'])
async def test_page_failure_is_atomic_safe_and_money_independent(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    failure: str,
) -> None:
    now = int(time.time())
    await queue_tests.payment_fact(observed_db, 'money', 'succeeded', now - DAY, credit=True)
    scope_id = await scope(observed_db, now, ('1', '2'))
    before = await source_snapshot(observed_db)
    smtp, enqueue = AsyncMock(), AsyncMock()
    monkeypatch.setattr(email.email_service, 'send_email_result', smtp)
    monkeypatch.setattr(email_dispatch, 'enqueue_email', enqueue)
    if failure == 'exception':
        original = observer._member
        calls = 0

        async def member(*args: object) -> tuple[store.ObservedMember, bool]:
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError('must-not-log-secret-detail')
            return await original(*args)

        monkeypatch.setattr(observer, '_member', member)
    elif failure == 'timeout':

        async def delay(*args: object) -> tuple[store.ObservedMember, bool]:
            await asyncio.sleep(0.02)
            raise AssertionError('Timeout should cancel this')

        monkeypatch.setattr(observer, '_member', delay)
        monkeypatch.setattr(observer, 'PAGE_TIMEOUT_SECONDS', 0.001)
    else:
        await queue_tests.payment_fact(observed_db, 'overflow', 'pending', now)
        before = await source_snapshot(observed_db)
        monkeypatch.setattr(observer, 'MAX_MEMBER_PAYMENTS', 1)
    with pytest.raises(
        observer.ObservationPageError, match='coverage_lost' if failure == 'payment_cap' else 'observer_error'
    ):
        await observer.observe_scope_page(scope_id, now=now + 1)
    assert await source_snapshot(observed_db) == before
    assert await rows(observed_db) == {}
    assert 'must-not-log-secret-detail' not in caplog.text
    async with observed_db() as session:
        run = await session.scalar(select(store.EmailObservationRun))
        assert run and run.status == 'failed' and run.cursor == run.scanned_members == run.scanned_scenarios == 0
    smtp.assert_not_called()
    enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_250_members_restart_busy_and_lost_owner(observed_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    ids = tuple(f'population-{i:03}' for i in range(250))
    async with observed_db() as session:
        session.add_all(
            [
                User(
                    id=i,
                    email=f'{i}@example.org',
                    name='Test',
                    role='user',
                    email_verified=False,
                    created_at=now,
                    updated_at=now,
                    last_active_at=now,
                )
                for i in ids
            ]
        )
        await session.commit()
    scope_id = await scope(observed_db, now, ids)
    first = await observer.observe_scope_page(scope_id, now=now + 1)
    assert first.claim and not first.completed and first.scanned_members == 25
    busy = await observer.observe_scope_page(scope_id, now=now + 2)
    assert busy.claim is None and not busy.completed
    resumed = await observer.observe_scope_page(scope_id, now=now + 1 + store.LEASE_SECONDS)
    assert resumed.claim and resumed.claim.run_id == first.claim.run_id
    assert resumed.claim.claim_id != first.claim.claim_id and resumed.scanned_members == 50
    with pytest.raises(observer.ObservationPageError):
        await observer.observe_scope_page(scope_id, claim=first.claim, now=now + 2 + store.LEASE_SECONDS)
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, resumed.claim.run_id)
        assert run and run.status == 'running' and run.claim_id == resumed.claim.claim_id and run.cursor == 50
    result = resumed
    for page in range(8):
        result = await observer.observe_scope_page(
            scope_id, claim=resumed.claim, now=now + 3 + store.LEASE_SECONDS + page
        )
    assert result.completed and result.scanned_members == 250 and result.scanned_scenarios == 1500
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 1500
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 1500


@pytest.mark.asyncio
async def test_deleted_payment_preserves_original_identity_and_window(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await queue_tests.payment_fact(observed_db, 'deleted-payment', 'succeeded', now - DAY, credit=True)
    scope_id = await scope(observed_db, now)
    await observer.observe_scope_page(scope_id, now=now + 1)
    before = (await rows(observed_db))[('topup_credited', 'deleted-payment')]
    async with observed_db() as session:
        await session.execute(delete(Payment).where(Payment.id == 'deleted-payment'))
        await session.commit()
    result = await observer.observe_scope_page(scope_id, now=now + 2)
    after = (await rows(observed_db))[('topup_credited', 'deleted-payment')]
    assert result.completed and after.reason == 'source_unavailable' and after.payment_id is None
    assert (after.due_at, after.expires_at, after.first_eligible_at) == (
        before.due_at,
        before.expires_at,
        before.first_eligible_at,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize('limit', [5, 7])
async def test_history_cap_accounts_for_persisted_placeholders_and_new_scenarios(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    limit: int,
) -> None:
    now = int(time.time())
    scope_id = await scope(observed_db, now)
    await observer.observe_scope_page(scope_id, now=now + 1)
    await queue_tests.payment_fact(observed_db, 'new-payment', 'pending', now)
    monkeypatch.setattr(observer, 'MAX_MEMBER_HISTORY', limit)
    with pytest.raises(observer.ObservationPageError, match='coverage_lost'):
        await observer.observe_scope_page(scope_id, now=now + 2)
    data = await rows(observed_db)
    assert len(data) == 6 and all(row.last_observed_at == now + 1 for row in data.values())


@pytest.mark.asyncio
async def test_dispatch_scope_rejected_before_claim(observed_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with observed_db() as session:
        scope_id = await storage_tests.declare(session, now, mode='dispatch')
        await session.commit()
    with pytest.raises(ValueError, match='observation-only'):
        await observer.observe_scope_page(scope_id, now=now + 1)
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationRun)) == 0


@pytest.mark.asyncio
async def test_two_payments_keep_independent_decisions(observed_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    await queue_tests.payment_fact(observed_db, 'old-credit', 'succeeded', now - 4 * DAY, credit=True)
    await queue_tests.payment_fact(observed_db, 'new-cancel', 'canceled', now - 3 * DAY)
    result = await observer.observe_scope_page(await scope(observed_db, now), now=now + 1)
    data = await rows(observed_db)
    assert result.completed and result.scanned_scenarios == 8
    assert data[('topup_credited', 'old-credit')].reason == 'ready'
    assert data[('topup_credited', 'new-cancel')].reason == 'credit_unconfirmed'
    assert data[('payment_help_72h', 'new-cancel')].reason == 'ready'
    assert data[('payment_help_72h', 'old-credit')].reason == 'payment_priority'


@pytest.mark.asyncio
async def test_concurrent_postgres_claims_have_one_page_owner(observed_db: async_sessionmaker[AsyncSession]) -> None:
    async with observed_db() as session:
        if session.bind.dialect.name != 'postgresql':
            pytest.skip('Real PostgreSQL row locking')
    now = int(time.time())
    scope_id = await scope(observed_db, now, ('1', '2'))

    async def claim_only() -> store.ObservationClaim | None:
        async with observed_db() as session:
            claim = await store.claim_observation_run(session, scope_id, now + 1)
            await session.commit()
            return claim

    claims = await asyncio.gather(claim_only(), claim_only())
    owners = [claim for claim in claims if claim is not None]
    assert len(owners) == 1
    result = await observer.observe_scope_page(scope_id, claim=owners[0], now=now + 2)
    assert result.completed and result.scanned_members == 2 and result.scanned_scenarios == 12
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationRun)) == 1


@pytest.mark.asyncio
async def test_missing_source_count_survives_later_pages(observed_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    scope_id = await scope(observed_db, now, ('1', '2'))
    async with observed_db() as session:
        await session.execute(delete(User).where(User.id == '1'))
        await session.commit()
    first = await observer.observe_scope_page(scope_id, now=now + 1, limit=1)
    assert first.claim and first.missing_source_members == 1 and first.scanned_scenarios == 0
    final = await observer.observe_scope_page(scope_id, claim=first.claim, now=now + 2, limit=1)
    assert final.completed and final.missing_source_members == 1 and final.scanned_scenarios == 6
