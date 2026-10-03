"""Storage boundaries are independent of scheduler, provider and SMTP calls."""

import asyncio
import importlib
import time
from collections.abc import AsyncIterator
from dataclasses import replace
from typing import Literal
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from open_webui.internal.db import Base
from open_webui.models import email_observation as store
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import EmailDelivery, enqueue_email
from open_webui.models.users import User
from open_webui.utils.airis import email_queue, email_scenarios
from sqlalchemy import delete, func, inspect, select, update
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests

database = queue_tests.database
TABLES = [
    store.EmailObservationScope.__table__,
    store.EmailObservationMember.__table__,
    store.EmailObservationRun.__table__,
    store.EmailScenarioObservation.__table__,
    store.EmailDecisionEvent.__table__,
]


@pytest_asyncio.fixture
async def journal_db(database: async_sessionmaker[AsyncSession]) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async with database() as session:
        engine = session.bind
        assert isinstance(engine, AsyncEngine)
    async with engine.begin() as conn:
        if engine.dialect.name == 'sqlite':
            await conn.run_sync(lambda c: c.exec_driver_sql('PRAGMA foreign_keys=ON'))
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=TABLES))
    yield database
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.drop_all(c, tables=TABLES))


async def declare(
    session: AsyncSession,
    now: int,
    users: tuple[str, ...] = ('1',),
    mode: Literal['observe', 'dispatch'] = 'observe',
) -> str:
    return await store.declare_scope(
        session,
        users,
        now,
        registrations_from=0,
        registrations_until=now + 1,
        payments_from=0,
        payments_until=now + 1,
        mode=mode,
    )


async def start(database: async_sessionmaker[AsyncSession], scope_id: str, now: int) -> store.ObservationClaim:
    async with database() as session:
        claim = await store.claim_observation_run(session, scope_id, now)
        assert claim
        await session.commit()
        return claim


def decision(now: int, reason: str = 'consent') -> store.ObservationDecision:
    return store.ObservationDecision('welcome', 'onboarding_v1', now - 86400, now + 86400, reason)


async def write(
    database: async_sessionmaker[AsyncSession],
    claim: store.ObservationClaim,
    now: int,
    outcome: store.ObservationDecision | None = None,
    limit: int = 100,
) -> int:
    async with database() as session:
        members = await store.observation_page(session, claim, limit)
        page = tuple(store.ObservedMember(m.id, (outcome,) if outcome else ()) for m in members)
        await store.save_observation_page(session, claim, page, now)
        await session.commit()
        return len(page)


