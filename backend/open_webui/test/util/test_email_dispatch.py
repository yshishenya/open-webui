"""New dispatch receipts, real readiness, rollback and complete-population boundaries."""

import asyncio
import time
from dataclasses import replace
from unittest.mock import AsyncMock

import pytest
from open_webui.models import email_delivery as queue
from open_webui.models import email_observation as store
from open_webui.models import email_preferences as prefs
from open_webui.models.billing_wallet import LedgerEntry
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils.airis import email_dispatch as dispatch
from open_webui.utils.airis import email_observer as observer
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests
from test.util import test_email_observer as observer_tests

database = observer_tests.database
journal_db = observer_tests.journal_db
observed_db = observer_tests.observed_db
DAY = scenarios.DAY


async def configuration(
    db: async_sessionmaker[AsyncSession], now: int, ids: tuple[str, ...] = ('1',)
) -> scenarios.EmailQueueConfig:
    async with db() as session:
        scope = await store.declare_scope(
            session,
            ids,
            now,
            registrations_from=0,
            registrations_until=now + 1,
            payments_from=0,
            payments_until=now + 30 * DAY,
            mode='dispatch',
        )
        await session.commit()
    return replace(queue_tests.config(), observation_scope_id=scope)


async def insert(
    db: async_sessionmaker[AsyncSession],
    config: scenarios.EmailQueueConfig,
    kind: queue.EmailType,
    now: int,
    payment_id: str | None = None,
) -> str | None:
    async with db() as session:
        scope = await dispatch.lock_dispatch_scope(session, config, now)
        user = await session.scalar(select(User).where(User.id == '1').with_for_update())
        key = payment_id or scenarios.ONBOARDING_VERSION
        candidate = await dispatch._candidate(session, scope, user, kind, key, payment_id)
        result = await dispatch.enqueue_observed_email(
            session,
            scope,
            user,
            kind,
            key,
            max(candidate.due_at, now),
            candidate.expires_at,
            now=now,
            payment_id=payment_id,
        )
        await session.commit()
        return result


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
async def test_six_ready_receipts_and_duplicate_replay(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    kind: queue.EmailType,
    age: int,
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
        welcome = await queue_tests.enqueue(observed_db)
        async with observed_db() as session:
            await session.execute(
                update(queue.EmailDelivery)
                .where(queue.EmailDelivery.id == welcome)
                .values(status='accepted', submitted_at=now - 2 * DAY, accepted_at=now - 2 * DAY)
            )
            await session.commit()
    payment = 'payment' if kind in observer.PAYMENT_TYPES else None
    if payment:
        await queue_tests.payment_fact(
            observed_db,
            payment,
            'succeeded' if kind == 'topup_credited' else 'canceled',
            now - age * DAY,
            credit=kind == 'topup_credited',
        )
    config = await configuration(observed_db, now)
    results = await asyncio.gather(
        insert(observed_db, config, kind, now, payment), insert(observed_db, config, kind, now, payment)
    )
    assert sum(item is not None for item in results) == 1
    assert await insert(observed_db, config, kind, now, payment) is None
    row = (await observer_tests.rows(observed_db))[(kind, payment or 'onboarding_v1')]
    assert row.delivery_id in results and row.linked_at == now and row.first_eligible_at == now
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 1
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationRun)) == 0
        assert (await session.get(store.EmailObservationScope, config.observation_scope_id)).observed_from is None
        assert (await session.scalar(select(store.EmailDecisionEvent))).run_id is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'kind,offset', [('activation_24h', 1), ('paid_value_72h', 3), ('feedback_14d', 14), ('payment_help_72h', 3)]
)
async def test_future_receipt_has_no_positive_until_actual_ready(
    observed_db: async_sessionmaker[AsyncSession],
    kind: queue.EmailType,
    offset: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now))
        if kind == 'paid_value_72h':
            session.add(
                TaskSuccess(
                    user_id='1', operation_id='success', kind='foreground_chat', source='saved_chat', completed_at=now
                )
            )
        await session.commit()
    payment = 'payment' if kind == 'payment_help_72h' else None
    if payment:
        await queue_tests.payment_fact(observed_db, payment, 'canceled', now)
    if kind == 'activation_24h':
        welcome = await queue_tests.enqueue(observed_db)
        async with observed_db() as session:
            await session.execute(
                update(queue.EmailDelivery)
                .where(queue.EmailDelivery.id == welcome)
                .values(status='accepted', submitted_at=now, accepted_at=now)
            )
            await session.commit()
    config = await configuration(observed_db, now)
    job_id = await insert(observed_db, config, kind, now, payment)
    key = (kind, payment or 'onboarding_v1')
    row = (await observer_tests.rows(observed_db))[key]
    assert row.delivery_id == job_id and row.first_eligible_at is None
    assert row.due_at == now + offset * DAY and row.reason == 'scenario_window'
    later = now + offset * DAY + 1
    monkeypatch.setattr(worker.time, 'time', lambda: later)
    job = await queue.claim_email(later)
    assert job and job.id == job_id
    assert await worker.prepare_email(job, config)
    assert await worker.prepare_email(job, config, 'person1@airis.you')
    row = (await observer_tests.rows(observed_db))[key]
    assert row.first_eligible_at == later and row.linked_at == now and row.due_at == now + offset * DAY
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 2
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationRun)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize('mutation', ['email', 'complaint', 'optout'])
async def test_late_negative_preserves_first_positive_and_blocks_transport(
    observed_db: async_sessionmaker[AsyncSession],
    mutation: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now))
        await session.commit()
    config = await configuration(observed_db, now)
    job_id = await insert(observed_db, config, 'welcome', now)
    job = await queue.claim_email(now)
    assert job and job.id == job_id and await worker.prepare_email(job, config)
    if mutation == 'optout':
        await prefs.set_product_preference('1', False, 'settings')
    else:
        async with observed_db() as session:
            if mutation == 'email':
                await session.execute(
                    update(User).where(User.id == '1').values(email='changed@example.org', email_verified=False)
                )
            else:
                session.add(
                    prefs.EmailPreferenceEvent(
                        id='complaint',
                        user_id='1',
                        action='complaint',
                        consent_version=prefs.CONSENT_VERSION,
                        source='provider',
                        email_hash=prefs.email_fingerprint('person1@airis.you'),
                        created_at=now,
                    )
                )
            await session.commit()
    assert await worker.prepare_email(job, config, 'person1@airis.you') is None
    result = await observer.observe_scope_page(config.observation_scope_id, now=now + 1, mode='dispatch')
    row = (await observer_tests.rows(observed_db))[('welcome', 'onboarding_v1')]
    assert result.completed and row.first_eligible_at == now and row.delivery_id == job_id and row.reason != 'ready'
    async with observed_db() as session:
        assert (await session.get(queue.EmailDelivery, job_id)).submitted_at is None


