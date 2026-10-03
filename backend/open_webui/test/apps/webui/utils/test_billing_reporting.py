import time

import pytest
from fastapi import HTTPException
from open_webui.utils.airis.billing_reporting import (
    BillingReportingService,
    amount_to_kopeks,
    normalize_range,
    safe_csv_cell,
)


@pytest.mark.asyncio
@pytest.mark.parametrize('store', ['payment', 'transaction'])
async def test_payment_reporting_includes_profile_name_and_retains_deleted_users(
    store: str,
) -> None:
    from open_webui.models.analytics_refunds import AnalyticsRefund
    from open_webui.models.billing_models import Transaction
    from open_webui.models.billing_wallet import LedgerEntry, Payment
    from open_webui.models.users import User
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            for model in (User, Payment, Transaction, LedgerEntry, AnalyticsRefund):
                await connection.run_sync(model.__table__.create)
        async with AsyncSession(engine) as session:
            session.add(User(id='customer', name='Иван Петров', email='customer@example.com'))
            for user_id in ('customer', 'deleted'):
                fields = dict(
                    id=user_id,
                    user_id=user_id,
                    status='succeeded',
                    currency='RUB',
                    created_at=100,
                    updated_at=100,
                )
                session.add(
                    Payment(**fields, provider='yookassa', kind='topup', amount_kopeks=50000)
                    if store == 'payment'
                    else Transaction(**fields, amount=500)
                )
            await session.commit()
            service = BillingReportingService(session)
            facts = await service.payment_facts(from_ts=1, to_ts=200, currency='RUB')
            payloads = {fact.user_id: service._payment_payload(fact) for fact in facts}
            assert payloads['customer']['name'] == 'Иван Петров'
            assert payloads['deleted']['name'] is None
            assert all(row['amount_kopeks'] == 50000 for row in payloads.values())
            assert len(payloads) == 2
    finally:
        await engine.dispose()


def test_amount_to_kopeks_uses_decimal_conversion() -> None:
    assert amount_to_kopeks('12.34') == 1234
    assert amount_to_kopeks('0.10') == 10


def test_normalize_range_defaults_and_rejects_large_ranges() -> None:
    start, end = normalize_range(100, 200)
    assert (start, end) == (100, 200)

    try:
        now = int(time.time())
        normalize_range(now - 367 * 86400, now)
    except ValueError as error:
        assert '366 days' in str(error)
    else:
        raise AssertionError('expected oversized reporting range to fail')


def test_safe_csv_cell_blocks_formula_execution() -> None:
    assert safe_csv_cell('=SUM(A1)') == "'=SUM(A1)"
    assert safe_csv_cell('+100') == "'+100"
    assert safe_csv_cell('\t=SUM(A1)') == "'\t=SUM(A1)"
    assert safe_csv_cell('\v=SUM(A1)') == "'\v=SUM(A1)"
    assert safe_csv_cell('\ufeff-100') == "'\ufeff-100"
    assert safe_csv_cell('customer@example.com') == 'customer@example.com'


@pytest.mark.asyncio
async def test_reporting_payments_uses_complete_sql_count(monkeypatch: pytest.MonkeyPatch) -> None:
    import open_webui.routers.admin_billing_reporting as reporting_router

    class FakeService:
        def __init__(self, _session: object) -> None:
            pass

        async def payment_page(self, **kwargs: object) -> tuple[list[dict[str, object]], int]:
            assert kwargs['page'] == 1
            assert kwargs['page_size'] == 50
            assert 'limit' not in kwargs
            return [{'id': f'payment-{index}'} for index in range(50)], 50001

    monkeypatch.setattr(reporting_router, 'BillingReportingService', FakeService)
    result = await reporting_router.get_reporting_payments(
        currency='RUB',
        from_ts=1,
        to_ts=200,
        user_id=None,
        status=None,
        kind=None,
        credit_status=None,
        older_than_hours=None,
        page=1,
        page_size=50,
        _=object(),
        session=object(),
    )
    assert result['total'] == 50001
    assert result['total_pages'] == 1001
    assert result['truncated'] is False
    assert len(result['items']) == 50


