"""A Telegram profile ticket cannot bypass a subsequently disabled signup policy."""

import hashlib
import hmac
import json
import time
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from open_webui.internal.db import get_async_session
from open_webui.routers import oauth_russian as oauth
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_telegram_profile_completion_rechecks_disabled_signup(monkeypatch: pytest.MonkeyPatch) -> None:
    bot_token = 'isolated-telegram-signup-gate-test'
    monkeypatch.setattr(oauth, 'ENABLE_OAUTH_SIGNUP', True)
    monkeypatch.setattr(oauth, 'TELEGRAM_BOT_TOKEN', bot_token)
    redis = AsyncMock()
    monkeypatch.setattr(oauth, 'redis_client', redis)
    lookup = AsyncMock(return_value=None)
    email_lookup = AsyncMock()
    insert = AsyncMock()
    monkeypatch.setattr(oauth.Users, 'get_user_by_oauth_sub', lookup)
    monkeypatch.setattr(oauth.Users, 'get_user_by_email', email_lookup)
    monkeypatch.setattr(oauth.Auths, 'insert_new_auth', insert)

    async def database() -> AsyncIterator[AsyncSession]:
        yield AsyncMock(spec=AsyncSession)

    app = FastAPI()
    app.include_router(oauth.router, prefix='/api/v1')
    app.dependency_overrides[get_async_session] = database
    payload: dict[str, str | int] = {'id': 12345, 'first_name': 'Telegram signup', 'auth_date': int(time.time())}
    data_check_string = '\n'.join(f'{key}={value}' for key, value in sorted(payload.items()))
    payload['hash'] = hmac.new(
        hashlib.sha256(bot_token.encode()).digest(), data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='https://test.invalid') as client:
        callback = await client.post('/api/v1/oauth/telegram/callback', json=payload)
        assert callback.status_code == 200, callback.text
        ticket = callback.json()
        assert ticket['requires_email'] is True
        lookup.assert_awaited_once()
        redis.setex.assert_awaited_once()
        key, ttl, stored = redis.setex.call_args.args
        assert key == f'telegram_temp_session:{ticket["temp_session"]}' and ttl == 600
        assert json.loads(stored)['telegram_id'] == '12345'

        # The operator changes policy while the user is filling in the email form.
        monkeypatch.setattr(oauth, 'ENABLE_OAUTH_SIGNUP', False)
        completed = await client.post(
            '/api/v1/oauth/telegram/complete-profile',
            json={
                'temp_session': ticket['temp_session'],
                'email': 'telegram-gate@example.com',
                'terms_accepted': True,
                'privacy_accepted': True,
            },
        )
        assert completed.status_code == 403, completed.text
        assert completed.json() == {'detail': 'OAuth signup is disabled'}
        assert 'token' not in completed.cookies and 'mfa_challenge' not in completed.cookies
        redis.get.assert_not_awaited()
        redis.delete.assert_not_awaited()
        email_lookup.assert_not_awaited()
        insert.assert_not_awaited()