@pytest.mark.asyncio
@pytest.mark.parametrize('point', ['before_insert', 'after_insert'])
async def test_journal_error_rolls_back_queue_but_preserves_committed_credit(
    observed_db: async_sessionmaker[AsyncSession],
    point: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    await queue_tests.payment_fact(observed_db, 'money', 'succeeded', now, credit=True)
    config = await configuration(observed_db, now)
    monkeypatch.setattr(
        dispatch,
        '_candidate' if point == 'before_insert' else '_write_decision',
        AsyncMock(side_effect=RuntimeError('controlled journal failure')),
    )
    with pytest.raises(RuntimeError):
        await insert(observed_db, config, 'topup_credited', now, 'money')
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(queue.EmailDelivery)) == 0
        assert await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation)) == 0
        assert await session.scalar(select(func.count()).select_from(LedgerEntry)) == 1


@pytest.mark.asyncio
async def test_unassociated_old_task_and_deleted_receipt_never_acquire_link(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    job_id = await queue_tests.enqueue(observed_db)
    config = await configuration(observed_db, now)
    assert await insert(observed_db, config, 'welcome', now) is None
    assert not await observer_tests.rows(observed_db)
    job = await queue.claim_email(now)
    assert job and job.id == job_id
    assert await worker.prepare_email(job, config) is None
    assert not await observer_tests.rows(observed_db)
    async with observed_db() as session:
        assert (await session.get(queue.EmailDelivery, job_id)).reason == 'observation_unlinked'


@pytest.mark.asyncio
@pytest.mark.parametrize('invalid', ['closed', 'observe', 'unknown', 'wrong_rule'])
async def test_invalid_selected_scope_never_bypasses_journal(
    observed_db: async_sessionmaker[AsyncSession],
    invalid: str,
) -> None:
    now = int(time.time())
    config = await configuration(observed_db, now)
    async with observed_db() as session:
        values = (
            {'closed_at': now}
            if invalid == 'closed'
            else {'mode': 'observe'} if invalid == 'observe' else {'rule_version': 'unknown'}
        )
        if invalid != 'unknown':
            await session.execute(
                update(store.EmailObservationScope)
                .where(store.EmailObservationScope.id == config.observation_scope_id)
                .values(**values)
            )
            await session.commit()
        else:
            config = replace(config, observation_scope_id='missing')
    with pytest.raises(ValueError, match='unavailable'):
        await insert(observed_db, config, 'welcome', now)
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(queue.EmailDelivery)) == 0