@pytest.mark.asyncio
async def test_frozen_population_paginated_restart(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    ids = tuple(f'population-{i:03}' for i in range(250))
    async with journal_db() as session:
        session.add_all(
            [
                User(
                    id=i,
                    email=f'{i}@example.org',
                    name='Test',
                    role='user',
                    email_verified=False,
                    created_at=now - 3 * 86400,
                    updated_at=now,
                    last_active_at=now,
                )
                for i in ids
            ]
        )
        await session.commit()
        scope_id = await declare(session, now, ids)
        await session.commit()
        scope = await session.get(store.EmailObservationScope, scope_id)
        assert scope and scope.member_count == 250 and scope.observed_from is None
    claim = await start(journal_db, scope_id, now + 1)
    assert await write(journal_db, claim, now + 2, decision(now)) == 100
    async with journal_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == run.scanned_members == 100 and run.status == 'running' and run.finished_at is None
    resumed = await start(journal_db, scope_id, now + 2 + store.LEASE_SECONDS)
    assert resumed.run_id == claim.run_id and resumed.claim_id != claim.claim_id
    assert await write(journal_db, resumed, now + 3 + store.LEASE_SECONDS, decision(now)) == 100
    assert await write(journal_db, resumed, now + 4 + store.LEASE_SECONDS, decision(now)) == 50
    async with journal_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == run.scanned_members == run.scanned_scenarios == 250 and run.status == 'completed'
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 250
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 250
        scope = await session.get(store.EmailObservationScope, scope_id)
        assert scope and scope.observed_from == now + 1


@pytest.mark.asyncio
async def test_first_positive_and_replays_preserve_history(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now)
        await session.commit()
    outcome = decision(now)
    for offset, reason in [(1, 'consent'), (2, 'ready'), (3, 'invalid_address'), (4, 'invalid_address'), (5, 'ready')]:
        claim = await start(journal_db, scope_id, now + offset)
        await write(journal_db, claim, now + offset, replace(outcome, reason=reason))
    async with journal_db() as session:
        row = await session.scalar(select(store.EmailScenarioObservation))
        assert row and row.first_observed_at == now + 1 and row.first_eligible_at == now + 2
        assert row.last_observed_at == now + 5 and row.reason == 'ready' and row.revision == 4
        events = list(
            (await session.scalars(select(store.EmailDecisionEvent).order_by(store.EmailDecisionEvent.revision))).all()
        )
        assert [(e.reason, e.observed_at) for e in events] == [
            ('consent', now + 1),
            ('ready', now + 2),
            ('invalid_address', now + 3),
            ('ready', now + 5),
        ]


@pytest.mark.asyncio
async def test_two_claimants_and_expired_owner(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now)
        await session.commit()

    async def attempt() -> store.ObservationClaim | None:
        async with journal_db() as session:
            claim = await store.claim_observation_run(session, scope_id, now + 1)
            await session.commit()
            return claim

    results = await asyncio.gather(attempt(), attempt())
    assert sum(c is not None for c in results) == 1
    first = next(c for c in results if c is not None)
    async with journal_db() as session:
        old_page = tuple(
            store.ObservedMember(m.id, (decision(now),)) for m in await store.observation_page(session, first)
        )
    resumed = await start(journal_db, scope_id, now + 1 + store.LEASE_SECONDS)
    async with journal_db() as session:
        with pytest.raises(ValueError, match='lease is lost'):
            await store.save_observation_page(session, first, old_page, now + 2 + store.LEASE_SECONDS)
        await session.commit()
    assert await write(journal_db, resumed, now + 2 + store.LEASE_SECONDS, decision(now)) == 1


@pytest.mark.asyncio
async def test_page_failure_rolls_back_all_storage_but_not_money(
    journal_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    smtp = AsyncMock(side_effect=AssertionError('Storage must not call SMTP'))
    enqueue = AsyncMock(side_effect=AssertionError('Storage must not enqueue'))
    monkeypatch.setattr(email_queue, 'prepare_email', smtp)
    monkeypatch.setattr(email_scenarios, 'enqueue_email', enqueue)
    async with journal_db() as session:
        session.add(
            Payment(
                id='money',
                user_id='1',
                provider='yookassa',
                status='pending',
                kind='topup',
                amount_kopeks=50000,
                currency='RUB',
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            LedgerEntry(
                id='money-ledger',
                user_id='1',
                wallet_id='wallet',
                currency='RUB',
                type='topup',
                amount_kopeks=50000,
                balance_included_after=0,
                balance_topup_after=50000,
                created_at=now,
            )
        )
        scope_id = await declare(session, now, ('1', '2'))
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    async with journal_db() as session:
        members = await store.observation_page(session, claim)
        good, bad = decision(now), replace(decision(now), reason='secret@example.org')
        with pytest.raises(ValueError, match='Invalid observation decision'):
            await store.save_observation_page(
                session,
                claim,
                (store.ObservedMember(members[0].id, (good,)), store.ObservedMember(members[1].id, (bad,))),
                now + 2,
            )
        # Even catching the exception and committing the caller cannot retain a partial page.
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 0
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 0
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == run.scanned_members == run.scanned_scenarios == 0
        payment = await session.get(Payment, 'money')
        ledger = await session.get(LedgerEntry, 'money-ledger')
        assert payment and payment.amount_kopeks == 50000 and payment.status == 'pending'
        assert ledger and ledger.amount_kopeks == ledger.balance_topup_after == 50000
    smtp.assert_not_called()
    enqueue.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'mutation', ['skip', 'duplicate', 'wrong_scope', 'stale_time', 'changed_window', 'unknown_reason', 'future_ready']
)
async def test_reject_invalid_page_without_advancing(
    journal_db: async_sessionmaker[AsyncSession],
    mutation: str,
) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now, ('1', '2'))
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    if mutation == 'changed_window':
        await write(journal_db, claim, now + 2, decision(now))
        claim = await start(journal_db, scope_id, now + 3)
    async with journal_db() as session:
        members = await store.observation_page(session, claim)
        page = tuple(store.ObservedMember(m.id, (decision(now),)) for m in members)
        when = now + 4
        if mutation == 'skip':
            page = page[1:]
        elif mutation == 'duplicate':
            page = (page[0], page[0])
        elif mutation == 'wrong_scope':
            claim = replace(claim, scope_id='missing')
        elif mutation == 'stale_time':
            when = now
        elif mutation == 'changed_window':
            page = (store.ObservedMember(members[0].id, (replace(decision(now), due_at=now - 20),)), page[1])
        elif mutation == 'unknown_reason':
            page = (store.ObservedMember(members[0].id, (replace(decision(now), reason='invalid'),)), page[1])
        else:
            page = (store.ObservedMember(members[0].id, (replace(decision(now, 'ready'), due_at=now + 50),)), page[1])
        with pytest.raises(ValueError):
            await store.save_observation_page(session, claim, page, when)
        await session.commit()
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == 0 and run.status == 'running'


@pytest.mark.asyncio
@pytest.mark.parametrize('users', [('1', '1'), ('missing',)])
async def test_invalid_declaration_is_atomic(
    journal_db: async_sessionmaker[AsyncSession], users: tuple[str, ...]
) -> None:
    async with journal_db() as session:
        with pytest.raises(ValueError):
            await declare(session, int(time.time()), users)
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 0
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationMember)) == 0


