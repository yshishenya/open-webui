"""Independent expected counts, incomplete sources and side-effect-free scope exports."""

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from open_webui.models import email_delivery as queue
from open_webui.models import email_preferences as preferences
from open_webui.models.billing_wallet import Payment
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User, UserModel
from open_webui.routers.airis import email_observation as routes
from open_webui.utils.airis import email_observer as observer
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scope_report as report
from open_webui.utils.auth import get_current_user
from sqlalchemy import delete, event, update
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests
from test.util import test_email_dispatch as dispatch_tests
from test.util import test_email_observer as observer_tests

database = observer_tests.database
journal_db = observer_tests.journal_db
observed_db = observer_tests.observed_db
DAY = dispatch_tests.DAY


@pytest_asyncio.fixture
async def report_db(
    observed_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    @asynccontextmanager
    async def context() -> AsyncIterator[AsyncSession]:
        async with observed_db() as session:
            yield session

    monkeypatch.setattr(report, 'get_async_db_context', context)
    yield observed_db


def row(result: report.ScopeMailReport, kind: str = 'welcome') -> report.ScopeMailType:
    return next(item for item in result.types if item.type == kind)


async def complete(scope_id: str, now: int, mode: Literal['observe', 'dispatch'] = 'dispatch') -> None:
    page = await observer.observe_scope_page(scope_id, now=now, mode=mode)
    assert page.completed


async def ready(
    db: async_sessionmaker[AsyncSession],
    kind: queue.EmailType,
    age: int,
) -> tuple[str, str]:
    now = int(time.time())
    async with db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now - age * DAY))
        if kind == 'paid_value_72h':
            session.add(
                TaskSuccess(
                    user_id='1', operation_id='success', kind='foreground_chat', source='saved_chat', completed_at=now
                )
            )
        await session.commit()
    if kind == 'activation_24h':
        welcome = await queue_tests.enqueue(db)
        async with db() as session:
            await session.execute(
                update(queue.EmailDelivery)
                .where(queue.EmailDelivery.id == welcome)
                .values(
                    status='accepted',
                    accepted_at=now - 2 * DAY,
                    submitted_at=now - 2 * DAY,
                )
            )
            await session.commit()
    payment = 'payment' if kind in observer.PAYMENT_TYPES else None
    if payment:
        await queue_tests.payment_fact(
            db,
            payment,
            'succeeded' if kind == 'topup_credited' else 'canceled',
            now - age * DAY,
            credit=kind == 'topup_credited',
        )
    config = await dispatch_tests.configuration(db, now, ('1', '2'))
    await preferences.set_product_preference('2', False, 'settings')
    job = await dispatch_tests.insert(db, config, kind, now, payment)
    assert job is not None
    await complete(config.observation_scope_id, now)
    return config.observation_scope_id, job


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
async def test_six_independent_gold_counts_match_positive_negative_and_exact_acceptance(
    report_db: async_sessionmaker[AsyncSession],
    kind: queue.EmailType,
    age: int,
) -> None:
    scope, job = await ready(report_db, kind, age)
    now = int(time.time())
    async with report_db() as session:
        await session.execute(
            update(queue.EmailDelivery)
            .where(queue.EmailDelivery.id == job)
            .values(
                status='accepted',
                accepted_at=now,
                submitted_at=now,
            )
        )
        await session.commit()
    result = await report.scope_mail_report(scope)
    assert result.coverage.state == 'complete_traversal' and result.coverage.visited_members == 2
    assert len(result.types) == 6
    item = row(result, kind)
    assert item.observed_eligible_accounts == item.observed_eligible_scenarios == 1
    assert item.queue.queued_jobs == item.queue.queued_accounts == item.queue.states_now['accepted'] == 1
    assert item.accepted_over_observed_accounts.fraction == item.accepted_over_observed_scenarios.fraction == 1
    assert all(sum(item.queue.states_now.values()) == item.queue.queued_jobs for item in result.types)
    assert item.queue.receipt_coverage == 'unavailable' and item.queue.delivered_over_accepted_fraction is None
    assert 'person1@airis.you' not in result.model_dump_json()
    for key in ['payment_id', 'member_id', 'delivery_id', 'scenario_key', 'claim_id']:
        assert key not in result.model_dump_json()