@pytest.mark.asyncio
async def test_reporting_export_requires_customer_scope_for_sensitive_datasets() -> None:
    import open_webui.routers.admin_billing_reporting as reporting_router

    for dataset in ('ledger', 'usage'):
        with pytest.raises(HTTPException) as error:
            await reporting_router.export_reporting_data(
                dataset=dataset,
                currency='RUB',
                from_ts=1,
                to_ts=200,
                user_id=None,
                status=None,
                kind=None,
                _=object(),
                session=object(),
            )
        assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_financial_totals_use_ledger_dates_and_full_selection(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.models.analytics_refunds import AnalyticsRefund
    from open_webui.models.billing_models import Transaction
    from open_webui.models.billing_wallet import LedgerEntry, Payment, UsageEvent, Wallet
    from open_webui.models.users import User
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            for model in (User, Wallet, Payment, Transaction, LedgerEntry, AnalyticsRefund, UsageEvent):
                await connection.run_sync(model.__table__.create)
        async with AsyncSession(engine) as session:
            session.add(User(id='u', name='Anna', email='anna@example.test'))
            session.add(
                Wallet(id='w', user_id='u', currency='RUB', balance_topup_kopeks=999, created_at=50, updated_at=50)
            )
            for index, (amount, stamp, test, matched) in enumerate(
                [
                    (1000, 100, False, True),
                    (2000, 199, False, True),
                    (3000, 200, False, True),
                    (4000, 150, True, True),
                    (5000, 150, False, False),
                ]
            ):
                session.add(
                    Payment(
                        id=str(index),
                        user_id='u',
                        wallet_id='w',
                        currency='RUB',
                        kind='topup',
                        status='succeeded',
                        provider='yookassa',
                        provider_payment_id='p' + str(index),
                        amount_kopeks=amount,
                        created_at=50,
                        updated_at=250,
                        raw_payload_json={'test': test},
                    )
                )
                session.add(
                    LedgerEntry(
                        id='l' + str(index),
                        user_id='u',
                        wallet_id='w',
                        currency='RUB',
                        type='topup',
                        amount_kopeks=amount if matched else amount - 1,
                        balance_topup_after=amount,
                        balance_included_after=0,
                        reference_id='p' + str(index),
                        reference_type='payment',
                        created_at=stamp,
                    )
                )
            session.add(
                Payment(
                    id='subscription',
                    user_id='u',
                    currency='RUB',
                    kind='subscription',
                    status='succeeded',
                    provider='yookassa',
                    provider_payment_id='sub-provider',
                    amount_kopeks=700,
                    created_at=150,
                    updated_at=150,
                )
            )
            # A migrated legacy duplicate with a different timestamp must not reappear after filtering.
            session.add(
                Transaction(
                    id='duplicate',
                    user_id='u',
                    currency='RUB',
                    status='succeeded',
                    yookassa_payment_id='sub-provider',
                    amount=7,
                    created_at=120,
                    updated_at=120,
                )
            )
            session.add(
                AnalyticsRefund(id='r', payment_id='0', user_id='u', currency='RUB', amount_kopeks=250, occurred_at=160)
            )
            session.add(
                UsageEvent(
                    id='usage',
                    user_id='u',
                    wallet_id='w',
                    request_id='req',
                    model_id='model',
                    modality='text',
                    cost_charged_kopeks=400,
                    created_at=170,
                )
            )
            await session.commit()
            service = BillingReportingService(session)
            monkeypatch.setattr('open_webui.utils.airis.billing_reporting.REPORTING_EXPORT_MAX', 1)
            totals = await service.financial_totals(from_ts=100, to_ts=200, currency='RUB')
            assert totals['successful_payments_kopeks'] == 3000
            assert totals['successful_payment_count'] == 2
            assert totals['refund_kopeks'] == 250
            assert totals['net_kopeks'] == 2750
            assert totals['usage_spend_kopeks'] == 400
            assert totals['other_payments_kopeks'] == 700
            page, total = await service.payment_page(
                from_ts=100, to_ts=200, currency='RUB', user_id=None, status=None, kind=None, page=1, page_size=1
            )
            assert total == 4  # three credited topups including a test, plus subscription
            assert len(page) == 1
            credited, credited_total = await service.payment_page(
                from_ts=100,
                to_ts=200,
                currency='RUB',
                user_id=None,
                status='succeeded',
                kind='topup',
                credit_status='credited',
                is_test=False,
                page=1,
                page_size=100,
            )
            assert credited_total == 2
            assert sum(row['amount_kopeks'] for row in credited) == totals['successful_payments_kopeks']

            overview = await service.overview(from_ts=100, to_ts=200, currency='RUB')
            assert overview['series'][0]['paid_kopeks'] == 3000
            customers = await service.customers(
                from_ts=100,
                to_ts=200,
                currency='RUB',
                query='Anna',
                page=1,
                page_size=10,
                sort='paid',
                direction='desc',
                status='paid',
            )
            assert customers['items'][0]['period_paid_kopeks'] == 3000
            assert customers['items'][0]['paid_kopeks'] == 6000
            assert customers['items'][0]['period_refund_kopeks'] == 250
            detail = await service.customer_detail(user_id='u', from_ts=100, to_ts=200, currency='RUB', limit=1)
            assert detail['metrics']['period_paid_kopeks'] == 3000
            assert detail['metrics']['paid_kopeks'] == 6000
            assert detail['record_totals']['payments'] == 4
            assert detail['refunds'][0]['wallet_reflection'] == 'requires_verification'
    finally:
        await engine.dispose()


def test_range_half_open_and_half_up_rounding() -> None:
    assert normalize_range(0, 100) == (0, 100)
    with pytest.raises(ValueError):
        normalize_range(100, 100)
    assert amount_to_kopeks('0.005') == 1


@pytest.mark.asyncio
async def test_attention_list_uses_same_current_scope_as_warning(monkeypatch: pytest.MonkeyPatch) -> None:
    import open_webui.routers.admin_billing_reporting as reporting_router

    class FakeService:
        def __init__(self, _session: object) -> None:
            pass

        async def payment_page(self, **kwargs: object) -> tuple[list[dict[str, object]], int]:
            assert kwargs['from_ts'] == 0
            assert kwargs['to_ts'] == 100001
            assert kwargs['status'] == 'pending'
            assert kwargs['older_than'] == 13600
            return [{'id': 'older-warning'}], 1

    monkeypatch.setattr(reporting_router, 'BillingReportingService', FakeService)
    monkeypatch.setattr(reporting_router.time, 'time', lambda: 100000)
    result = await reporting_router.get_reporting_payments(
        currency='RUB',
        from_ts=90000,
        to_ts=99000,
        user_id=None,
        status=None,
        kind=None,
        page=1,
        page_size=50,
        credit_status=None,
        attention='stale_pending',
        older_than_hours=None,
        _=object(),
        session=object(),
    )
    assert result['scope'] == 'lifetime_current'
    assert result['items'] == [{'id': 'older-warning'}]
