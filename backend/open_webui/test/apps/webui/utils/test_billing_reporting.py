import os
import time
from decimal import Decimal
from typing import cast

import pytest
from fastapi import HTTPException
from open_webui.utils.airis.billing_reporting import (
    BillingReportingService,
    amount_to_kopeks,
    normalize_range,
    safe_csv_cell,
)
from open_webui.utils.airis.billing_reporting_facts import PaymentFact


@pytest.mark.parametrize('value', [0, '0', Decimal('0'), 250, '250', Decimal('250')])
def test_payment_payload_serializes_aggregated_refund_as_integer(value: object) -> None:
    from fastapi.encoders import jsonable_encoder

    fact = PaymentFact(
        id='payment',
        user_id='customer',
        kind='topup',
        status='succeeded',
        amount_kopeks=1000,
        currency='RUB',
        provider='yookassa',
        provider_payment_id='provider-payment',
        processed_at=100,
        source='billing_payment',
        wallet_id='wallet',
        subscription_id=None,
        # SQL drivers can return Decimal despite the dataclass annotation.
        refunded_kopeks=cast(int, value),
    )
    payload = jsonable_encoder(BillingReportingService._payment_payload(fact))
    assert type(payload['refunded_kopeks']) is int
    assert payload['refunded_kopeks'] == int(str(value))


def test_reporting_usage_retains_saved_breakdown_and_absent_history() -> None:
    from open_webui.models.billing_wallet import UsageEvent

    event = UsageEvent(
        id='usage',
        user_id='customer',
        request_id='request',
        model_id='model',
        modality='text',
        created_at=100,
        prompt_tokens=1234,
        completion_tokens=56,
        measured_units_json={'unit': 'tts_char', 'units': 0, 'tts_seconds': 1.5},
        cost_raw_kopeks=500,
        cost_raw_input_kopeks=400,
        cost_raw_output_kopeks=100,
        cost_charged_kopeks=250,
        cost_charged_input_kopeks=200,
        cost_charged_output_kopeks=50,
        billing_source='payg',
        is_estimated=True,
        estimate_reason='usage_missing',
        pricing_version='historical-version',
        pricing_rate_card_input_id='old-input',
        pricing_rate_card_output_id='old-output',
    )
    payload = BillingReportingService._usage_payload(event)
    for key in (
        'prompt_tokens',
        'completion_tokens',
        'cost_raw_kopeks',
        'cost_raw_input_kopeks',
        'cost_raw_output_kopeks',
        'cost_charged_input_kopeks',
        'cost_charged_output_kopeks',
        'estimate_reason',
        'pricing_version',
        'pricing_rate_card_input_id',
        'pricing_rate_card_output_id',
    ):
        assert payload[key] == getattr(event, key)
    assert payload['measured_units'] == 0
    assert payload['tts_seconds'] == 1.5
    assert payload['measured_unit'] == 'tts_char'
    assert payload['pricing_rate_card_id'] is None
    event.cost_charged_input_kopeks = None
    event.measured_units_json = None
    assert BillingReportingService._usage_payload(event)['cost_charged_input_kopeks'] is None
    assert BillingReportingService._usage_payload(event)['measured_units'] is None


def test_reporting_adjustment_exposes_only_saved_audit_fields() -> None:
    from open_webui.models.billing_wallet import LedgerEntry

    entry = LedgerEntry(
        id='adjustment',
        user_id='customer',
        currency='EUR',
        type='adjustment',
        created_at=100,
        amount_kopeks=-200,
        reference_id='admin-intent',
        reference_type='admin_wallet_adjustment',
        metadata_json={
            'admin_user_id': 'admin',
            'reason': 'Customer correction',
            'delta_topup_kopeks': -300,
            'delta_included_kopeks': 100,
            'private_payload': 'not exported',
        },
    )
    payload = BillingReportingService._ledger_payload(entry)
    assert payload['admin_user_id'] == 'admin'
    assert payload['adjustment_reason'] == 'Customer correction'
    assert payload['delta_topup_kopeks'] == -300
    assert payload['delta_included_kopeks'] == 100
    assert payload['reference_id'] == 'admin-intent'
    assert 'private_payload' not in payload and 'metadata_json' not in payload
    entry.metadata_json = None
    assert BillingReportingService._ledger_payload(entry)['admin_user_id'] is None


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


