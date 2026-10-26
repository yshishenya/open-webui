"""Exercise real CSV responses against disposable synthetic reporting data."""

import csv
import io
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from open_webui.internal.db import get_async_session
from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing_models import Transaction
from open_webui.models.billing_wallet import LedgerEntry, Payment, UsageEvent, Wallet
from open_webui.models.users import User
from open_webui.routers import admin_billing_reporting
from open_webui.utils.auth import get_admin_user
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

PREFIX = '/api/v1/admin/billing/reporting'
CUSTOMER_NAME = '=Synthetic, "customer"\nsecond line'
PRIVATE = 'PRIVATE-SYNTHETIC-MARKER'
FILTERS = {'from': 100, 'to': 200, 'currency': 'USD', 'user_id': 'selected'}
ALLOWED_COLUMNS = {
    'payments': {
        'id',
        'user_id',
        'name',
        'kind',
        'status',
        'amount_kopeks',
        'currency',
        'provider',
        'provider_payment_id',
        'processed_at',
        'source',
        'wallet_id',
        'subscription_id',
        'created_at',
        'credited_at',
        'credit_status',
        'refunded_kopeks',
        'is_test',
    },
    'refunds': {
        'id',
        'user_id',
        'name',
        'payment_id',
        'amount_kopeks',
        'currency',
        'occurred_at',
        'wallet_reflection',
    },
    'ledger': {
        'id',
        'user_id',
        'wallet_id',
        'currency',
        'type',
        'amount_kopeks',
        'balance_included_after',
        'balance_topup_after',
        'reference_id',
        'reference_type',
        'correlation_id',
        'admin_user_id',
        'adjustment_reason',
        'delta_topup_kopeks',
        'delta_included_kopeks',
        'created_at',
        'name',
        'email',
    },
    'usage': {
        'id',
        'user_id',
        'request_id',
        'correlation_id',
        'model_id',
        'modality',
        'provider',
        'prompt_tokens',
        'completion_tokens',
        'measured_unit',
        'measured_units',
        'measured_count',
        'requested_count',
        'char_count',
        'tts_seconds',
        'stt_seconds',
        'cost_raw_kopeks',
        'cost_raw_input_kopeks',
        'cost_raw_output_kopeks',
        'cost_charged_kopeks',
        'cost_charged_input_kopeks',
        'cost_charged_output_kopeks',
        'billing_source',
        'is_estimated',
        'estimate_reason',
        'pricing_version',
        'pricing_rate_card_id',
        'pricing_rate_card_input_id',
        'pricing_rate_card_output_id',
        'created_at',
        'name',
        'email',
    },
}


def _add_payment(
    session: AsyncSession,
    identifier: str,
    stamp: int,
    amount: int,
    *,
    owner: str = 'selected',
    currency: str = 'USD',
    status: str = 'succeeded',
    kind: str = 'topup',
    credited: bool = True,
    is_test: bool = False,
) -> None:
    wallet_id = f'{owner}-{currency}'
    session.add(
        Payment(
            id='p-' + identifier,
            user_id=owner,
            wallet_id=wallet_id,
            provider='yookassa',
            provider_payment_id='provider-' + identifier,
            currency=currency,
            kind=kind,
            status=status,
            amount_kopeks=amount,
            created_at=stamp,
            updated_at=stamp,
            idempotency_key=PRIVATE + identifier,
            payment_method_id=PRIVATE,
            metadata_json={'secret': PRIVATE},
            status_details={'secret': PRIVATE},
            raw_payload_json={'test': is_test, 'secret': PRIVATE},
        )
    )
    if credited:
        session.add(
            LedgerEntry(
                id='l-' + identifier,
                user_id=owner,
                wallet_id=wallet_id,
                currency=currency,
                type='topup',
                amount_kopeks=amount,
                balance_topup_after=amount,
                balance_included_after=0,
                reference_type='payment',
                reference_id='provider-' + identifier,
                created_at=stamp,
                idempotency_key=PRIVATE + identifier,
                metadata_json={'secret': PRIVATE},
            )
        )