@pytest.mark.asyncio
async def test_empty_scope_and_closed_scope(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now, ())
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    assert await write(journal_db, claim, now + 2) == 0
    async with journal_db() as session:
        await session.execute(
            update(store.EmailObservationScope)
            .where(store.EmailObservationScope.id == scope_id)
            .values(closed_at=now + 3)
        )
        await session.commit()
        assert await store.claim_observation_run(session, scope_id, now + 4) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'invalid', ['wrong_user', 'wrong_type', 'old_job', 'accepted_job', 'observe_mode', 'wrong_window']
)
async def test_delivery_association_requires_exact_new_scenario(
    journal_db: async_sessionmaker[AsyncSession],
    invalid: str,
) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now, mode='observe' if invalid == 'observe_mode' else 'dispatch')
        email_type = 'activation_24h' if invalid == 'wrong_type' else 'welcome'
        job_id = await enqueue_email(
            session, '2' if invalid == 'wrong_user' else '1', email_type, 'onboarding_v1', now - 86400, now + 86400
        )
        assert job_id
        await session.execute(
            update(EmailDelivery)
            .where(EmailDelivery.id == job_id)
            .values(
                created_at=now - 1 if invalid == 'old_job' else now + 2,
                status='accepted' if invalid == 'accepted_job' else 'pending',
                expires_at=now + 500 if invalid == 'wrong_window' else now + 86400,
            )
        )
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    with pytest.raises(ValueError, match='Delivery does not match'):
        await write(journal_db, claim, now + 2, replace(decision(now, 'ready'), delivery_id=job_id))
    async with journal_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 0
        job = await session.get(EmailDelivery, job_id)
        assert job and job.status == ('accepted' if invalid == 'accepted_job' else 'pending')


