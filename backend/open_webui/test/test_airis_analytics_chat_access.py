"""Model analytics must respect the same private-chat access switch as chats."""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from open_webui.constants import ERROR_MESSAGES
from open_webui.internal.db import get_async_session
from open_webui.models.users import UserModel
from open_webui.routers import analytics
from open_webui.utils.auth import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'enabled,role,expected_status',
    [(False, 'admin', 401), (True, 'admin', 200), (False, 'user', 401), (True, 'user', 401)],
)
async def test_model_chat_browser_respects_admin_chat_access_before_reading_private_data(
    monkeypatch: pytest.MonkeyPatch, enabled: bool, role: str, expected_status: int
) -> None:
    monkeypatch.setattr(analytics, 'ENABLE_ADMIN_CHAT_ACCESS', enabled)
    read_chats = AsyncMock(
        return_value={
            'items': [
                {
                    'chat_id': 'private-chat',
                    'user_id': 'other-user',
                    'user_name': 'Private owner',
                    'first_message': 'Private message',
                    'updated_at': 150,
                }
            ],
            'total': 1,
        }
    )
    monkeypatch.setattr(analytics.Chats, 'get_chats_by_model_id', read_chats)
    identity = UserModel(
        id='viewer',
        role=role,
        name='Viewer',
        email='viewer@example.test',
        created_at=100,
        updated_at=100,
        last_active_at=100,
    )

    async def session_dependency() -> AsyncIterator[AsyncSession]:
        async with AsyncSession() as session:
            yield session

    app = FastAPI()
    app.include_router(analytics.router, prefix='/api/v1/analytics')
    # Keep get_admin_user real: ordinary-user rejection is part of this regression.
    app.dependency_overrides[get_current_user] = lambda: identity
    app.dependency_overrides[get_async_session] = session_dependency
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://local.test') as client:
        response = await client.get(
            '/api/v1/analytics/models/provider/model/chats',
            params={'start_date': 100, 'end_date': 200, 'group_id': 'team', 'skip': 5, 'limit': 10},
        )

    assert response.status_code == expected_status
    if expected_status == 200:
        assert response.headers['cache-control'] == 'no-store'
        assert response.json()['chats'][0]['first_message'] == 'Private message'
        assert response.json()['total'] == 1
        read_chats.assert_awaited_once()
        assert read_chats.await_args.kwargs['model_id'] == 'provider/model'
        assert read_chats.await_args.kwargs['filter'] == {
            'start_date': 100,
            'end_date': 200,
            'group_id': 'team',
            'order_by': 'updated_at',
            'direction': 'desc',
        }
        assert read_chats.await_args.kwargs['skip'] == 5
        assert read_chats.await_args.kwargs['limit'] == 10
    else:
        assert response.json() == {'detail': ERROR_MESSAGES.ACCESS_PROHIBITED}
        read_chats.assert_not_awaited()