@pytest.mark.asyncio
async def test_worker_fact_never_proves_population_coverage(report_db: async_sessionmaker[AsyncSession]) -> None:
    config = await dispatch_tests.configuration(report_db, int(time.time()))
    assert await dispatch_tests.insert(report_db, config, 'welcome', int(time.time()))
    result = await report.scope_mail_report(config.observation_scope_id)
    item = row(result)
    assert item.observed_eligible_accounts == 1 and item.queue.queued_jobs == 1
    assert result.coverage.state == 'partial' and result.coverage.visited_members == 0
    assert item.accepted_over_observed_accounts.denominator is item.accepted_over_observed_accounts.fraction is None


@pytest.mark.asyncio
async def test_future_scheduled_receipt_keeps_known_zero_distinct_from_unknown(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    async with report_db() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=now))
        await session.commit()
    config = await dispatch_tests.configuration(report_db, now)
    assert await dispatch_tests.insert(report_db, config, 'feedback_14d', now)
    await complete(config.observation_scope_id, now)
    item = row(await report.scope_mail_report(config.observation_scope_id), 'feedback_14d')
    assert item.queue.queued_jobs == 1 and item.observed_eligible_scenarios == 0
    assert item.accepted_over_observed_scenarios.denominator == 0
    assert item.accepted_over_observed_scenarios.fraction is None
    assert item.accepted_over_observed_scenarios.unavailable_reason == 'zero_observed_denominator'


@pytest.mark.asyncio
async def test_late_optout_and_suppression_preserve_first_positive(report_db: async_sessionmaker[AsyncSession]) -> None:
    scope, job = await ready(report_db, 'welcome', 0)
    await preferences.set_product_preference('1', False, 'settings')
    item = row(await report.scope_mail_report(scope))
    assert item.observed_eligible_accounts == 1
    assert item.queue.states_now['suppressed'] == 1 and item.queue.reasons_now[0].reason == 'consent'
    assert item.accepted_over_observed_accounts.fraction == 0


@pytest.mark.asyncio
@pytest.mark.parametrize('accepted', [1, 2])
async def test_two_payments_are_two_scenarios_and_one_person(
    report_db: async_sessionmaker[AsyncSession],
    accepted: int,
) -> None:
    now = int(time.time())
    for name in ['p1', 'p2']:
        await queue_tests.payment_fact(report_db, name, 'succeeded', now - 3 * DAY, credit=True)
    config = await dispatch_tests.configuration(report_db, now)
    jobs = [await dispatch_tests.insert(report_db, config, 'topup_credited', now, name) for name in ['p1', 'p2']]
    await complete(config.observation_scope_id, now)
    async with report_db() as session:
        for job in jobs[:accepted]:
            await session.execute(
                update(queue.EmailDelivery)
                .where(queue.EmailDelivery.id == job)
                .values(status='accepted', accepted_at=now, submitted_at=now)
            )
        await session.commit()
    item = row(await report.scope_mail_report(config.observation_scope_id), 'topup_credited')
    assert item.observed_eligible_accounts == 1 and item.observed_eligible_scenarios == 2
    assert item.queue.queued_jobs == 2 and item.queue.queued_accounts == 1
    assert item.accepted_over_observed_accounts.fraction == 1
    assert item.accepted_over_observed_scenarios.fraction == accepted / 2


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['delivery', 'user', 'payment'])
async def test_lost_sources_keep_observed_counts_but_make_fraction_unknown(
    report_db: async_sessionmaker[AsyncSession],
    change: str,
) -> None:
    scope, job = await ready(
        report_db, 'topup_credited' if change == 'payment' else 'welcome', 3 if change == 'payment' else 0
    )
    async with report_db() as session:
        if change == 'delivery':
            await session.execute(delete(queue.EmailDelivery).where(queue.EmailDelivery.id == job))
        elif change == 'user':
            await session.execute(delete(User).where(User.id == '1'))
        else:
            await session.execute(delete(Payment).where(Payment.id == 'payment'))
        await session.commit()
    result = await report.scope_mail_report(scope)
    item = row(result, 'topup_credited' if change == 'payment' else 'welcome')
    assert result.coverage.state == 'partial' and item.observed_eligible_accounts == 1
    assert item.accepted_over_observed_accounts.fraction is None


