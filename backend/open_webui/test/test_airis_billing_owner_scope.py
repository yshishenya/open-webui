"""HTTP reports retain owner isolation, admin authorization and no-store caching."""

from collections.abc import AsyncIterator, Iterator
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from open_webui.internal.db import get_async_session
from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing_models import Transaction
from open_webui.models.billing_wallet import LedgerEntry, Payment, UsageEvent, Wallet
from open_webui.models.users import User
from open_webui.routers import admin_billing_reporting, billing
from open_webui.utils.auth import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest.mark.asyncio
async def test_http_summary_and_refunds_only_expose_the_authenticated_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(billing, 'ENABLE_BILLING_WALLET', True)
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            for model in (User, Wallet, Payment, Transaction, LedgerEntry, AnalyticsRefund, UsageEvent):
                await connection.run_sync(model.__table__.create)
        async with factory() as session:
            for identifier, topup, refund, spent, balance in [('a', 1000, 50, 40, 900), ('b', 9000, 300, 160, 8500)]:
                session.add(User(id=identifier, name=identifier, email=identifier + '@example.test', role='user'))
                session.add(
                    Wallet(
                        id='w' + identifier,
                        user_id=identifier,
                        currency='RUB',
                        balance_topup_kopeks=balance,
                        created_at=100,
                        updated_at=150,
                    )
                )
                session.add(
                    Payment(
                        id='p' + identifier,
                        provider_payment_id='provider' + identifier,
                        provider='yookassa',
                        user_id=identifier,
                        wallet_id='w' + identifier,
                        currency='RUB',
                        kind='topup',
                        status='succeeded',
                        amount_kopeks=topup,
                        created_at=110,
                        updated_at=130,
                        raw_payload_json={'test': False},
                    )
                )
                session.add(
                    LedgerEntry(
                        id='l' + identifier,
                        user_id=identifier,
                        wallet_id='w' + identifier,
                        currency='RUB',
                        type='topup',
                        amount_kopeks=topup,
                        balance_topup_after=topup,
                        balance_included_after=0,
                        reference_type='payment',
                        reference_id='provider' + identifier,
                        created_at=130,
                    )
                )
                session.add(
                    AnalyticsRefund(
                        id='r' + identifier,
                        payment_id='p' + identifier,
                        user_id=identifier,
                        currency='RUB',
                        amount_kopeks=refund,
                        occurred_at=150,
                    )
                )
                session.add(
                    UsageEvent(
                        id='u' + identifier,
                        wallet_id='w' + identifier,
                        user_id=identifier,
                        request_id='q' + identifier,
                        model_id='model',
                        modality='text',
                        cost_charged_kopeks=spent,
                        created_at=160,
                    )
                )
            await session.commit()

        async def session_dependency() -> AsyncIterator[AsyncSession]:
            async with factory() as session:
                yield session

        identity = SimpleNamespace(id='a', role='user')
        app = FastAPI()
        app.include_router(billing.router, prefix='/api/v1/billing')
        app.include_router(admin_billing_reporting.router, prefix='/api/v1/admin/billing')
        app.dependency_overrides[get_current_user] = lambda: identity
        app.dependency_overrides[get_async_session] = session_dependency
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://local.test') as client:
            for owner, expected in [('a', 1000), ('b', 9000)]:
                identity.id = owner
                response = await client.get(
                    '/api/v1/billing/summary', params={'from': 100, 'to': 200, 'user_id': 'other'}
                )
                assert response.status_code == 200
                assert response.headers['cache-control'] == 'no-store'
                data = response.json()
                assert data['topup_kopeks'] == expected
                assert data['topup_count'] == 1
                response = await client.get(
                    '/api/v1/billing/refunds', params={'from': 100, 'to': 200, 'user_id': 'other'}
                )
                assert response.status_code == 200
                assert response.headers['cache-control'] == 'no-store'
                assert response.json()['total'] == 1
                assert response.json()['items'][0]['id'] == 'r' + owner
                assert 'user_id' not in response.json()['items'][0]
                assert 'name' not in response.json()['items'][0]
                forbidden = await client.get(
                    '/api/v1/admin/billing/reporting/overview', params={'from': 100, 'to': 200}
                )
                assert forbidden.status_code in {401, 403}
            identity.id = 'a'
            empty = await client.get('/api/v1/billing/summary', params={'from': 170, 'to': 200})
            assert empty.json()['topup_kopeks'] == 0
            assert empty.json()['spent_kopeks'] == 0
            assert empty.json()['current_balance']['balance_kopeks'] == 900
            all_history = await client.get('/api/v1/billing/refunds')
            assert all_history.json()['total'] == 1
            boundary = await client.get('/api/v1/billing/refunds', params={'from': 100, 'to': 150})
            assert boundary.json()['total'] == 0
            invalid = await client.get('/api/v1/billing/summary', params={'from': 200, 'to': 100})
            assert invalid.status_code == 400
            identity.role = 'pending'
            denied = await client.get('/api/v1/billing/summary', params={'from': 100, 'to': 200})
            assert denied.status_code in {401, 403}
    finally:
        await engine.dispose()


def test_legacy_history_pages_have_stable_order_for_same_second(monkeypatch: pytest.MonkeyPatch) -> None:
    from contextlib import contextmanager

    import open_webui.models.billing_wallet_tables as tables
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session, sessionmaker

    engine = create_engine('sqlite:///:memory:')
    factory = sessionmaker(engine)
    for model in (LedgerEntry, UsageEvent):
        model.__table__.create(engine)
    try:
        with factory() as session:
            for suffix in ('a', 'b', 'c', 'd'):
                session.add(
                    LedgerEntry(
                        id='l' + suffix,
                        user_id='owner',
                        wallet_id='wallet',
                        currency='RUB',
                        type='topup',
                        amount_kopeks=100,
                        balance_topup_after=100,
                        balance_included_after=0,
                        created_at=150,
                    )
                )
                session.add(
                    UsageEvent(
                        id='u' + suffix,
                        user_id='owner',
                        wallet_id='wallet',
                        request_id='q' + suffix,
                        model_id='model',
                        modality='text',
                        cost_charged_kopeks=10,
                        created_at=150,
                    )
                )
            session.commit()

        @contextmanager
        def context() -> Iterator[Session]:
            with factory() as session:
                yield session

        monkeypatch.setattr(tables, 'get_db', context)
        ledger = tables.LedgerEntries.get_entries_by_user(
            'owner', limit=2, offset=0
        ) + tables.LedgerEntries.get_entries_by_user('owner', limit=2, offset=2)
        usage = tables.UsageEvents.list_events_by_user(
            'owner', limit=2, offset=0
        ) + tables.UsageEvents.list_events_by_user('owner', limit=2, offset=2)
        assert [row.id for row in ledger] == ['ld', 'lc', 'lb', 'la']
        assert [row.id for row in usage] == ['ud', 'uc', 'ub', 'ua']
    finally:
        engine.dispose()
