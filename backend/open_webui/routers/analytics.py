import datetime as dt
import logging
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from open_webui.config import ENABLE_ADMIN_CHAT_ACCESS
from open_webui.constants import ERROR_MESSAGES
from open_webui.internal.db import get_async_session
from open_webui.models.chat_messages import ChatMessageModel, ChatMessages
from open_webui.models.chats import Chats
from open_webui.models.feedbacks import Feedbacks
from open_webui.models.users import UserModel, Users
from open_webui.utils.airis.analytics_usage_reporting import model_tag_counts
from open_webui.utils.auth import get_admin_user
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


def _no_store(response: Response) -> None:
    response.headers['Cache-Control'] = 'no-store'


router = APIRouter(dependencies=[Depends(_no_store)])


####################
# Response Models
####################


class ModelAnalyticsEntry(BaseModel):
    model_id: str
    count: int
    unique_users: int = 0
    unique_chats: int = 0


class ModelAnalyticsResponse(BaseModel):
    models: list[ModelAnalyticsEntry]


class UserAnalyticsEntry(BaseModel):
    user_id: str
    name: str | None = None
    email: str | None = None
    count: int
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class UserAnalyticsResponse(BaseModel):
    users: list[UserAnalyticsEntry]
    total: int


####################
# Endpoints
####################


