"""Report semantics: mature unique cohorts, first payment and repeat payments."""

from open_webui.utils.airis.analytics_reports import cohort_rows


def test_mature_denominator_and_first_payment() -> None:
    day = 86400
    facts = [
        {'identity_id': 'a', 'name': 'product_first_visit', 'timestamp': 100, 'properties': {}},
        {'identity_id': 'a', 'name': 'product_first_visit', 'timestamp': 101, 'properties': {}},
        {'identity_id': 'a', 'name': 'payment_confirmed', 'timestamp': day, 'properties': {'is_first_payment': True}},
        {
            'identity_id': 'a',
            'name': 'payment_confirmed',
            'timestamp': day * 2,
            'properties': {'is_first_payment': False},
        },
        {'identity_id': 'b', 'name': 'product_first_visit', 'timestamp': day * 29, 'properties': {}},
        {
            'identity_id': 'b',
            'name': 'payment_confirmed',
            'timestamp': day * 29 + 1,
            'properties': {'is_first_payment': True},
        },
        {'identity_id': 'c', 'name': 'product_first_visit', 'timestamp': 100, 'properties': {}},
        {'identity_id': 'c', 'name': 'payment_confirmed', 'timestamp': day, 'properties': {'is_first_payment': False}},
    ]
    row = cohort_rows(facts, {}, day * 31, 30, 'utm_source')[0]
    assert row['visitors'] == 3
    assert row['paid'] == 2
    assert row['repeated'] == 1
    assert row['mature_visitors'] == 2
    assert row['mature_paid'] == 1
    assert row['conversion_percent'] == 50


def test_payment_after_window_and_immature_cohort() -> None:
    facts = [
        {'identity_id': 'a', 'name': 'product_first_visit', 'timestamp': 100, 'properties': {}},
        {
            'identity_id': 'a',
            'name': 'payment_confirmed',
            'timestamp': 9 * 86400,
            'properties': {'is_first_payment': True},
        },
    ]
    row = cohort_rows(facts, {}, 5 * 86400, 7)[0]
    assert row['paid'] == 0
    assert row['conversion_percent'] is None
    row = cohort_rows(facts, {}, 10 * 86400, 7)[0]
    assert row['paid'] == 0
    assert row['conversion_percent'] == 0


def test_report_requires_administrator() -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from open_webui.routers.airis_analytics_reports import router

    app = FastAPI()
    app.include_router(router, prefix='/api/v1/analytics')
    with TestClient(app) as client:
        response = client.get('/api/v1/analytics/funnel-report')
    assert response.status_code in {401, 403}


def test_actual_report_excludes_existing_accounts_and_bounds_stage_window(monkeypatch) -> None:
    import asyncio
    from contextlib import asynccontextmanager

    from open_webui.models.analytics import AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
    from open_webui.models.analytics_refunds import AnalyticsRefund
    from open_webui.models.billing import LedgerEntry, Payment
    from open_webui.models.users import User
    from open_webui.utils.airis import analytics_reports as reports
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run() -> None:
        engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        tables = [
            User.__table__,
            AnalyticsIdentity.__table__,
            AnalyticsEvent.__table__,
            AnalyticsDelivery.__table__,
            Payment.__table__,
            LedgerEntry.__table__,
            AnalyticsRefund.__table__,
        ]
        async with engine.begin() as conn:
            for table in tables:
                await conn.run_sync(table.create)
        factory = async_sessionmaker(engine, expire_on_commit=False)

        @asynccontextmanager
        async def context():
            async with factory() as db:
                yield db

        monkeypatch.setattr(reports, 'get_async_db_context', context)
        monkeypatch.setenv('AIRIS_ANALYTICS_ENABLED_AT', '100')
        day = 86400
        async with factory() as db:
            db.add_all([User(id='old', name='Old', created_at=50), User(id='new', name='New', created_at=210)])
            db.add_all(
                [
                    AnalyticsIdentity(
                        id='old-id',
                        anonymous_id='old-anon',
                        user_id='old',
                        consent=True,
                        granted_at=150,
                        first_touch={},
                        last_touch={},
                    ),
                    AnalyticsIdentity(
                        id='new-id',
                        anonymous_id='new-anon',
                        user_id='new',
                        consent=True,
                        granted_at=150,
                        first_touch={},
                        last_touch={},
                    ),
                ]
            )
            for identity, name, stamp, properties in [
                ('old-id', 'product_first_visit', 200, {}),
                ('old-id', 'first_response_received', 220, {}),
                ('new-id', 'product_first_visit', 200, {}),
                ('new-id', 'signup_completed', 210, {}),
                ('new-id', 'first_response_received', 200 + 8 * day, {}),
                ('new-id', 'payment_confirmed', 300, {'is_first_payment': True}),
                ('new-id', 'billing_wallet_view', 200 + 9 * day, {}),
            ]:
                db.add(
                    AnalyticsEvent(
                        id=f'{identity}:{name}',
                        identity_id=identity,
                        event_name=name,
                        occurred_at=stamp,
                        properties=properties,
                    )
                )
            db.add(
                Payment(
                    id='payment',
                    provider='yookassa',
                    provider_payment_id='provider',
                    status='succeeded',
                    kind='topup',
                    amount_kopeks=1000,
                    currency='RUB',
                    user_id='old',
                    wallet_id='wallet',
                    created_at=250,
                    updated_at=300,
                )
            )
            db.add(
                LedgerEntry(
                    id='ledger',
                    user_id='old',
                    wallet_id='wallet',
                    currency='RUB',
                    type='topup',
                    amount_kopeks=1000,
                    balance_included_after=0,
                    balance_topup_after=1000,
                    reference_id='provider',
                    reference_type='payment',
                    created_at=300,
                )
            )
            db.add(
                AnalyticsRefund(
                    id='refund', payment_id='payment', user_id='old', amount_kopeks=200, currency='RUB', occurred_at=350
                )
            )
            await db.commit()
        result = await reports.funnel_report(100, 500, 200 + 10 * day, 7, 'utm_source')
        assert result['coverage']['excluded_existing_accounts'] == 1
        assert result['rows'][0]['visitors'] == 1
        assert result['rows'][0]['registered'] == 1
        assert result['rows'][0]['activated'] == 0
        assert result['stages']['first_response_received'] == 0
        assert result['stages']['billing_wallet_view'] == 0
        assert 'first_response_received' not in result['events']
        assert result['financial']['RUB'] == {
            'confirmed_payments': 1,
            'gross_kopeks': 1000,
            'refund_kopeks': 200,
            'net_kopeks': 800,
        }
        assert result['payment_funnel']['created'] == 1
        assert result['payment_funnel']['confirmed'] == 1
        await engine.dispose()

    asyncio.run(run())
