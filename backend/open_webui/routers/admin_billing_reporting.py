"""Admin-only financial reporting endpoints."""

from __future__ import annotations

import csv
import io
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
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

router = APIRouter()


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
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, object]:
    start, end = _range_or_400(from_ts, to_ts)
    size = _page_size(page_size)
    facts = await BillingReportingService(session).payment_facts(
        from_ts=start,
        to_ts=end,
        currency=currency,
        user_id=user_id,
        status=status,
        kind=kind,
        # Fetch the complete bounded reporting window so `total_pages` is
        # stable on page one.  Deriving totals from `page * size` made every
        # first page look like the final page and disabled pagination.
        limit=REPORTING_EXPORT_MAX,
    )
    start_index = (page - 1) * size
    items = [BillingReportingService._payment_payload(fact) for fact in facts[start_index : start_index + size]]
    return {
        'items': items,
        'total': len(facts),
        'page': page,
        'page_size': size,
        'total_pages': (len(facts) + size - 1) // size,
        'currency': currency,
        'from': start,
        'to': end,
        'as_of': int(time.time()),
        'time_semantics': 'processed_at_fallback',
        'truncated': len(facts) >= REPORTING_EXPORT_MAX,
    }


@router.get('/reporting/ledger')
async def get_reporting_ledger(
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
    rows, total = await BillingReportingService(session).ledger_rows(
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
    dataset: Literal['payments', 'ledger', 'usage'] = Query('payments'),
    currency: str = Query('RUB', min_length=3, max_length=3, pattern='^[A-Z]{3}$'),
    from_ts: int | None = Query(None, alias='from', ge=0),
    to_ts: int | None = Query(None, alias='to', ge=0),
    user_id: str | None = Query(None, max_length=128),
    status: str | None = Query(None, max_length=32),
    kind: str | None = Query(None, max_length=32),
    _: object = Depends(get_admin_user),
    session: AsyncSession = Depends(get_async_session),
) -> StreamingResponse:
    start, end = _range_or_400(from_ts, to_ts)
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
                limit=REPORTING_EXPORT_MAX,
            )
        ]
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
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