@router.get('/models', response_model=ModelAnalyticsResponse)
async def get_model_analytics(
    start_date: int | None = Query(None, description='Start timestamp (epoch)'),
    end_date: int | None = Query(None, description='End timestamp (epoch)'),
    group_id: str | None = Query(None, description='Filter by user group ID'),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get message counts per model."""
    counts = await ChatMessages.get_model_analytics(start_date=start_date, end_date=end_date, group_id=group_id, db=db)
    models = [
        ModelAnalyticsEntry(model_id=model_id, **data)
        for model_id, data in sorted(counts.items(), key=lambda x: -x[1]['count'])
    ]
    return ModelAnalyticsResponse(models=models)


@router.get('/users', response_model=UserAnalyticsResponse)
async def get_user_analytics(
    start_date: Optional[int] = Query(None, description='Start timestamp (epoch)'),
    end_date: Optional[int] = Query(None, description='End timestamp (epoch)'),
    group_id: Optional[str] = Query(None, description='Filter by user group ID'),
    skip: int = Query(0, ge=0, description='Number of users to skip'),
    limit: int = Query(50, ge=1, description='Max users to return'),
    metric: Literal['messages', 'tokens'] = Query('messages'),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get message counts and token usage per user with user info."""
    usage = await ChatMessages.get_user_analytics(start_date=start_date, end_date=end_date, group_id=group_id, db=db)

    # Rank by the selected metric before limiting the leaderboard.
    top_user_ids = sorted(
        usage,
        key=lambda uid: (
            -usage[uid]['total_tokens'] if metric == 'tokens' else -usage[uid]['message_count'],
            -usage[uid]['message_count'],
            uid or '',
        ),
    )[skip : skip + limit]
    user_info = {u.id: u for u in await Users.get_users_by_user_ids(top_user_ids, db=db)}

    users = []
    for user_id in top_user_ids:
        u = user_info.get(user_id)
        tokens = usage[user_id]
        users.append(
            UserAnalyticsEntry(
                user_id=user_id,
                name=u.name if u else None,
                email=u.email if u else None,
                count=tokens['message_count'],
                input_tokens=tokens.get('input_tokens', 0),
                output_tokens=tokens.get('output_tokens', 0),
                total_tokens=tokens.get('total_tokens', 0),
            )
        )

    return UserAnalyticsResponse(users=users, total=len(usage))


@router.get('/messages', response_model=list[ChatMessageModel])
async def get_messages(
    model_id: str | None = Query(None, description='Filter by model ID'),
    user_id: str | None = Query(None, description='Filter by user ID'),
    chat_id: str | None = Query(None, description='Filter by chat ID'),
    start_date: int | None = Query(None, description='Start timestamp (epoch)'),
    end_date: int | None = Query(None, description='End timestamp (epoch)'),
    skip: int = Query(0),
    limit: int = Query(50, le=100),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Query messages with filters."""
    if chat_id:
        return await ChatMessages.get_messages_by_chat_id(chat_id=chat_id, db=db)
    elif model_id:
        return await ChatMessages.get_messages_by_model_id(
            model_id=model_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
            db=db,
        )
    elif user_id:
        return await ChatMessages.get_messages_by_user_id(user_id=user_id, skip=skip, limit=limit, db=db)
    else:
        # Return empty if no filter specified
        return []


class SummaryResponse(BaseModel):
    total_messages: int
    total_chats: int
    total_models: int
    total_users: int


@router.get('/summary', response_model=SummaryResponse)
async def get_summary(
    start_date: int | None = Query(None, description='Start timestamp (epoch)'),
    end_date: int | None = Query(None, description='End timestamp (epoch)'),
    group_id: str | None = Query(None, description='Filter by user group ID'),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get summary statistics for the dashboard."""
    summary = await ChatMessages.get_analytics_summary(
        start_date=start_date, end_date=end_date, group_id=group_id, db=db
    )

    return SummaryResponse(**summary)


class ComparisonStatsEntry(BaseModel):
    models: dict[str, int]
    start: str
    end: str


class DailyStatsEntry(BaseModel):
    date: str
    models: dict[str, int]
    start: Optional[str] = None
    end: Optional[str] = None
    previous: Optional[ComparisonStatsEntry] = None


class DailyStatsResponse(BaseModel):
    data: list[DailyStatsEntry]


@router.get('/daily', response_model=DailyStatsResponse)
async def get_daily_stats(
    start_date: Optional[int] = Query(None, description='Start timestamp (epoch)'),
    end_date: Optional[int] = Query(None, description='End timestamp (epoch)'),
    group_id: Optional[str] = Query(None, description='Filter by user group ID'),
    granularity: Literal['10m', 'hourly', '3h', '6h', 'daily'] = Query('daily'),
    metric: Literal['messages', 'tokens'] = Query('messages'),
    compare: bool = Query(False),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get message counts or total tokens grouped by model for the time-series chart."""
    if compare and (start_date is None or end_date is None or start_date > end_date):
        raise HTTPException(status_code=400, detail='Comparison requires a bounded date range')
    counts = await ChatMessages.get_usage_over_time_by_model(
        start_date=start_date,
        end_date=end_date,
        group_id=group_id,
        db=db,
        granularity=granularity,
        metric=metric,
    )
    entries = [DailyStatsEntry(date=date, models=models) for date, models in sorted(counts.items())]
    if compare:
        # API bounds are inclusive: equal windows must not share an endpoint.
        duration = end_date - start_date + 1
        previous = await ChatMessages.get_usage_over_time_by_model(
            start_date=start_date - duration,
            end_date=start_date - 1,
            group_id=group_id,
            db=db,
            granularity=granularity,
            metric=metric,
            bucket_offset=duration,
        )
        step = timedelta(minutes={'10m': 10, 'hourly': 60, '3h': 180, '6h': 360, 'daily': 1440}[granularity])
        for entry in entries:
            bucket = datetime.fromisoformat(entry.date)
            start = max(start_date, int(bucket.timestamp()))
            end = min(end_date + 1, int((bucket + step).timestamp()))
            entry.start = datetime.fromtimestamp(start).isoformat()
            entry.end = datetime.fromtimestamp(end).isoformat()
            entry.previous = ComparisonStatsEntry(
                models=previous.get(entry.date, {}),
                start=datetime.fromtimestamp(start - duration).isoformat(),
                end=datetime.fromtimestamp(end - duration).isoformat(),
            )
    return DailyStatsResponse(data=entries)


class TokenUsageEntry(BaseModel):
    model_id: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    message_count: int


class TokenUsageResponse(BaseModel):
    models: list[TokenUsageEntry]
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int


@router.get('/tokens', response_model=TokenUsageResponse)
async def get_token_usage(
    start_date: int | None = Query(None),
    end_date: int | None = Query(None),
    group_id: str | None = Query(None, description='Filter by user group ID'),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get token usage aggregated by model."""
    usage = await ChatMessages.get_token_usage_by_model(
        start_date=start_date, end_date=end_date, group_id=group_id, db=db
    )

    models = [
        TokenUsageEntry(model_id=model_id, **data)
        for model_id, data in sorted(usage.items(), key=lambda x: -x[1]['total_tokens'])
    ]

    total_input = sum(m.input_tokens for m in models)
    total_output = sum(m.output_tokens for m in models)

    return TokenUsageResponse(
        models=models,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_tokens=total_input + total_output,
    )


####################
# Model Chats Browser
####################


class ModelChatEntry(BaseModel):
    chat_id: str
    user_id: str | None = None
    user_name: str | None = None
    first_message: str | None = None
    updated_at: int


class ModelChatsResponse(BaseModel):
    chats: list[ModelChatEntry]
    total: int


MODEL_CHAT_ORDER_FIELDS = {'title', 'updated_at', 'user_name'}


@router.get('/models/{model_id:path}/chats', response_model=ModelChatsResponse)
async def get_model_chats(
    request: Request,
    model_id: str,
    start_date: int | None = Query(None),
    end_date: int | None = Query(None),
    skip: int = Query(0),
    limit: int = Query(50, le=100),
    group_id: str | None = Query(None),
    order_by: str = Query('updated_at'),
    direction: str = Query('desc'),
    user: UserModel = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
) -> ModelChatsResponse:
    """Get chats that used a specific model, with preview and feedback info."""
    if not ENABLE_ADMIN_CHAT_ACCESS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=ERROR_MESSAGES.ACCESS_PROHIBITED)

    filter: dict[str, str | int] = {}
    if group_id:
        filter['group_id'] = group_id
    if start_date is not None:
        filter['start_date'] = start_date
    if end_date is not None:
        filter['end_date'] = end_date
    if group_id:
        filter['group_id'] = group_id
    if order_by in MODEL_CHAT_ORDER_FIELDS:
        filter['order_by'] = order_by
    if direction in {'asc', 'desc'}:
        filter['direction'] = direction

    result = await Chats.get_chats_by_model_id(
        model_id=model_id,
        filter=filter,
        skip=skip,
        limit=limit,
        db=db,
    )

    return ModelChatsResponse(
        chats=[ModelChatEntry.model_validate(chat) for chat in result['items']],
        total=result['total'] or 0,
    )


####################
# Model Overview
####################


class HistoryEntry(BaseModel):
    date: str
    won: int = 0
    lost: int = 0


class TagEntry(BaseModel):
    tag: str
    count: int


class ModelOverviewResponse(BaseModel):
    history: list[HistoryEntry]
    tags: list[TagEntry]


@router.get('/models/{model_id:path}/overview', response_model=ModelOverviewResponse)
async def get_model_overview(
    model_id: str,
    days: int = Query(30, ge=0, le=366, description='Legacy history window; explicit dates take precedence'),
    start_date: int | None = Query(None, ge=0),
    end_date: int | None = Query(None, ge=0),
    group_id: str | None = Query(None),
    user=Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_session),
) -> ModelOverviewResponse:
    """Preserve the selected period and group across every model detail panel."""
    now = dt.datetime.now(dt.UTC)
    start = (
        start_date if start_date is not None else int((now - dt.timedelta(days=days)).timestamp()) if days > 0 else None
    )
    end = end_date if end_date is not None else int(now.timestamp())
    history_rows = await Feedbacks.get_model_feedback_counts_by_day(
        model_id=model_id, start_date=start, end_date=end, group_id=group_id, db=db
    )
    history_counts = {entry.date: {'won': entry.won, 'lost': entry.lost} for entry in history_rows}
    history: list[HistoryEntry] = []
    if start is not None or history_counts:
        current = (
            dt.datetime.fromtimestamp(start, dt.UTC)
            if start is not None
            else dt.datetime.strptime(min(history_counts), '%Y-%m-%d').replace(tzinfo=dt.UTC)
        )
        current = current.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = dt.datetime.fromtimestamp(end, dt.UTC)
        while current < end_dt:
            date = current.strftime('%Y-%m-%d')
            counts = history_counts.get(date, {'won': 0, 'lost': 0})
            history.append(HistoryEntry(date=date, **counts))
            current += dt.timedelta(days=1)
    tags = await model_tag_counts(db, model_id, start, end, group_id)
    return ModelOverviewResponse(history=history, tags=[TagEntry(**tag) for tag in tags])


####################
# Session Explorer
####################


def require_session_access(user=Depends(get_admin_user)):
    from open_webui.config import ENABLE_ADMIN_CHAT_ACCESS

    if not ENABLE_ADMIN_CHAT_ACCESS:
        raise HTTPException(403, detail='Admin chat access is disabled')
    return user


def validate_session_range(start_date, end_date):
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(400, detail='Start date must be before end date')


@router.get('/sessions')
async def get_sessions(
    start_date: int | None = Query(None, ge=0),
    end_date: int | None = Query(None, ge=0),
    group_id: str | None = None,
    query: str = Query('', max_length=200),
    model_id: str | None = None,
    hide_subagents: bool = False,
    order_by: Literal['title', 'user', 'recent', 'tokens', 'responses', 'errors', 'duration'] = 'recent',
    direction: Literal['asc', 'desc'] = 'desc',
    include_summary: bool = False,
    token_min: int | None = Query(None, ge=0),
    token_max: int | None = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=50),
    user=Depends(require_session_access),
    db: AsyncSession = Depends(get_async_session),
):
    from open_webui.models.analytics_sessions import list_sessions

    validate_session_range(start_date, end_date)
    if token_min is not None and token_max is not None and token_min >= token_max:
        raise HTTPException(400, detail='Minimum tokens must be below maximum tokens')
    return await list_sessions(
        db,
        start_date=start_date,
        end_date=end_date,
        group_id=group_id,
        query=query,
        model_id=model_id,
        hide_subagents=hide_subagents,
        order_by=order_by,
        direction=direction,
        include_summary=include_summary,
        token_min=token_min,
        token_max=token_max,
        skip=skip,
        limit=limit,
    )