@pytest.mark.asyncio
async def test_link_and_deletion_preserve_first_positive(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now, mode='dispatch')
        job_id = await enqueue_email(session, '1', 'welcome', 'onboarding_v1', now - 86400, now + 86400)
        assert job_id
        await session.execute(update(EmailDelivery).where(EmailDelivery.id == job_id).values(created_at=now + 2))
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    await write(journal_db, claim, now + 2, replace(decision(now, 'ready'), delivery_id=job_id))
    async with journal_db() as session:
        await session.execute(delete(EmailDelivery).where(EmailDelivery.id == job_id))
        await session.execute(delete(User).where(User.id == '1'))
        await session.commit()
        row = await session.scalar(select(store.EmailScenarioObservation))
        member = await session.scalar(select(store.EmailObservationMember))
        assert row and row.delivery_id is None and row.linked_at == row.first_eligible_at == now + 2
        assert member and member.user_id is None
    claim = await start(journal_db, scope_id, now + 3)
    await write(journal_db, claim, now + 3, replace(decision(now), reason='deleted_account'))
    async with journal_db() as session:
        row = await session.scalar(select(store.EmailScenarioObservation))
        assert row and row.first_eligible_at == now + 2 and row.reason == 'deleted_account'


@pytest.mark.asyncio
async def test_static_migration_roundtrip_preserves_source_tables(database: async_sessionmaker[AsyncSession]) -> None:
    migration = importlib.import_module('open_webui.migrations.versions.o1j020261003_add_email_observation_journal')
    async with database() as session:
        engine = session.bind
        assert isinstance(engine, AsyncEngine)

    def verify(conn: Connection) -> None:
        before = set(inspect(conn).get_table_names())
        original = {name: [(c['name'], str(c['type'])) for c in inspect(conn).get_columns(name)] for name in before}
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            assert set(inspect(conn).get_table_names()) - before == {t.name for t in TABLES}
            assert original == {
                name: [(c['name'], str(c['type'])) for c in inspect(conn).get_columns(name)] for name in before
            }
            migration.downgrade()
            assert set(inspect(conn).get_table_names()) == before
            migration.upgrade()
            migration.downgrade()

    async with engine.begin() as conn:
        await conn.run_sync(verify)


@pytest.mark.asyncio
async def test_failed_or_lost_population_never_completes(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now, ('1', '2'))
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    async with journal_db() as session:
        member = await session.scalar(
            select(store.EmailObservationMember).where(store.EmailObservationMember.ordinal == 1)
        )
        assert member
        await session.delete(member)
        await session.commit()
    with pytest.raises(ValueError, match='lost coverage'):
        await write(journal_db, claim, now + 2, decision(now))
    async with journal_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 0
        assert await store.fail_observation_run(session, claim, now + 3, 'coverage_lost')
        await session.commit()
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.status == 'failed' and run.failure_reason == 'coverage_lost' and run.cursor == 0
        assert not await store.fail_observation_run(session, claim, now + 4, 'observer_error')


@pytest.mark.asyncio
async def test_two_payments_one_account_and_deleted_source(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        session.add_all(
            [
                Payment(
                    id=pid,
                    user_id='1',
                    provider='yookassa',
                    status='succeeded',
                    kind='topup',
                    amount_kopeks=50000,
                    currency='RUB',
                    created_at=now,
                    updated_at=now,
                )
                for pid in ['payment-1', 'payment-2']
            ]
        )
        scope_id = await declare(session, now)
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    outcomes = tuple(
        store.ObservationDecision('topup_credited', pid, now, None, 'credit_unconfirmed', payment_id=pid)
        for pid in ['payment-1', 'payment-2']
    )
    async with journal_db() as session:
        members = await store.observation_page(session, claim)
        assert await store.save_observation_page(
            session, claim, (store.ObservedMember(members[0].id, outcomes),), now + 2
        )
        await session.commit()
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 2
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationMember)) == 1
        await session.execute(delete(Payment).where(Payment.id == 'payment-1'))
        await session.commit()
        row = await session.scalar(
            select(store.EmailScenarioObservation).where(store.EmailScenarioObservation.scenario_key == 'payment-1')
        )
        assert row and row.payment_id is None and row.first_eligible_at is None
    claim = await start(journal_db, scope_id, now + 3)
    await write(journal_db, claim, now + 3, replace(outcomes[0], reason='source_unavailable', payment_id=None))
    async with journal_db() as session:
        row = await session.scalar(
            select(store.EmailScenarioObservation).where(store.EmailScenarioObservation.scenario_key == 'payment-1')
        )
        assert row and row.reason == 'source_unavailable' and row.first_eligible_at is None