@pytest.mark.asyncio
async def test_dispatch_page_keeps_negative_population_partial_coverage_and_two_payments(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    await prefs.set_product_preference('2', False, 'settings')
    await queue_tests.payment_fact(observed_db, 'one', 'succeeded', now - 10, credit=True)
    await queue_tests.payment_fact(observed_db, 'two', 'succeeded', now - 5, credit=True)
    config = await configuration(observed_db, now, ('1', '2'))
    first = await observer.observe_scope_page(config.observation_scope_id, now=now, limit=1, mode='dispatch')
    assert not first.completed and first.scanned_members == 1
    for payment in ['one', 'two']:
        assert await insert(observed_db, config, 'topup_credited', now, payment)
    data = await observer_tests.rows(observed_db)
    assert data[('topup_credited', 'one')].delivery_id != data[('topup_credited', 'two')].delivery_id
    second = await observer.observe_scope_page(
        config.observation_scope_id, claim=first.claim, now=now + 1, limit=1, mode='dispatch'
    )
    assert second.completed and second.scanned_members == 2 and second.scanned_scenarios == 14
    async with observed_db() as session:
        rows = list(
            await session.scalars(
                select(store.EmailScenarioObservation)
                .join(store.EmailObservationMember)
                .where(
                    store.EmailObservationMember.user_id == '2',
                    store.EmailScenarioObservation.type.in_([kind for kind, _, _ in observer.ACCOUNT_WINDOWS]),
                )
            )
        )
        assert len(rows) == 4 and all(row.first_eligible_at is None and row.reason == 'consent' for row in rows)


@pytest.mark.asyncio
async def test_real_enqueue_entrypoints_and_restart_share_one_receipt(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now))
        await session.commit()
    config = await configuration(observed_db, now)
    for key, value in {
        'AIRIS_EMAIL_QUEUE_ENABLED': 'true',
        'AIRIS_EMAIL_RELEASE_A_ENABLED': 'true',
        'AIRIS_EMAIL_RELEASE_B_ENABLED': 'true',
        'AIRIS_EMAIL_DRY_RUN': 'false',
        'AIRIS_EMAIL_PILOT_ONLY': 'true',
        'AIRIS_EMAIL_PILOT_USER_IDS': '1',
        'AIRIS_EMAIL_ONBOARDING_START_AT': '1',
        'AIRIS_EMAIL_OBSERVATION_SCOPE_ID': config.observation_scope_id,
    }.items():
        monkeypatch.setenv(key, value)
    assert await scenarios.queue_welcome('1')
    assert not await scenarios.queue_welcome('1')
    assert not await scenarios.queue_welcome('2')
    await scenarios.reconcile_email_candidates(config)
    monkeypatch.setattr(scenarios, '_account_cursor', (0, ''))
    monkeypatch.setattr(scenarios, '_payment_cursor', (0, ''))
    await scenarios.reconcile_email_candidates(config)
    rows = await observer_tests.rows(observed_db)
    assert len(rows) == 4 and sum(row.first_eligible_at is not None for row in rows.values()) == 1
    async with observed_db() as session:
        assert await session.scalar(select(func.count()).select_from(queue.EmailDelivery)) == 4
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 4


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['link', 'expiry', 'payment'])
async def test_stale_receipt_never_permits_submit(
    observed_db: async_sessionmaker[AsyncSession],
    change: str,
) -> None:
    now = int(time.time())
    config = await configuration(observed_db, now)
    job_id = await insert(observed_db, config, 'welcome', now)
    job = await queue.claim_email(now)
    assert job and job.id == job_id
    async with observed_db() as session:
        if change == 'link':
            await session.execute(update(store.EmailScenarioObservation).values(delivery_id=None))
        elif change == 'expiry':
            await session.execute(
                update(queue.EmailDelivery).where(queue.EmailDelivery.id == job_id).values(expires_at=now + DAY)
            )
        else:
            await queue_tests.payment_fact(observed_db, 'changed', 'succeeded', now, credit=True)
            await session.execute(
                update(queue.EmailDelivery).where(queue.EmailDelivery.id == job_id).values(payment_id='changed')
            )
        await session.commit()
    assert await worker.prepare_email(job, config) is None
    async with observed_db() as session:
        assert (await session.get(queue.EmailDelivery, job_id)).submitted_at is None


