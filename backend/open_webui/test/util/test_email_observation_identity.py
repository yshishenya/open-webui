"""Scenario identity and independent concurrent writers cannot duplicate history."""

import asyncio
import time
from dataclasses import replace

import pytest
from open_webui.models import email_observation as store
from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import EmailDelivery, enqueue_email
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_observation_storage as storage_tests

database = storage_tests.database
journal_db = storage_tests.journal_db
declare = storage_tests.declare
start = storage_tests.start
write = storage_tests.write
decision = storage_tests.decision


@pytest.mark.asyncio
async def test_simultaneous_same_page_writes_exactly_once(journal_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    async with journal_db() as session:
        scope_id = await declare(session, now)
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    async with journal_db() as session:
        member = (await store.observation_page(session, claim))[0]
        page = (store.ObservedMember(member.id, (decision(now, 'ready'),)),)

    async def submit() -> bool:
        async with journal_db() as session:
            try:
                await store.save_observation_page(session, claim, page, now + 2)
                await session.commit()
                return True
            except ValueError:
                await session.rollback()
                return False

    assert sum(await asyncio.gather(submit(), submit())) == 1
    async with journal_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 1
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 1
        row = await session.scalar(select(store.EmailScenarioObservation))
        assert row and row.first_eligible_at == now + 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'invalid',
    ['wrong_owner', 'payment_window', 'payment_key', 'account_key', 'account_payment', 'invented_orphan'],
)
async def test_invalid_source_identity_cannot_create_denominator(
    journal_db: async_sessionmaker[AsyncSession], invalid: str
) -> None:
    now = int(time.time())
    async with journal_db() as session:
        session.add(
            Payment(
                id='payment-source',
                user_id='2' if invalid == 'wrong_owner' else '1',
                provider='yookassa',
                status='pending',
                kind='topup',
                amount_kopeks=50000,
                currency='RUB',
                created_at=now + 2 if invalid == 'payment_window' else now,
                updated_at=now,
            )
        )
        scope_id = await declare(session, now)
        await session.commit()
    claim = await start(journal_db, scope_id, now + 1)
    outcome = store.ObservationDecision(
        'topup_credited', 'payment-source', now, None, 'credit_unconfirmed', payment_id='payment-source'
    )
    if invalid == 'payment_key':
        outcome = replace(outcome, scenario_key='different-payment')
    elif invalid == 'account_key':
        outcome = replace(decision(now), scenario_key='arbitrary-account-version')
    elif invalid == 'account_payment':
        outcome = replace(decision(now), payment_id='payment-source')
    elif invalid == 'invented_orphan':
        outcome = replace(outcome, payment_id=None, reason='source_unavailable')
    with pytest.raises(ValueError):
        await write(journal_db, claim, now + 2, outcome)
    async with journal_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 0
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 0
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == run.scanned_scenarios == 0
        payment = await session.get(Payment, 'payment-source')
        assert payment and payment.status == 'pending' and payment.amount_kopeks == 50000


@pytest.mark.asyncio
async def test_deleted_delivery_cannot_be_replaced_by_new_job(
    journal_db: async_sessionmaker[AsyncSession],
) -> None:
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
        await session.flush()
        replacement = await enqueue_email(session, '1', 'welcome', 'onboarding_v1', now - 86400, now + 86400)
        assert replacement and replacement != job_id
        await session.execute(update(EmailDelivery).where(EmailDelivery.id == replacement).values(created_at=now + 4))
        await session.commit()
    claim = await start(journal_db, scope_id, now + 3)
    with pytest.raises(ValueError, match='Delivery does not match'):
        await write(journal_db, claim, now + 4, replace(decision(now, 'ready'), delivery_id=replacement))
    async with journal_db() as session:
        row = await session.scalar(select(store.EmailScenarioObservation))
        assert row and row.delivery_id is None and row.linked_at == row.first_eligible_at == now + 2
        assert row.last_observed_at == now + 2 and row.revision == 1