@pytest.mark.parametrize('refunded_kopeks', [Decimal('0'), Decimal('2500'), Decimal('50000')])
def test_payment_payload_serializes_postgresql_refund_sum_as_integer(refunded_kopeks: Decimal) -> None:
    from fastapi.encoders import jsonable_encoder
    from open_webui.utils.airis.billing_reporting_facts import PaymentFact

    fact = PaymentFact(
        **dict(
            id='payment',
            user_id='user',
            kind='topup',
            status='succeeded',
            amount_kopeks=50000,
            currency='RUB',
            provider='yookassa',
            provider_payment_id='provider-payment',
            processed_at=100,
            source='billing_payment',
            wallet_id=None,
            subscription_id=None,
            refunded_kopeks=refunded_kopeks,
        )
    )
    payload = BillingReportingService._payment_payload(fact)
    assert type(payload['refunded_kopeks']) is int
    assert jsonable_encoder(payload)['refunded_kopeks'] == int(refunded_kopeks)


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
@pytest.mark.parametrize('dialect', ['sqlite', 'postgresql'])
async def test_financial_totals_use_ledger_dates_and_full_selection(
    monkeypatch: pytest.MonkeyPatch, dialect: str
) -> None:
    from open_webui.models.analytics_refunds import AnalyticsRefund
    from open_webui.models.billing_models import Transaction
    from open_webui.models.billing_wallet import LedgerEntry, Payment, UsageEvent, Wallet
    from open_webui.models.users import User
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    database_url = (
        os.getenv('BILLING_REPORTING_TEST_DATABASE_URL', '')
        if dialect == 'postgresql'
        else 'sqlite+aiosqlite:///:memory:'
    )
    if not database_url:
        pytest.skip('Requires a disposable PostgreSQL billing reporting database')
    engine = create_async_engine(database_url)
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
            assert all(type(row['refunded_kopeks']) is int for row in credited)
            assert {row['refunded_kopeks'] for row in credited} == {0, 250}
            assert sum(row['amount_kopeks'] for row in credited) == totals['successful_payments_kopeks']
            from fastapi.encoders import jsonable_encoder

            encoded = jsonable_encoder(credited)
            assert all(type(row['refunded_kopeks']) is int for row in encoded)
            assert {row['id']: row['refunded_kopeks'] for row in encoded} == {'0': 250, '1': 0}

            overview = await service.overview(from_ts=100, to_ts=200, currency='RUB')
            assert overview['series'] == [
                {'date': '1970-01-01', 'paid_kopeks': 3000, 'refund_kopeks': 250, 'usage_kopeks': 400}
            ]
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
            assert detail['refunds'][0]['id'] == 'r'  # The persisted ID is the verified provider refund ID.
            assert detail['refunds'][0]['payment_id'] == '0'
            original, original_total = await service.payment_page(
                from_ts=200,
                to_ts=300,
                currency='RUB',
                user_id='u',
                status=None,
                kind=None,
                page=1,
                page_size=10,
                payment_id='0',
            )
            assert original_total == 1 and original[0]['id'] == '0'
            unrelated, unrelated_total = await service.payment_page(
                from_ts=100,
                to_ts=200,
                currency='RUB',
                user_id='someone-else',
                status=None,
                kind=None,
                page=1,
                page_size=10,
                payment_id='0',
            )
            assert unrelated_total == 0 and unrelated == []
            related, related_total = await service.ledger_rows(
                from_ts=200,
                to_ts=300,
                currency='RUB',
                user_id='u',
                limit=10,
                offset=0,
                reference_id='p0',
            )
            assert related_total == 1 and related[0]['id'] == 'l0'
            other_records, other_total = await service.ledger_rows(
                from_ts=100,
                to_ts=200,
                currency='RUB',
                user_id='someone-else',
                limit=10,
                offset=0,
                reference_id='p0',
            )
            assert other_total == 0 and other_records == []
            # The visible period columns must sort by the period, even when lifetime order differs.
            session.add(User(id='u2', name='Boris', email='boris@example.test'))
            session.add(Wallet(id='w2', user_id='u2', currency='RUB', created_at=50, updated_at=50))
            for index, (amount, stamp) in enumerate([(2000, 150), (10000, 250)]):
                session.add(
                    Payment(
                        id=f'sort-{index}',
                        user_id='u2',
                        wallet_id='w2',
                        currency='RUB',
                        kind='topup',
                        status='succeeded',
                        provider='yookassa',
                        provider_payment_id=f'sort-provider-{index}',
                        amount_kopeks=amount,
                        created_at=stamp,
                        updated_at=stamp,
                    )
                )
                session.add(
                    LedgerEntry(
                        id=f'sort-ledger-{index}',
                        user_id='u2',
                        wallet_id='w2',
                        currency='RUB',
                        type='topup',
                        amount_kopeks=amount,
                        balance_topup_after=amount,
                        balance_included_after=0,
                        reference_id=f'sort-provider-{index}',
                        reference_type='payment',
                        created_at=stamp,
                    )
                )
            for index, (amount, stamp) in enumerate([(100, 150), (1000, 250)]):
                session.add(
                    UsageEvent(
                        id=f'sort-usage-{index}',
                        user_id='u2',
                        wallet_id='w2',
                        request_id=f'sort-request-{index}',
                        model_id='model',
                        modality='text',
                        cost_charged_kopeks=amount,
                        created_at=stamp,
                    )
                )
            await session.commit()
            for sort in ('paid', 'spent'):
                for direction, expected in (
                    ('desc', ['u', 'u2']),
                    ('asc', ['u2', 'u']),
                ):
                    ordered = await service.customers(
                        from_ts=100,
                        to_ts=200,
                        currency='RUB',
                        query=None,
                        page=1,
                        page_size=10,
                        sort=sort,
                        direction=direction,
                    )
                    assert [row['user_id'] for row in ordered['items']] == expected
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('credit_delay_seconds', [0, 1])
async def test_midnight_topup_reconciles_adjacent_days_and_combined_range(
    monkeypatch: pytest.MonkeyPatch, credit_delay_seconds: int
) -> None:
    from open_webui.models.analytics_refunds import AnalyticsRefund
    from open_webui.models.billing_models import Transaction
    from open_webui.models.billing_wallet import LedgerEntry, Payment, UsageEvent, Wallet
    from open_webui.models.users import User
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    # 1970-01-02 23:59:59 UTC: provider succeeds before the ledger's UTC day.
    provider_at = 2 * 86400 - 1
    midnight = 2 * 86400
    credited_at = midnight + credit_delay_seconds
    monkeypatch.setattr('open_webui.utils.airis.billing_reporting.time.time', lambda: 4 * 86400)
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            for model in (User, Wallet, Payment, Transaction, LedgerEntry, AnalyticsRefund, UsageEvent):
                await connection.run_sync(model.__table__.create)
        async with AsyncSession(engine) as session:
            session.add(User(id='u', name='Anna', email='anna@example.test'))
            session.add(Wallet(id='w', user_id='u', currency='RUB', created_at=provider_at, updated_at=credited_at))
            session.add(
                Payment(
                    id='midnight-payment',
                    user_id='u',
                    wallet_id='w',
                    currency='RUB',
                    kind='topup',
                    status='succeeded',
                    provider='yookassa',
                    provider_payment_id='provider-midnight',
                    amount_kopeks=50000,
                    created_at=provider_at,
                    updated_at=provider_at,
                    raw_payload_json={'test': False, 'created_at': '1970-01-02T23:59:59Z'},
                )
            )
            session.add(
                LedgerEntry(
                    id='midnight-credit',
                    user_id='u',
                    wallet_id='w',
                    currency='RUB',
                    type='topup',
                    amount_kopeks=50000,
                    balance_topup_after=50000,
                    balance_included_after=0,
                    reference_id='provider-midnight',
                    reference_type='payment',
                    created_at=credited_at,
                )
            )
            await session.commit()
            service = BillingReportingService(session)
            selections = []
            paid_totals = []
            for start, end, expected_count in (
                (86400, midnight, 0),
                (midnight, 3 * 86400, 1),
                (86400, 3 * 86400, 1),
            ):
                overview = await service.overview(from_ts=start, to_ts=end, currency='RUB')
                rows, total = await service.payment_page(
                    from_ts=start,
                    to_ts=end,
                    currency='RUB',
                    user_id='u',
                    status='succeeded',
                    kind='topup',
                    credit_status='credited',
                    is_test=False,
                    page=1,
                    page_size=100,
                )
                assert overview['timezone'] == 'UTC'
                assert (overview['from'], overview['to']) == (start, end)
                assert total == len(rows) == expected_count
                metrics = overview['metrics']
                assert metrics['successful_payment_count'] == expected_count
                assert metrics['successful_payments_kopeks'] == sum(row['amount_kopeks'] for row in rows)
                assert metrics['net_kopeks'] == expected_count * 50000
                assert overview['series'] == (
                    [{'date': '1970-01-03', 'paid_kopeks': 50000, 'refund_kopeks': 0, 'usage_kopeks': 0}]
                    if expected_count
                    else []
                )
                if rows:
                    assert rows[0]['id'] == 'midnight-payment'
                    assert rows[0]['status'] == 'succeeded'
                    assert rows[0]['credit_status'] == 'credited'
                    assert rows[0]['created_at'] == provider_at < midnight
                    assert rows[0]['credited_at'] == rows[0]['processed_at'] == credited_at >= midnight
                selections.append(rows)
                paid_totals.append(metrics['successful_payments_kopeks'])
            assert selections[0] + selections[1] == selections[2]
            assert paid_totals[0] + paid_totals[1] == paid_totals[2] == 50000
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


