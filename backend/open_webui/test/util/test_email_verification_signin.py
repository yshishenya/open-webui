"""Real signup, single-use verification/session exchange and password regression."""

import asyncio
import time
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from open_webui.models import config as settings
from open_webui.models.auths import Auth
from open_webui.models.email_verification import EmailVerificationToken, EmailVerificationTokens
from open_webui.models.users import User
from open_webui.utils import mfa
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util.test_onboarding_lifecycle import app as app
from test.util.test_onboarding_lifecycle import queue_database as queue_database
from test.util.test_onboarding_lifecycle import signup
from test.util.test_onboarding_lifecycle import smtp as smtp


async def signup_token(client: httpx.AsyncClient, database: async_sessionmaker[AsyncSession]) -> str:
    user_id = await signup(client, False)
    async with database() as db:
        tokens = await EmailVerificationTokens.get_tokens_by_user_id(user_id, db=db)
    client.cookies.clear()  # The mail opens in a different browser, with no signup session.
    return tokens[0].token


@pytest.mark.asyncio
async def test_verification_logs_in_once_with_cookie_and_bearer(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test.invalid') as client:
        token = await signup_token(client, queue_database)
        response = await client.post('/api/v1/auths/verify-email', json={'token': token})
        assert response.status_code == 200, response.text
        session = response.json()['session']
        assert session['email'] == 'lifecycle@airis.you' and session['role'] == 'user'
        assert session['token_type'] == 'Bearer' and session['expires_at'] > time.time()
        assert response.cookies['token'] == session['token']
        assert 'httponly' in response.headers['set-cookie'].lower()
        assert response.headers['cache-control'] == 'no-store'
        current = await client.get('/api/v1/auths/')
        assert current.status_code == 200 and current.json()['id'] == session['id']
        replay = await client.post('/api/v1/auths/verify-email', json={'token': token})
        assert replay.status_code == 400 and 'set-cookie' not in replay.headers
        assert smtp.send_message.await_count == 1  # Consent stayed off; no optional email.
        sent = smtp.send_message.call_args.args[0]
        assert '/verify-email#token=' in next(
            part for part in sent.walk() if part.get_content_type() == 'text/plain'
        ).get_payload(decode=True).decode('utf-8')


@pytest.mark.asyncio
@pytest.mark.parametrize('reason', ['expired', 'boundary', 'old_address', 'inactive', 'deleted'])
async def test_verification_never_authenticates_invalid_account_or_token(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock, reason: str
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test.invalid') as client:
        token = await signup_token(client, queue_database)
        async with queue_database() as db:
            record = await EmailVerificationTokens.get_token_by_token_string(token, db=db)
            if reason in {'expired', 'boundary'}:
                await db.execute(
                    update(EmailVerificationToken).values(expires_at=int(time.time()) - int(reason == 'expired'))
                )
            elif reason == 'old_address':
                await db.execute(update(User).where(User.id == record.user_id).values(email='changed@airis.you'))
            elif reason == 'inactive':
                await db.execute(update(Auth).where(Auth.id == record.user_id).values(active=False))
            else:
                await db.execute(delete(User).where(User.id == record.user_id))
            await db.commit()
        result = await client.post('/api/v1/auths/verify-email', json={'token': token})
        assert result.status_code == 400 and 'set-cookie' not in result.headers
        assert 'session' not in result.json()
        assert smtp.send_message.await_count == 1


@pytest.mark.asyncio
async def test_parallel_clicks_issue_at_most_one_session(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock
) -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='https://test.invalid') as first:
        token = await signup_token(first, queue_database)
        async with httpx.AsyncClient(transport=transport, base_url='https://test.invalid') as second:
            responses = await asyncio.gather(
                *[client.post('/api/v1/auths/verify-email', json={'token': token}) for client in [first, second]]
            )
        assert sorted(response.status_code for response in responses) == [200, 400]
        assert sum('set-cookie' in response.headers for response in responses) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('pending', [False, True])
async def test_verification_respects_real_mfa_gate_without_issuing_session(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock, pending: bool
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test.invalid') as client:
        token = await signup_token(client, queue_database)
        await settings.Config.upsert({'auth.mfa.enable': True})
        async with queue_database() as db:
            record = await EmailVerificationTokens.get_token_by_token_string(token, db=db)
            user_id = record.user_id
            if pending:
                await db.execute(update(User).where(User.id == user_id).values(role='pending'))
                await db.commit()
        response = await client.post('/api/v1/auths/verify-email', json={'token': token})
        assert response.status_code == 200, response.text
        session = response.json()['session']
        assert session['next_step'] == ('pending' if pending else 'enroll')
        assert 'token' not in session and 'token' not in response.cookies
        assert 'token' not in client.cookies
        assert response.headers['cache-control'] == 'no-store'
        if pending:
            assert 'challenge_token' not in session
        else:
            assert response.cookies['mfa_challenge'] == session['challenge_token']
            assert 'httponly' in response.headers['set-cookie'].lower()
            user, auth, state, challenge, slot = await mfa.load_challenge(session['challenge_token'], {'enroll'})
            assert user.id == user_id and challenge.auth_method == 'password'
            assert slot == 'login_challenge' and state.login_challenge is not None
        current = await client.get('/api/v1/auths/')
        assert current.status_code == 401
        replay = await client.post('/api/v1/auths/verify-email', json={'token': token})
        assert replay.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize('password', ['Test-lifecycle-4829!', 'Пароль-4829!🧩', '  Test-lifecycle-4829!  '])
async def test_signup_password_is_preserved_on_signin(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock, password: str
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test.invalid') as client:
        registered = await client.post(
            '/api/v1/auths/signup',
            json={
                'name': 'Password check',
                'email': 'password@airis.you',
                'password': password,
                'terms_accepted': True,
                'privacy_accepted': True,
            },
        )
        assert registered.status_code == 200, registered.text
        client.cookies.clear()
        result = await client.post('/api/v1/auths/signin', json={'email': 'password@airis.you', 'password': password})
        assert result.status_code == 200 and result.json()['id'] == registered.json()['id']
        wrong = await client.post('/api/v1/auths/signin', json={'email': 'password@airis.you', 'password': 'wrong'})
        assert wrong.status_code == 400