@router.get('/sessions/{chat_id}')
async def get_session_messages(
    chat_id: str,
    start_date: int | None = Query(None, ge=0),
    end_date: int | None = Query(None, ge=0),
    group_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=50),
    user=Depends(require_session_access),
    db: AsyncSession = Depends(get_async_session),
):
    from open_webui.models.analytics_sessions import session_messages

    validate_session_range(start_date, end_date)
    result = await session_messages(
        db, chat_id, start_date=start_date, end_date=end_date, group_id=group_id, skip=skip, limit=limit
    )
    if result is None:
        raise HTTPException(404, detail='Session not found in this range')
    return result


@router.get('/sessions/{chat_id}/messages/{message_id}/events')
async def get_session_events(
    chat_id: str,
    message_id: str,
    start_date: int | None = Query(None, ge=0),
    end_date: int | None = Query(None, ge=0),
    group_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(require_session_access),
    db: AsyncSession = Depends(get_async_session),
):
    from open_webui.models.analytics_sessions import message_events

    validate_session_range(start_date, end_date)
    result = await message_events(
        db, chat_id, message_id, start_date=start_date, end_date=end_date, group_id=group_id, skip=skip, limit=limit
    )
    if result is None:
        raise HTTPException(404, detail='Message not found in this session')
    return result


@router.get('/sessions/{chat_id}/trace')
async def get_session_trace(
    chat_id: str,
    start_date: int | None = Query(None, ge=0),
    end_date: int | None = Query(None, ge=0),
    group_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50),
    view: Literal['all', 'tools', 'errors'] = 'all',
    include_chart: bool = False,
    user=Depends(require_session_access),
    db: AsyncSession = Depends(get_async_session),
):
    from open_webui.models.analytics_sessions import session_trace

    validate_session_range(start_date, end_date)
    result = await session_trace(
        db,
        chat_id,
        start_date=start_date,
        end_date=end_date,
        group_id=group_id,
        skip=skip,
        limit=limit,
        view=view,
        include_chart=include_chart,
    )
    if result is None:
        raise HTTPException(404, detail='Session not found in this range')
    return result