@pytest.mark.asyncio
async def test_related_records_require_customer_scope() -> None:
    from open_webui.routers.admin_billing_reporting import (
        get_reporting_ledger,
        get_reporting_payments,
    )

    for call in (
        get_reporting_payments(from_ts=1, to_ts=2, user_id=None, payment_id='p'),
        get_reporting_ledger(from_ts=1, to_ts=2, user_id=None, reference_id='request'),
    ):
        with pytest.raises(HTTPException) as error:
            await call
        assert error.value.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize('dataset', ['payment', 'ledger'])
async def test_related_record_api_preserves_customer_and_reports_history_scope(
    monkeypatch: pytest.MonkeyPatch, dataset: str
) -> None:
    import open_webui.routers.admin_billing_reporting as reporting_router

    class FakeService:
        def __init__(self, _session: object) -> None:
            pass

        async def payment_page(self, **kwargs: object) -> tuple[list[dict[str, object]], int]:
            assert kwargs['from_ts'] == 0 and kwargs['to_ts'] == 100001
            assert kwargs['user_id'] == 'customer'
            assert kwargs['currency'] == 'RUB'
            assert kwargs['payment_id'] == 'original-payment'
            return [{'id': 'original-payment'}], 1

        async def ledger_rows(self, **kwargs: object) -> tuple[list[dict[str, object]], int]:
            assert kwargs['from_ts'] == 0 and kwargs['to_ts'] == 100001
            assert kwargs['user_id'] == 'customer'
            assert kwargs['currency'] == 'RUB'
            assert kwargs['reference_id'] == 'usage-request'
            return [{'id': 'matching-ledger'}], 1

    monkeypatch.setattr(reporting_router, 'BillingReportingService', FakeService)
    monkeypatch.setattr(reporting_router.time, 'time', lambda: 100000)
    common = dict(
        currency='RUB',
        from_ts=90000,
        to_ts=99000,
        user_id='customer',
        page=1,
        page_size=50,
        _=object(),
        session=object(),
    )
    if dataset == 'payment':
        result = await reporting_router.get_reporting_payments(
            **common,
            status=None,
            kind=None,
            older_than_hours=None,
            payment_id='original-payment',
        )
    else:
        result = await reporting_router.get_reporting_ledger(**common, reference_id='usage-request')
    assert result['scope'] == 'lifetime_current'
    assert result['from'] == 0 and result['to'] == 100001
    assert result['total'] == 1
