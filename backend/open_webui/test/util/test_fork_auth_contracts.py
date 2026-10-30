"""AIRIS login paths share the upstream MFA and asynchronous rate-limit contracts."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response


def request() -> Request:
    return Request(
        {
            'type': 'http',
            'headers': [],
            'method': 'POST',
            'path': '/',
            'app': SimpleNamespace(state=SimpleNamespace(redis=None)),
        }
    )


@pytest.mark.asyncio
async def test_social_and_email_login_do_not_issue_tokens_before_mfa(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.routers import oauth_russian
    from open_webui.routers.airis import password_reset, telegram_auth
    from open_webui.utils import mfa

    user = SimpleNamespace(id='user', role='user')
    credential = SimpleNamespace(id='user', session_stamp=1, password='hash')
    challenge = {'next_step': 'verify', 'challenge_token': 'isolated-test-challenge', 'expires_in': 300}
    monkeypatch.setattr(mfa, 'get_auth', AsyncMock(return_value=credential))
    monkeypatch.setattr(mfa, 'get_mfa_config', AsyncMock(return_value=mfa.MfaConfigForm(ENABLE_MFA=True)))
    start = AsyncMock(return_value=challenge)
    monkeypatch.setattr(mfa, 'start_mfa_login', start)
    monkeypatch.setattr(oauth_russian, 'require_active_social_account', AsyncMock())
    for provider in ('vk', 'telegram'):
        response = Response()
        result = await oauth_russian._social_signin(request(), response, user, None, provider)
        assert result == challenge and 'token' not in result
        assert 'token=isolated' not in response.headers.get('set-cookie', '')
        assert start.await_args.kwargs['provider'] == provider
    monkeypatch.setattr(password_reset, '_verify_email_user', AsyncMock(return_value=user))
    verified = await password_reset.verify_email_and_signin(
        password_reset.VerifyEmailForm(token='single-use'), request(), Response(), db=None
    )
    assert verified['session'] == challenge
    assert start.await_args.args[1] == 'password'

    monkeypatch.setattr(telegram_auth, 'ENABLE_TELEGRAM_AUTH', True)
    monkeypatch.setattr(telegram_auth, 'TELEGRAM_BOT_TOKEN', 'fixture')
    monkeypatch.setattr(telegram_auth, '_consume_telegram_state', lambda *args, **kwargs: None)
    monkeypatch.setattr(telegram_auth, '_enforce_telegram_rate_limit', AsyncMock())
    monkeypatch.setattr(
        telegram_auth,
        'verify_and_extract_telegram_user',
        lambda *args, **kwargs: SimpleNamespace(sub='1', telegram_id=1),
    )
    monkeypatch.setattr(telegram_auth.Users, 'get_user_by_oauth_sub', AsyncMock(return_value=user))
    result = await telegram_auth.telegram_signin(
        request(),
        Response(),
        telegram_auth.TelegramAuthForm(
            state='fixture', payload=telegram_auth.TelegramWidgetPayload(id=1, auth_date=1, hash='fixture')
        ),
        db=None,
    )
    assert result == challenge and 'token' not in result


@pytest.mark.asyncio
async def test_fork_limiters_are_awaited_with_the_request_redis(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.routers import airis_analytics
    from open_webui.routers.airis import password_reset, telegram_auth

    req = request()
    denied = AsyncMock(return_value=True)
    for limiter in (
        airis_analytics._limiter,
        password_reset.email_verification_rate_limiter,
        password_reset.password_reset_rate_limiter,
        telegram_auth.telegram_action_rate_limiter,
    ):
        monkeypatch.setattr(limiter, 'is_limited', denied)
    calls = (
        lambda: airis_analytics.limit_ingestion(req),
        lambda: password_reset.resend_verification_email(
            password_reset.ResendVerificationForm(email='a@b.invalid'), req, db=None
        ),
        lambda: password_reset.request_password_reset(
            password_reset.RequestPasswordResetForm(email='a@b.invalid'), req, db=None
        ),
        lambda: telegram_auth._enforce_telegram_rate_limit(req, action='signin'),
    )
    for call in calls:
        with pytest.raises(HTTPException) as error:
            await call()
        assert error.value.status_code == 429
    assert denied.await_count == 4
    assert all(call.args[0] is None for call in denied.await_args_list)