def _add_records(
    session: AsyncSession,
    identifier: str,
    stamp: int,
    amount: int,
    owner: str = 'selected',
    currency: str = 'USD',
) -> None:
    _add_payment(session, identifier, stamp, amount, owner=owner, currency=currency)
    session.add(
        AnalyticsRefund(
            id='r-' + identifier,
            payment_id='p-' + identifier,
            user_id=owner,
            currency=currency,
            amount_kopeks=amount // 10,
            occurred_at=stamp,
        )
    )
    session.add(
        UsageEvent(
            id='u-' + identifier,
            user_id=owner,
            wallet_id=f'{owner}-{currency}',
            request_id='request-' + identifier,
            model_id='synthetic-model',
            modality='text',
            cost_charged_kopeks=amount // 5,
            cost_raw_kopeks=amount,
            measured_units_json={'unit': 'token', 'units': 10, 'secret': PRIVATE},
            wallet_snapshot_json={'secret': PRIVATE},
            chat_id=PRIVATE,
            message_id=PRIVATE,
            created_at=stamp,
        )
    )


@pytest_asyncio.fixture
async def export_client() -> AsyncIterator[tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]]]:
    """Reuse the report tests' in-memory ORM and HTTP dependency-override pattern."""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            for model in (User, Wallet, Payment, Transaction, LedgerEntry, AnalyticsRefund, UsageEvent):
                await connection.run_sync(model.__table__.create)
        async with factory() as session:
            for owner in ('selected', 'other-customer'):
                session.add(
                    User(
                        id=owner,
                        name=CUSTOMER_NAME if owner == 'selected' else 'OTHER-CUSTOMER-NAME',
                        email=f'{owner}@example.test',
                        info={'secret': PRIVATE},
                        settings={'secret': PRIVATE},
                    )
                )
                for currency in ('USD', 'RUB'):
                    session.add(
                        Wallet(
                            id=f'{owner}-{currency}',
                            user_id=owner,
                            currency=currency,
                            created_at=1,
                            updated_at=1,
                        )
                    )
            # 53 rows exceed the actual UI's 50-row page; also exercise three API pages below.
            for index in range(53):
                _add_records(session, f'{index:02}', 100 + index, 1000 + 10 * index)
            for identifier, stamp, owner, currency in (
                ('before', 99, 'selected', 'USD'),
                ('at-end', 200, 'selected', 'USD'),
                ('wrong-currency', 150, 'selected', 'RUB'),
                ('wrong-owner', 150, 'other-customer', 'USD'),
            ):
                _add_records(session, identifier, stamp, 99990, owner, currency)
            await session.commit()

        async def session_dependency() -> AsyncIterator[AsyncSession]:
            async with factory() as session:
                yield session

        app = FastAPI()
        app.include_router(admin_billing_reporting.router, prefix='/api/v1/admin/billing')
        app.dependency_overrides[get_admin_user] = lambda: object()
        app.dependency_overrides[get_async_session] = session_dependency
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url='http://reporting.test',
        ) as client:
            yield client, factory
    finally:
        await engine.dispose()


def _csv_value(value: object) -> str:
    """Independent expected serialization, including spreadsheet formula protection."""
    if value is None:
        return ''
    text = str(value)
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) else text


