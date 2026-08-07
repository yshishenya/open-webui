import time

import pytest
from fastapi import HTTPException
from open_webui.utils.airis.billing_reporting import (
    PaymentFact,
    amount_to_kopeks,
    normalize_range,
    safe_csv_cell,
)


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
async def test_reporting_payments_uses_bounded_total_window(monkeypatch: pytest.MonkeyPatch) -> None:
    import open_webui.routers.admin_billing_reporting as reporting_router

    class FakeService:
        requested_limit: int | None = None

        def __init__(self, _session: object) -> None:
            pass

        @staticmethod
        def _payment_payload(fact: PaymentFact) -> dict[str, object]:
            return {'id': fact.id, 'amount_kopeks': fact.amount_kopeks}

        async def payment_facts(self, **kwargs: object) -> list[object]:
            FakeService.requested_limit = int(kwargs['limit'])
            return [
                PaymentFact(
                    id=f'payment-{index}',
                    user_id='user-1',
                    kind='topup',
                    status='succeeded',
                    amount_kopeks=100,
                    currency='RUB',
                    provider='yookassa',
                    provider_payment_id=None,
                    processed_at=100 + index,
                    source='billing_payment',
                    wallet_id='wallet-1',
                    subscription_id=None,
                )
                for index in range(120)
            ]

    monkeypatch.setattr(reporting_router, 'BillingReportingService', FakeService)
    result = await reporting_router.get_reporting_payments(
        currency='RUB',
        from_ts=1,
        to_ts=200,
        user_id=None,
        status=None,
        kind=None,
        page=1,
        page_size=50,
        _=object(),
        session=object(),
    )

    assert FakeService.requested_limit == reporting_router.REPORTING_EXPORT_MAX
    assert result['total'] == 120
    assert result['total_pages'] == 3
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