@pytest.mark.asyncio
async def test_release_switch_and_capacity_do_not_change_canonical_first_positive(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    config = await configuration(observed_db, now)
    job_id = await insert(observed_db, config, 'welcome', now)
    row = (await observer_tests.rows(observed_db))[('welcome', 'onboarding_v1')]
    original_due = row.due_at
    job = await queue.claim_email(now)
    assert job and job.id == job_id
    assert await worker.prepare_email(job, replace(config, release_a=False)) is None
    later = now + worker.POLL_SECONDS + 1
    monkeypatch.setattr(worker.time, 'time', lambda: later)
    job = await queue.claim_email(later)
    assert job and await worker.prepare_email(job, config)
    await queue.defer_email_capacity(job, later)
    await observer.observe_scope_page(config.observation_scope_id, now=later + 1, mode='dispatch')
    row = (await observer_tests.rows(observed_db))[('welcome', 'onboarding_v1')]
    assert row.first_eligible_at == now and row.due_at == original_due and row.delivery_id == job_id
    async with observed_db() as session:
        assert (await session.get(queue.EmailDelivery, job_id)).submitted_at is None


@pytest.mark.asyncio
async def test_cancelled_scope_waiter_drains_and_releases_lock(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    config = await configuration(observed_db, now)

    async def wait() -> None:
        async with observed_db() as session:
            await dispatch.lock_dispatch_scope(session, config, now)
            await session.commit()

    async with observed_db() as owner:
        await dispatch.lock_dispatch_scope(owner, config, now)
        waiter = asyncio.create_task(wait())
        await asyncio.sleep(0.05)
        assert not waiter.done()
        waiter.cancel()
        await owner.commit()
        with pytest.raises(asyncio.CancelledError):
            await waiter
    assert await asyncio.wait_for(insert(observed_db, config, 'welcome', now), 5)


@pytest.mark.asyncio
async def test_failed_presubmit_journal_rolls_back_submission_marker(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = int(time.time())
    config = await configuration(observed_db, now)
    job_id = await insert(observed_db, config, 'welcome', now)
    job = await queue.claim_email(now)
    assert job and await worker.prepare_email(job, config)
    monkeypatch.setattr(
        dispatch, '_write_decision', AsyncMock(side_effect=RuntimeError('controlled pre-submit failure'))
    )
    with pytest.raises(RuntimeError):
        await worker.prepare_email(job, config, 'person1@airis.you')
    async with observed_db() as session:
        row = await session.get(queue.EmailDelivery, job_id)
        assert row.submitted_at is None and row.attempts == 1 and row.status == 'claimed'
        assert await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent)) == 1