@pytest.mark.asyncio
async def test_new_payment_after_complete_pass_is_unobserved_not_zero(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    scope, _ = await ready(report_db, 'welcome', 0)
    await queue_tests.payment_fact(report_db, 'arrived-after-pass', 'canceled', int(time.time()), credit=False)
    result = await report.scope_mail_report(scope)
    assert result.coverage.unobserved_payment_scenarios == 2 and result.coverage.state == 'partial'
    assert row(result, 'payment_help_72h').accepted_over_observed_scenarios.denominator is None


@pytest.mark.asyncio
async def test_diagnostic_and_unlinked_legacy_acceptance_never_produce_a_dispatch_fraction(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    job = await queue_tests.enqueue(report_db)
    async with report_db() as session:
        await session.execute(
            update(queue.EmailDelivery)
            .where(queue.EmailDelivery.id == job)
            .values(status='accepted', accepted_at=now, submitted_at=now)
        )
        await session.commit()
    scope = await observer_tests.scope(report_db, now)
    await complete(scope, now, mode='observe')
    result = await report.scope_mail_report(scope)
    item = row(result)
    assert result.purpose == 'diagnostic' and item.unlinked_queue_jobs == 1 and item.queue.queued_jobs == 0
    assert (
        item.observed_eligible_accounts == 0
        and item.accepted_over_observed_accounts.unavailable_reason == 'diagnostic_scope'
    )


@pytest.mark.asyncio
async def test_legacy_reason_and_template_cannot_leak_private_text(report_db: async_sessionmaker[AsyncSession]) -> None:
    scope, job = await ready(report_db, 'welcome', 0)
    async with report_db() as session:
        await session.execute(
            update(queue.EmailDelivery)
            .where(queue.EmailDelivery.id == job)
            .values(
                status='failed', reason='private@example.invalid raw-secret', template_version='private-template-secret'
            )
        )
        await session.commit()
    result = await report.scope_mail_report(scope)
    assert 'private' not in result.model_dump_json() and row(result).queue.reasons_now[0].reason == 'unknown'


@pytest.mark.asyncio
async def test_repeated_export_reads_only_and_calls_no_transport_or_observer(
    report_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scope, _ = await ready(report_db, 'welcome', 0)
    forbidden = AsyncMock(side_effect=AssertionError('Report cannot dispatch or observe'))
    monkeypatch.setattr(observer, 'observe_scope_page', forbidden)
    monkeypatch.setattr(worker, 'execute_email', forbidden)
    async with report_db() as session:
        engine = session.bind

    def readonly(
        conn: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: ExecutionContext,
        executemany: bool,
    ) -> None:
        assert statement.split()[0].upper() not in {'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'}

    event.listen(engine.sync_engine, 'before_cursor_execute', readonly)
    try:
        first = await report.scope_mail_report(scope)
        second = await report.scope_mail_report(scope)
        assert first == second
    finally:
        event.remove(engine.sync_engine, 'before_cursor_execute', readonly)
    forbidden.assert_not_called()


@pytest.mark.asyncio
async def test_report_http_admin_only_no_store_validation_and_safe_errors(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    scope, _ = await ready(report_db, 'welcome', 0)
    app = FastAPI()
    app.include_router(routes.router, prefix='/observations')
    async with report_db() as session:
        account = UserModel.model_validate(await session.get(User, '1'), from_attributes=True)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        for role in ['anonymous', 'user', 'admin']:
            app.dependency_overrides.clear()
            if role != 'anonymous':
                app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': role})
            for target, admin_status in [(scope, 200), ('missing', 404), ('private@secret', 422)]:
                response = await client.get(f'/observations/{target}/report')
                assert response.headers['cache-control'] == 'no-store'
                assert response.status_code == admin_status if role == 'admin' else response.status_code in {401, 403}
                assert 'person1@airis.you' not in response.text and 'private@secret' not in response.text
