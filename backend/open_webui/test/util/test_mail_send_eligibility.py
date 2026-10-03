"""Characterize the permission policy independently of future journal writes."""

import time
from dataclasses import replace
from unittest.mock import AsyncMock

import pytest
from open_webui.models import email_preferences as prefs
from open_webui.models.auths import Auth
from open_webui.models.email_delivery import DeliveryView, EmailDelivery, EmailType
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils import email
from open_webui.utils.airis import email_eligibility as eligibility
from open_webui.utils.airis import email_queue as worker
from sqlalchemy import event, update
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests

# Reuse the controlled SQLite/PostgreSQL schema; no production accounts or transport.
database = queue_tests.database


async def case_job(database: async_sessionmaker[AsyncSession], case: str, now: int) -> DeliveryView:
    """Set explicit queue and preference facts before the decision is read."""
    kinds: dict[str, EmailType] = {
        'activation_success': 'activation_24h',
        'welcome_pending': 'activation_24h',
        'paid_no_activation': 'paid_value_72h',
    }
    job_id = await queue_tests.enqueue(database, kinds.get(case, 'welcome'))
    if case == 'no_consent':
        await prefs.set_product_preference('1', False, 'settings')
    if case == 'complaint':
        await prefs.suppress_product_address('person1@airis.you', 'complaint')
    job = await queue_tests.state(database, job_id)
    updates = {'expired': {'expires_at': now}, 'future_due': {'due_at': now + 600}}
    if case == 'personal_frequency':
        previous_id = await queue_tests.enqueue(database, 'welcome', 'previous-scenario')
        async with database() as session:
            await session.execute(
                update(EmailDelivery)
                .where(EmailDelivery.id == previous_id)
                .values(status='accepted', accepted_at=now - 60)
            )
            await session.commit()
    return job.model_copy(update={'due_at': min(job.due_at, now), **updates.get(case, {})})


async def configure_account(session: AsyncSession, user: User, case: str, now: int) -> None:
    """Apply one known account-state change without changing the decision algorithm."""
    changes: dict[str, dict[str, str | bool]] = {
        'admin_product': {'role': 'admin'},
        'unverified': {'email_verified': False},
        'technical_address': {'email': 'technical@provider.local'},
    }
    for name, value in changes.get(case, {}).items():
        setattr(user, name, value)
    if case == 'inactive':
        auth = await session.get(Auth, '1')
        auth.active = False
    if case == 'activation_success':
        session.add(
            TaskSuccess(
                user_id='1',
                operation_id='permission-success',
                kind='foreground_chat',
                source='saved_chat',
                completed_at=now - 1,
            )
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('case', 'reason'),
    [
        ('ready', 'ready'),
        ('deleted', 'deleted_account'),
        ('inactive', 'inactive_account'),
        ('admin_product', 'inactive_account'),
        ('unverified', 'invalid_address'),
        ('technical_address', 'invalid_address'),
        ('changed_address', 'invalid_address'),
        ('no_consent', 'consent'),
        ('complaint', 'suppressed_address'),
        ('expired', 'expired'),
        ('future_due', 'scenario_window'),
        ('activation_success', 'activation'),
        ('welcome_pending', 'welcome_pending'),
        ('paid_no_activation', 'no_activation'),
        ('personal_frequency', 'frequency'),
    ],
)
async def test_existing_permission_reasons_and_deferrals(
    database: async_sessionmaker[AsyncSession], case: str, reason: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Expected reasons are explicit business facts, not outputs from a second implementation."""
    now = int(time.time())
    job = await case_job(database, case, now)
    async with database() as session:
        user = await session.get(User, '1')
        await configure_account(session, user, case, now)
        await session.commit()
    async with database() as session:
        user = await session.get(User, '1')
        transport = AsyncMock(side_effect=AssertionError('Decision must not send mail'))
        monkeypatch.setattr(worker, 'execute_email', transport)
        expected_email = 'changed@airis.you' if case == 'changed_address' else None
        decision = await worker.permission_decision(
            session, None if case == 'deleted' else user, job, queue_tests.config(), expected_email, now
        )
        shared = await eligibility.send_eligibility(
            session, None if case == 'deleted' else user, job, expected_email, now
        )
        assert shared == decision
        assert decision.reason == reason
        expected_defer = {
            'future_due': now + 600,
            'welcome_pending': now + 300,
            'personal_frequency': now - 60 + 86400,
        }.get(case)
        assert decision.defer_until == expected_defer
        transport.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('control', ['disabled', 'dry_run', 'pilot', 'nonpilot', 'release', 'global_product'])
async def test_business_eligibility_is_separate_from_dispatch_controls(
    database: async_sessionmaker[AsyncSession], control: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A ready observed account never bypasses an operator's disabled dispatch switch."""
    job_id = await queue_tests.enqueue(database)
    job = await queue_tests.state(database, job_id)
    config = queue_tests.config()
    changes = {
        'disabled': {'enabled': False},
        'dry_run': {'dry_run': True},
        'pilot': {'pilot_user_ids': frozenset()},
        'nonpilot': {'pilot_user_ids': frozenset({'2'})},
        'release': {'release_a': False},
    }
    if control == 'global_product':
        monkeypatch.setattr(email, 'AIRIS_PRODUCT_EMAILS_ENABLED', False)
    else:
        config = replace(config, **changes[control])
    now = int(time.time())
    async with database() as session:
        user = await session.get(User, '1')
        shared = await eligibility.send_eligibility(session, user, job, None, now)
        blocked = await worker.permission_decision(session, user, job, config, None, now)
        assert shared.reason == 'ready' and shared.defer_until is None
        assert blocked.reason == 'release_disabled' and blocked.defer_until == now + 300


@pytest.mark.asyncio
async def test_repeated_business_decisions_write_nothing_and_never_enqueue_or_send(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Read-only evaluation cannot manufacture observations, money or queue jobs."""
    job_id = await queue_tests.enqueue(database)
    job = await queue_tests.state(database, job_id)
    engine = database.kw['bind']
    assert isinstance(engine, AsyncEngine)
    mutations: list[str] = []

    def record(
        connection: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: ExecutionContext,
        executemany: bool,
    ) -> None:
        operation = statement.lstrip().split(None, 1)[0].upper()
        if operation in {'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'}:
            mutations.append(operation)

    enqueue = AsyncMock(side_effect=AssertionError('Read must not enqueue'))
    transport = AsyncMock(side_effect=AssertionError('Read must not send'))
    monkeypatch.setattr(queue_tests.scenarios, 'enqueue_email', enqueue)
    monkeypatch.setattr(worker, 'execute_email', transport)
    event.listen(engine.sync_engine, 'before_cursor_execute', record)
    try:
        now = int(time.time())
        async with database() as session:
            user = await session.get(User, '1')
            first = await eligibility.send_eligibility(session, user, job, None, now)
            second = await eligibility.send_eligibility(session, user, job, None, now)
            gated = await worker.permission_decision(session, user, job, queue_tests.config(), None, now)
        assert first == second == gated
        assert first.reason == 'ready'
        assert mutations == []
        enqueue.assert_not_awaited()
        transport.assert_not_awaited()
    finally:
        event.remove(engine.sync_engine, 'before_cursor_execute', record)