@pytest.mark.asyncio
@pytest.mark.parametrize('dataset', ['payments', 'refunds', 'ledger', 'usage'])
async def test_csv_export_matches_all_filtered_pages_and_only_allowed_fields(
    export_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
    dataset: str,
) -> None:
    client, factory = export_client
    filters = dict(FILTERS)
    if dataset == 'payments':
        filters.update(status='succeeded', kind='topup', credit_status='credited', is_test='false')
        async with factory() as session:
            for identifier, options in (
                ('pending', {'status': 'pending', 'credited': False}),
                ('subscription', {'kind': 'subscription', 'credited': False}),
                ('uncredited', {'credited': False}),
                ('test-payment', {'is_test': True}),
            ):
                _add_payment(session, identifier, 150, 99990, **options)
            await session.commit()

    page_rows: list[dict[str, object]] = []
    for page, expected_size in ((1, 20), (2, 20), (3, 13)):
        response = await client.get(f'{PREFIX}/{dataset}', params={**filters, 'page': page, 'page_size': 20})
        assert response.status_code == 200, response.text
        data = response.json()
        assert (data['total'], data['total_pages'], data['page']) == (53, 3, page)
        assert (data['from'], data['to'], data['currency']) == (100, 200, 'USD')
        assert len(data['items']) == expected_size
        page_rows.extend(data['items'])

    response = await client.get(f'{PREFIX}/export', params={**filters, 'dataset': dataset})
    assert response.status_code == 200, response.text
    assert response.headers['content-type'].startswith('text/csv')
    assert response.headers['content-disposition'] == f'attachment; filename="billing-{dataset}-usd.csv"'
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['x-export-limit'] == '50000'
    assert response.headers['x-export-possibly-truncated'] == 'false'
    reader = csv.DictReader(io.StringIO(response.text, newline=''))
    rows = list(reader)
    assert set(reader.fieldnames or []) == ALLOWED_COLUMNS[dataset]
    assert len(reader.fieldnames or []) == len(ALLOWED_COLUMNS[dataset])
    assert len(rows) == 53
    prefix = {'payments': 'p', 'refunds': 'r', 'ledger': 'l', 'usage': 'u'}[dataset]
    assert [row['id'] for row in rows] == [f'{prefix}-{index:02}' for index in reversed(range(53))]
    assert rows == [{key: _csv_value(value) for key, value in row.items()} for row in page_rows]
    assert {row['user_id'] for row in rows} == {'selected'}
    assert {row['name'] for row in rows} == {"'" + CUSTOMER_NAME}
    if dataset != 'usage':  # Usage currency comes from its joined wallet, not a CSV column.
        assert {row['currency'] for row in rows} == {'USD'}
    amount_key = 'cost_charged_kopeks' if dataset == 'usage' else 'amount_kopeks'
    divisor = {'payments': 1, 'ledger': 1, 'refunds': 10, 'usage': 5}[dataset]
    assert sum(int(row[amount_key]) for row in rows) == sum((1000 + 10 * i) // divisor for i in range(53))
    assert PRIVATE not in response.text
    assert 'other-customer' not in response.text and 'OTHER-CUSTOMER-NAME' not in response.text
    assert 'wrong-currency' not in response.text and 'at-end' not in response.text
    if dataset == 'payments':
        assert {row['status'] for row in rows} == {'succeeded'}
        assert {row['kind'] for row in rows} == {'topup'}
        assert {row['credit_status'] for row in rows} == {'credited'}
        assert {row['is_test'] for row in rows} == {'False'}
        assert sum(int(row['refunded_kopeks']) for row in rows) == sum(100 + i for i in range(53))
        detail = await client.get(f'{PREFIX}/customers/selected', params=FILTERS)
        assert detail.status_code == 200, detail.text
        assert detail.json()['metrics']['period_paid_kopeks'] == sum(int(row[amount_key]) for row in rows)


@pytest.mark.asyncio
@pytest.mark.parametrize('dataset', ['ledger', 'usage'])
async def test_unscoped_csv_is_http_error_not_attachment(
    export_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
    dataset: str,
) -> None:
    client, _ = export_client
    response = await client.get(
        f'{PREFIX}/export',
        params={
            'dataset': dataset,
            'from': 100,
            'to': 200,
            'currency': 'USD',
        },
    )
    assert response.status_code == 400
    assert response.json()['detail'] == f'user_id is required for {dataset} exports'
    assert response.headers['content-type'].startswith('application/json')
    assert 'content-disposition' not in response.headers
