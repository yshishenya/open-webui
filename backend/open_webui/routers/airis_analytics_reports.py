"""Administrator-only aggregate product funnel report."""

import time

from fastapi import APIRouter, Depends, HTTPException, Query
from open_webui.models.users import UserModel
from open_webui.utils.airis.analytics_reports import funnel_report
from open_webui.utils.auth import get_admin_user

router = APIRouter()


@router.get('/funnel-report')
async def report(
    start: int = Query(0, ge=0),
    end: int | None = Query(None, ge=0),
    window_days: int = Query(30),
    breakdown: str = Query('week'),
    user: UserModel = Depends(get_admin_user),
) -> dict[str, object]:
    """Report first-visit cohorts with explicit mature denominators."""
    now = int(time.time())
    end_at = min(end or now, now)
    if (
        start >= end_at
        or window_days not in {7, 30}
        or breakdown not in {'week', 'utm_source', 'utm_campaign', 'device', 'signup_method'}
    ):
        raise HTTPException(status_code=422, detail='Invalid report interval or grouping')
    return await funnel_report(start, end_at, now, window_days, breakdown)
