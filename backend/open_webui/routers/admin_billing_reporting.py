"""Admin-only financial reporting endpoints."""

from __future__ import annotations

import csv
import io
import time
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from open_webui.internal.db import get_async_session
from open_webui.utils.airis.billing_reporting import (
    REPORTING_EXPORT_MAX,
    REPORTING_PAGE_MAX,
    BillingReportingService,
    normalize_range,
    safe_csv_cell,
)
from open_webui.utils.auth import get_admin_user
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession


def _no_store(response: Response) -> None:
    response.headers['Cache-Control'] = 'no-store'


router = APIRouter(dependencies=[Depends(_no_store)])


class ReportingPage(BaseModel):
    items: list[dict[str, object]]
    total: int
    page: int
    page_size: int
    total_pages: int
    currency: str
    from_ts: int = Field(alias='from')
    to_ts: int = Field(alias='to')
    as_of: int

    model_config = {'populate_by_name': True}


def _range_or_400(from_ts: int | None, to_ts: int | None) -> tuple[int, int]:
    try:
        return normalize_range(from_ts, to_ts)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _page_size(value: int) -> int:
    return min(max(value, 1), REPORTING_PAGE_MAX)


@router.get('/reporting/overview')
async def get_reporting_overview(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    return await BillingReportingService(session).overview(from_ts=start, to_ts=end, currency=currency)


@router.get('/reporting/customers')
async def get_reporting_customers(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    query: str | None = Query(None, max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=REPORTING_PAGE_MAX),
    sort: Literal['paid', 'spent', 'balance', 'last_payment', 'last_usage'] = 'last_payment',
    direction: Literal['asc', 'desc'] = 'desc',
    status: Literal['paid', 'never_paid', 'problems', 'negative_balance'] | None = None,
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    return await BillingReportingService(session).customers(
        from_ts=start,
        to_ts=end,
        currency=currency,
        query=query,
        page=page,
        page_size=_page_size(page_size),
        sort=sort,
        direction=direction,
        status=status,
    )


@router.get('/reporting/customers/{user_id}')
async def get_reporting_customer(
    user_id: str,
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    limit: int = Query(100, ge=1, le=REPORTING_PAGE_MAX),
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    result = await BillingReportingService(session).customer_detail(
        user_id=user_id,
        from_ts=start,
        to_ts=end,
        currency=currency,
        limit=_page_size(limit),
    )
    if result is None:
        raise HTTPException(status_code=404, detail='Customer not found')
    return result


@router.get('/reporting/payments')
async def get_reporting_payments(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    status: str | None = Query(None, max_length=32),
    kind: str | None = Query(None, max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=REPORTING_PAGE_MAX),
    credit_status: Literal['credited', 'not_credited', 'not_applicable'] | None = None,
    attention: Literal['stale_pending', 'uncredited'] | None = None,
    is_test: bool | None = None,
    older_than_hours: int | None = Query(None, ge=1, le=8784),
    payment_id: Annotated[str | None, Query(min_length=1, max_length=128)] = None,
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    if payment_id and not user_id:
        raise HTTPException(status_code=400, detail='user_id is required for related payments')
    if attention or payment_id:
        start, end = 0, int(time.time()) + 1
    if attention:
        if attention == 'stale_pending':
            status, older_than_hours = 'pending', 24
        else:
            status, kind, credit_status = 'succeeded', 'topup', 'not_credited'
    size = _page_size(page_size)
    items, total = await BillingReportingService(session).payment_page(
        from_ts=start,
        to_ts=end,
        currency=currency,
        user_id=user_id,
        status=status,
        kind=kind,
        credit_status=credit_status,
        is_test=is_test,
        older_than=(int(time.time()) - older_than_hours * 3600 if older_than_hours is not None else None),
        page=page,
        page_size=size,
        payment_id=payment_id,
    )
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': size,
        'total_pages': (total + size - 1) // size,
        'currency': currency,
        'from': start,
        'to': end,
        'as_of': int(time.time()),
        'timezone': 'UTC',
        'time_semantics': 'topup_ledger_refund_provider_created_at',
        'truncated': False,
        'attention': attention,
        'scope': 'lifetime_current' if attention or payment_id else 'selected_period',
    }


@router.get('/reporting/refunds')
async def get_reporting_refunds(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=REPORTING_PAGE_MAX),
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    size = _page_size(page_size)
    rows, total = await BillingReportingService(session).refund_rows(
        from_ts=start, to_ts=end, currency=currency, user_id=user_id, limit=size, offset=(page - 1) * size
    )
    return {
        'items': rows,
        'total': total,
        'page': page,
        'page_size': size,
        'total_pages': (total + size - 1) // size,
        'currency': currency,
        'from': start,
        'to': end,
        'as_of': int(time.time()),
        'timezone': 'UTC',
    }


@router.get('/reporting/ledger')
async def get_reporting_ledger(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=REPORTING_PAGE_MAX),
    reference_id: Annotated[str | None, Query(min_length=1, max_length=128)] = None,
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    if reference_id and not user_id:
        raise HTTPException(status_code=400, detail='user_id is required for related wallet records')
    if reference_id:
        start, end = 0, int(time.time()) + 1
    size = _page_size(page_size)
    rows, total = await BillingReportingService(session).ledger_rows(
        from_ts=start,
        to_ts=end,
        currency=currency,
        user_id=user_id,
        limit=size,
        offset=(page - 1) * size,
        reference_id=reference_id,
    )
    return {
        'items': rows,
        'total': total,
        'page': page,
        'page_size': size,
        'total_pages': (total + size - 1) // size,
        'currency': currency,
        'from': start,
        'to': end,
        'as_of': int(time.time()),
        'scope': 'lifetime_current' if reference_id else 'selected_period',
    }


@router.get('/reporting/usage')
async def get_reporting_usage(
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=REPORTING_PAGE_MAX),
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    size = _page_size(page_size)
    rows, total = await BillingReportingService(session).usage_rows(
        from_ts=start,
        to_ts=end,
        currency=currency,
        user_id=user_id,
        limit=size,
        offset=(page - 1) * size,
    )
    return {
        'items': rows,
        'total': total,
        'page': page,
        'page_size': size,
        'total_pages': (total + size - 1) // size,
        'currency': currency,
        'from': start,
        'to': end,
        'as_of': int(time.time()),
    }


@router.get('/reporting/export')
async def export_reporting_data(
    dataset: Literal['payments', 'ledger', 'usage', 'refunds'] = Query('payments'),
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    status: str | None = Query(None, max_length=32),
    kind: str | None = Query(None, max_length=32),
    credit_status: Literal['credited', 'not_credited', 'not_applicable'] | None = None,
    attention: Literal['stale_pending', 'uncredited'] | None = None,
    is_test: bool | None = None,
    older_than_hours: int | None = None,
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> StreamingResponse:
    start, end = _range_or_400(from_ts, to_ts)
    if attention and dataset == 'payments':
        start, end = 0, int(time.time()) + 1
        if attention == 'stale_pending':
            status, older_than_hours = 'pending', 24
        else:
            status, kind, credit_status = 'succeeded', 'topup', 'not_credited'
    service = BillingReportingService(session)
    rows: list[dict[str, object]]
    if dataset == 'payments':
        rows = [
            service._payment_payload(fact)
            for fact in await service.payment_facts(
                from_ts=start,
                to_ts=end,
                currency=currency,
                user_id=user_id,
                status=status,
                kind=kind,
                credit_status=credit_status,
                is_test=is_test,
                older_than=int(time.time()) - older_than_hours * 3600 if older_than_hours is not None else None,
                limit=REPORTING_EXPORT_MAX,
            )
        ]
    elif dataset == 'refunds':
        rows, _ = await service.refund_rows(
            from_ts=start, to_ts=end, currency=currency, user_id=user_id, limit=REPORTING_EXPORT_MAX, offset=0
        )
    elif dataset == 'ledger':
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail='user_id is required for ledger exports',
            )
        rows, _ = await service.ledger_rows(
            from_ts=start,
            to_ts=end,
            currency=currency,
            user_id=user_id,
            limit=REPORTING_EXPORT_MAX,
            offset=0,
        )
        # ponytail: keep a single bounded export request; paginated views remain available for larger datasets.
    else:
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail='user_id is required for usage exports',
            )
        rows, _ = await service.usage_rows(
            from_ts=start,
            to_ts=end,
            currency=currency,
            user_id=user_id,
            limit=REPORTING_EXPORT_MAX,
            offset=0,
        )

    output = io.StringIO(newline='')
    writer = csv.writer(output)
    columns = list(rows[0].keys()) if rows else ['id']
    writer.writerow(columns)
    for row in rows:
        writer.writerow([safe_csv_cell(row.get(column)) for column in columns])
    output.seek(0)
    filename = f'billing-{dataset}-{currency.lower()}.csv'
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Cache-Control': 'no-store',
            'X-Export-Limit': str(REPORTING_EXPORT_MAX),
            'X-Export-Possibly-Truncated': str(len(rows) >= REPORTING_EXPORT_MAX).lower(),
        },
    )
