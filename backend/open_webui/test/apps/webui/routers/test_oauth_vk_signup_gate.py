"""A VK redirect cannot bypass a subsequently disabled signup policy."""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from open_webui.internal.db import get_async_session
from open_webui.routers import oauth_russian as oauth
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_vk_callback_rechecks_disabled_signup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(oauth, 'ENABLE_OAUTH_SIGNUP', True)
    monkeypatch.setattr(oauth, 'VK_CLIENT_ID', 'isolated-vk-client')
    monkeypatch.setattr(oauth, 'VK_CLIENT_SECRET', 'isolated-vk-secret')
    monkeypatch.setattr(oauth, 'generate_oauth_state', lambda: 'isolated-vk-state')
    stored = AsyncMock(return_value=True)
    validated = AsyncMock(return_value=True)
    profile = AsyncMock()
    account = AsyncMock()
    monkeypatch.setattr(oauth, 'store_oauth_state', stored)
    monkeypatch.setattr(oauth, 'validate_oauth_state', validated)
    monkeypatch.setattr(oauth, '_read_vk_profile', profile)
    monkeypatch.setattr(oauth, 'get_or_create_vk_account', account)

    async def database() -> AsyncIterator[AsyncSession]:
        yield AsyncMock(spec=AsyncSession)

    app = FastAPI()
    app.include_router(oauth.router, prefix='/api/v1')
    app.dependency_overrides[get_async_session] = database
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='https://test.invalid') as client:
        started = await client.get('/api/v1/oauth/vk/login')
        assert started.status_code == 307
        assert 'state=isolated-vk-state' in started.headers['location']
        stored.assert_awaited_once_with('isolated-vk-state', 'vk')

        monkeypatch.setattr(oauth, 'ENABLE_OAUTH_SIGNUP', False)
        callback = await client.get(
            '/api/v1/oauth/vk/callback', params={'state': 'isolated-vk-state', 'code': 'isolated-code'}
        )
        assert callback.status_code == 403, callback.text
        assert callback.json() == {'detail': 'OAuth signup is disabled'}
        assert 'token' not in callback.cookies and 'mfa_challenge' not in callback.cookies
        validated.assert_not_awaited()
        profile.assert_not_awaited()
        account.assert_not_awaited()
