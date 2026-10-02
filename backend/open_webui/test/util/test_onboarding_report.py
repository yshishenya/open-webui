"""Controlled report counts, exact windows, credit proof and protected export."""

import datetime as dt
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from open_webui.models import task_success
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import EmailDelivery, enqueue_email
from open_webui.models.email_preferences import EmailPreferenceEvent, email_fingerprint, set_product_preference
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User, UserModel
from open_webui.routers.airis import email_delivery as routes
from open_webui.utils.airis import onboarding_report as report
from open_webui.utils.airis.email_scenarios import DAY
from open_webui.utils.auth import get_current_user
from sqlalchemy import update
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests

queue_database = queue_tests.database
NOW = 1793491200
REGISTERED = NOW - 14 * DAY
START = NOW - 30 * DAY


@pytest_asyncio.fixture
async def database(
    queue_database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    monkeypatch.setattr(report, 'get_async_db_context', routes.get_async_db_context)
    monkeypatch.setattr(task_success, 'get_async_db_context', routes.get_async_db_context)
    async with queue_database() as db:
        await db.execute(update(User).where(User.id == '1').values(created_at=REGISTERED))
        await db.execute(update(User).where(User.id == '2').values(created_at=NOW - DAY + 1))
        await db.commit()
    yield queue_database


async def snapshot() -> report.RegistrationReport:
    return await report.registration_report(START, NOW + 1, START, NOW, ZoneInfo('UTC'), frozenset())


async def success(uid: str, operation: str, at: int) -> None:
    await task_success.insert_success(
        uid, {'operation_id': operation, 'kind': 'foreground_chat', 'completed_at': at, 'source': 'temporary_chat'}
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'window,field', [(DAY, 'first_success_24h'), (7 * DAY, 'return_7d'), (14 * DAY, 'paid_users_14d')]
)
@pytest.mark.parametrize('offset', [0, 1])
async def test_maturity_at_exact_snapshot_boundary(
    database: async_sessionmaker[AsyncSession], window: int, field: str, offset: int
) -> None:
    async with database() as db:
        await db.execute(update(User).where(User.id == '2').values(created_at=NOW - window + offset))
        await db.commit()
    cohort = next(
        row
        for row in (await snapshot()).cohorts
        if row.date == report.calendar_date(NOW - window + offset, ZoneInfo('UTC'))
    )
    # At 14d both fixtures share a cohort: account 1 remains fully mature.
    expected = (1 if window == 14 * DAY else 0) + int(offset == 0)
    assert getattr(cohort, field).denominator == expected


@pytest.mark.asyncio
async def test_population_limit_never_silently_truncates(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(report, 'MAX_ACCOUNTS', 1)
    with pytest.raises(OverflowError):
        await snapshot()


@pytest.mark.asyncio
async def test_empty_immature_counts_and_explicit_population_exclusions(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as db:
        for uid, role, at in [('admin', 'admin', REGISTERED), ('test', 'user', REGISTERED), ('old', 'user', START)]:
            db.add(User(id=uid, name='Test', email=f'{uid}@airis.you', role=role, created_at=at))
        await db.execute(update(Auth).where(Auth.id == '1').values(active=False))
        await db.commit()
    result = await report.registration_report(START, NOW + 1, START + 1, NOW, ZoneInfo('UTC'), frozenset({'test'}))
    assert result.registrations == 2
    assert result.exclusions == {'non_user_role': 1, 'explicit_test_account': 1, 'before_observation_start': 1}
    mature, immature = result.cohorts
    assert mature.product_eligible_now == 0 and mature.eligibility_reasons_now == {'inactive_account': 1}
    assert mature.first_success_24h.denominator == 1 and mature.first_success_24h.fraction == 0
    assert mature.paid_users_14d.denominator == 1
    assert immature.first_success_24h.denominator == 0 and immature.first_success_24h.fraction is None
    assert immature.first_success_24h.immature == 1 and immature.first_success_24h.small_sample
    assert result.delivered is None and result.useful_response is None and result.email_clicks is None
    empty = await report.registration_report(NOW, NOW + 1, NOW, NOW, ZoneInfo('UTC'), frozenset())
    assert empty.registrations == 0 and empty.cohorts == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'offset,within_day,within_week', [(DAY - 1, 1, 1), (DAY, 0, 1), (7 * DAY - 1, 0, 1), (7 * DAY, 0, 0)]
)
async def test_success_half_open_boundaries_and_replay(
    database: async_sessionmaker[AsyncSession], offset: int, within_day: int, within_week: int
) -> None:
    await success('1', 'operation', REGISTERED + offset)
    await success('1', 'operation', REGISTERED + offset)
    async with database() as db:
        db.add(
            TaskSuccess(
                user_id='1', operation_id='background', kind='background', completed_at=REGISTERED, source='api'
            )
        )
        await db.commit()
    cohort = (await snapshot()).cohorts[0]
    assert cohort.first_success_24h.count == within_day
    assert cohort.first_success_7d.count == within_week
    assert cohort.return_7d.count == 0


@pytest.mark.asyncio
async def test_calendar_return_timezone_same_day_and_outside_window(database: async_sessionmaker[AsyncSession]) -> None:
    day = int(dt.datetime(2026, 10, 18, 23, 30, tzinfo=ZoneInfo('UTC')).timestamp())
    await success('1', 'first', day)
    await success('1', 'second', day + 3600)
    await success('1', 'outside', REGISTERED + 7 * DAY)
    utc = await snapshot()
    local = await report.registration_report(START, NOW + 1, START, NOW, ZoneInfo('Europe/Istanbul'), frozenset())
    assert utc.cohorts[0].return_7d.count == 1
    assert local.cohorts[0].return_7d.count == 0  # Both local events fall on October 19.
    await success('1', 'next-local-day', day + DAY)
    local = await report.registration_report(START, NOW + 1, START, NOW, ZoneInfo('Europe/Istanbul'), frozenset())
    assert local.cohorts[0].return_7d.count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('offset,expected', [(14 * DAY - 1, 1), (14 * DAY, 0), (-1, 0)])
async def test_payment_credit_time_half_open_and_proof(
    database: async_sessionmaker[AsyncSession], offset: int, expected: int
) -> None:
    credit_at = REGISTERED + offset
    await queue_tests.payment_fact(database, 'valid', 'succeeded', REGISTERED, credit=True)
    await queue_tests.payment_fact(database, 'canceled', 'canceled', REGISTERED + 1, credit=True)
    await queue_tests.payment_fact(database, 'provider-only', 'succeeded', REGISTERED + 2)
    await queue_tests.payment_fact(database, 'wrong-amount', 'succeeded', REGISTERED + 3, credit=True)
    await queue_tests.payment_fact(database, 'wrong-currency', 'succeeded', REGISTERED + 4, credit=True)
    await queue_tests.payment_fact(database, 'no-provider-proof', 'succeeded', REGISTERED + 5, credit=True)
    async with database() as db:
        await db.execute(update(LedgerEntry).where(LedgerEntry.id == 'credit-valid').values(created_at=credit_at))
        await db.execute(update(LedgerEntry).where(LedgerEntry.id == 'credit-wrong-amount').values(amount_kopeks=1))
        await db.execute(update(LedgerEntry).where(LedgerEntry.id == 'credit-wrong-currency').values(currency='USD'))
        await db.execute(update(Payment).where(Payment.id == 'no-provider-proof').values(status_details={}))
        await db.commit()
    result = (await snapshot()).cohorts[0]
    assert result.paid_users_14d.count == expected
    assert result.confirmed_payments_14d_mature == expected
    assert result.paid_users_14d.denominator == 1


@pytest.mark.asyncio
async def test_distinct_paid_users_vs_payment_count_and_immature_payments(
    database: async_sessionmaker[AsyncSession],
) -> None:
    for payment in ['one', 'two', 'immature']:
        await queue_tests.payment_fact(database, payment, 'succeeded', NOW - 1, credit=True)
    async with database() as db:
        await db.execute(update(Payment).where(Payment.id == 'immature').values(user_id='2'))
        await db.execute(update(LedgerEntry).where(LedgerEntry.id == 'credit-immature').values(user_id='2'))
        await db.commit()
    mature, immature = (await snapshot()).cohorts
    assert mature.paid_users_14d.count == 1 and mature.confirmed_payments_14d_mature == 2
    assert immature.paid_users_14d.denominator == 0 and immature.paid_users_14d.fraction is None
    assert immature.confirmed_payments_14d_mature == 0


@pytest.mark.asyncio
async def test_current_consent_suppression_and_mail_outcomes_do_not_invent_delivery(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as db:
        job = await enqueue_email(db, '1', 'welcome', 'onboarding_v1', REGISTERED, NOW)
        await db.execute(
            update(EmailDelivery).where(EmailDelivery.id == job).values(status='accepted', accepted_at=NOW - 1)
        )
        await db.execute(update(User).where(User.id == '2').values(email='changed@airis.you'))
        db.add(
            EmailPreferenceEvent(
                id='bounce',
                user_id='1',
                email_hash=email_fingerprint('person1@airis.you'),
                action='hard_bounce',
                consent_version='test',
                source='test',
                created_at=NOW - 1,
            )
        )
        await db.commit()
    mature, changed = (await snapshot()).cohorts
    assert mature.consent_segment == 'current_opt_in' and mature.product_eligible_now == 0
    assert mature.eligibility_reasons_now == {'suppressed_address': 1}
    assert mature.welcome_accepted_registrations == 1
    assert mature.mail_outcomes[0].status == 'accepted' and mature.mail_outcomes[0].delivery_receipts == 0
    assert changed.consent_segment == 'no_current_opt_in' and changed.eligibility_reasons_now == {'no_consent': 1}
    await set_product_preference('1', False, 'settings')
    assert (await snapshot()).cohorts[0].consent_segment == 'no_current_opt_in'


@pytest.mark.asyncio
async def test_report_requires_admin_and_validates_input_without_leaking_content(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(routes.time, 'time', lambda: NOW)
    app = FastAPI()
    app.include_router(routes.router, prefix='/deliveries')
    params = {'start_at': START, 'end_at': NOW + 1, 'observed_from': START, 'timezone': 'UTC'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/deliveries/cohorts', params=params)).status_code in {401, 403}
        async with database() as db:
            account = UserModel.model_validate(await db.get(User, '1'))
        app.dependency_overrides[get_current_user] = lambda: account
        assert (await client.get('/deliveries/cohorts', params=params)).status_code in {401, 403}
        app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': 'admin'})
        result = await client.get('/deliveries/cohorts', params=params)
        assert result.status_code == 200 and result.headers['cache-control'] == 'no-store'
        assert result.json()['version'] == 'registration-v1' and result.json()['registrations'] == 2
        for forbidden in ['person1@airis.you', 'user_id', 'email_hash', 'provider_id', 'payment_id', 'password']:
            assert forbidden not in result.text
        for field, value in [
            ('start_at', 0),
            ('end_at', START),
            ('observed_from', NOW + 1),
            ('timezone', 'Not/AZone'),
            ('timezone', '/etc/passwd'),
            ('exclude_user_id', 'x' * 129),
        ]:
            assert (await client.get('/deliveries/cohorts', params={**params, field: value})).status_code == 422
        fake = AsyncMock(side_effect=OperationalError('statement', {}, Exception('private-provider-marker')))
        monkeypatch.setattr(routes, 'registration_report', fake)
        unavailable = await client.get('/deliveries/cohorts', params=params)
        assert unavailable.status_code == 503 and 'private-provider-marker' not in unavailable.text
        fake.side_effect = TimeoutError()
        assert (await client.get('/deliveries/cohorts', params=params)).status_code == 503
        fake.side_effect = OverflowError()
        assert (await client.get('/deliveries/cohorts', params=params)).status_code == 422
