"""Regression checks for consent trust, account changes and public unsubscribe."""

import hashlib
import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from open_webui.internal.db import Base
from open_webui.models import auths, users
from open_webui.models import email_preferences as prefs
from open_webui.models.auths import Auth, SignupForm
from open_webui.models.users import User, UserModel
from open_webui.routers.airis import email_preferences as routes
from open_webui.routers.airis import password_reset
from open_webui.utils import email
from open_webui.utils.airis.email_log_privacy import redact_email_tokens
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def accounts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    database_url = os.getenv('EMAIL_PREFERENCES_TEST_DATABASE_URL', f'sqlite+aiosqlite:///{tmp_path / "consent.db"}')
    engine = create_async_engine(database_url)
    tables = [
        User.__table__,
        Auth.__table__,
        prefs.EmailPreference.__table__,
        prefs.EmailPreferenceEvent.__table__,
        prefs.EmailUnsubscribeToken.__table__,
    ]
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    factory = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def context(db: AsyncSession | None = None) -> AsyncIterator[AsyncSession]:
        if db is not None:
            yield db
        else:
            async with factory() as session:
                yield session

    for module in [prefs, users, auths]:
        monkeypatch.setattr(module, 'get_async_db_context', context)
    async with factory() as session:
        for number in ['1', '2']:
            session.add(
                User(
                    id=number,
                    email=f'person{number}@airis.you',
                    name='Test',
                    role='user',
                    email_verified=True,
                    variables={},
                    created_at=1,
                    updated_at=1,
                    last_active_at=1,
                )
            )
            session.add(Auth(id=number, email=f'person{number}@airis.you', password='unused', active=True))
        await session.commit()
    yield factory
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.drop_all(sync, tables=tables))
    await engine.dispose()


@pytest.mark.asyncio
async def test_old_account_settings_and_social_claims_are_not_consent(
    accounts: async_sessionmaker[AsyncSession],
) -> None:
    assert not (await prefs.get_product_preference('1')).can_receive
    await users.Users.update_user_by_id(
        '1', {'settings': {'product_emails_opt_in': True}, 'oauth': {'product_emails_opt_in': True}}
    )
    assert not (await prefs.get_product_preference('1')).subscribed
    assert await prefs.create_product_unsubscribe_token('1') is None
    form = SignupForm(name='Test', email='person@airis.you', password='unused')
    assert form.product_emails_opt_in is False
    with pytest.raises(ValidationError):
        SignupForm(name='Test', email='person@airis.you', password='unused', product_emails_opt_in='true')


@pytest.mark.asyncio
async def test_choice_history_idempotence_and_bound_tokens(accounts: async_sessionmaker[AsyncSession]) -> None:
    assert (await prefs.set_product_preference('1', True, 'settings')).can_receive
    await prefs.set_product_preference('1', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('1')
    async with accounts() as db:
        assert await db.scalar(select(func.count()).select_from(prefs.EmailPreferenceEvent)) == 1
        record = await db.get(prefs.EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest())
        assert record.token_hash != token
        assert record.email_hash == prefs.email_fingerprint('person1@airis.you')
    await prefs.unsubscribe_product_email(token)
    await prefs.unsubscribe_product_email(token)
    assert not (await prefs.get_product_preference('1')).can_receive
    async with accounts() as db:
        assert await db.scalar(select(func.count()).select_from(prefs.EmailPreferenceEvent)) == 2
    await prefs.set_product_preference('1', True, 'settings')
    # Links from already received mail remain usable after a new explicit opt-in.
    await prefs.unsubscribe_product_email(token)
    assert not (await prefs.get_product_preference('1')).subscribed


@pytest.mark.asyncio
async def test_address_change_is_atomic_and_old_verification_cannot_verify_new_address(
    accounts: async_sessionmaker[AsyncSession],
) -> None:
    await prefs.set_product_preference('1', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('1')
    assert await auths.Auths.update_email_by_id('1', 'replacement@airis.you')
    current = await users.Users.get_user_by_id('1')
    assert current.email == 'replacement@airis.you' and current.email_verified is False
    async with accounts() as db:
        assert (await db.get(Auth, '1')).email == current.email
        assert await db.scalar(select(func.count()).select_from(prefs.EmailUnsubscribeToken)) == 0
    assert not (await prefs.get_product_preference('1')).subscribed
    assert (
        await users.Users.update_user_by_id('1', {'email_verified': True}, expected_email='person1@airis.you') is None
    )
    assert not (await users.Users.get_user_by_id('1')).email_verified
    await prefs.set_product_preference('1', True, 'settings')
    await prefs.unsubscribe_product_email(token)
    assert (await prefs.get_product_preference('1')).subscribed
    # Admin/SCIM/general OAuth update goes through the same common method.
    await users.Users.update_user_by_id('1', {'email': 'third@airis.you', 'email_verified': True})
    assert not (await users.Users.get_user_by_id('1')).email_verified
    assert not (await prefs.get_product_preference('1')).subscribed


@pytest.mark.asyncio
async def test_expired_token_inactive_account_and_suppressed_address(
    accounts: async_sessionmaker[AsyncSession],
) -> None:
    await prefs.set_product_preference('1', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('1')
    async with accounts() as db:
        record = await db.get(prefs.EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest())
        record.expires_at = int(time.time()) - 1
        await db.commit()
    await prefs.unsubscribe_product_email(token)
    await prefs.unsubscribe_product_email('x' * 43)
    assert (await prefs.get_product_preference('1')).can_receive
    await prefs.suppress_product_address('PERSON1@airis.you', 'complaint')
    await prefs.set_product_preference('1', False, 'settings')
    await prefs.set_product_preference('1', True, 'settings')
    assert (await prefs.get_product_preference('1')).reason == 'suppressed_address'
    # Address reuse by a different account does not erase suppression.
    await users.Users.update_user_by_id('1', {'email': 'away@airis.you'})
    await users.Users.update_user_by_id('2', {'email': 'person1@airis.you'})
    await users.Users.update_user_by_id('2', {'email_verified': True})
    await prefs.set_product_preference('2', True, 'settings')
    assert (await prefs.get_product_preference('2')).reason == 'suppressed_address'
    async with accounts() as db:
        (await db.get(Auth, '2')).active = False
        await db.commit()
    assert (await prefs.get_product_preference('2')).reason == 'inactive_account'


@pytest.mark.asyncio
async def test_public_get_is_passive_post_is_idempotent_and_only_own_account_can_change(
    accounts: async_sessionmaker[AsyncSession],
) -> None:
    app = FastAPI()
    app.include_router(routes.router, prefix='/api/v1/email-preferences')
    current = await users.Users.get_user_by_id('1')

    async def authenticated() -> UserModel:
        return current

    app.dependency_overrides[routes.get_current_user] = authenticated
    await prefs.set_product_preference('1', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('1')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://airis.you') as client:
        assert (await client.get(f'/api/v1/email-preferences/one-click/{token}')).status_code == 200
        assert (await prefs.get_product_preference('1')).can_receive
        forged = await client.post('/api/v1/email-preferences', json={'subscribed': True, 'user_id': '2'})
        assert forged.status_code == 422 and not (await prefs.get_product_preference('2')).subscribed
        assert (await client.post('/api/v1/email-preferences', json={'subscribed': 'true'})).status_code == 422
        assert (
            await client.post(
                '/api/v1/email-preferences/suppression', json={'email': 'x@airis.you', 'reason': 'complaint'}
            )
        ).status_code in {401, 403}
        assert (
            await client.post(
                f'/api/v1/email-preferences/one-click/{token}',
                content='wrong',
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
        ).status_code == 400
        response = await client.post(
            f'/api/v1/email-preferences/one-click/{token}',
            content='List-Unsubscribe=One-Click',
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
        invalid = await client.post('/api/v1/email-preferences/unsubscribe', json={'token': 'x' * 43})
        repeated = await client.post('/api/v1/email-preferences/unsubscribe', json={'token': token})
        assert invalid.json() == repeated.json() == response.json()
        assert not (await prefs.get_product_preference('1')).subscribed
        app.dependency_overrides.clear()
        assert (await client.get('/api/v1/email-preferences')).status_code in {401, 403}


@pytest.mark.asyncio
async def test_product_guard_rechecks_after_connect_and_service_email_works_without_consent(
    accounts, monkeypatch
) -> None:
    monkeypatch.setattr(email, 'AIRIS_PRODUCT_EMAILS_ENABLED', True)
    service = email.EmailService()
    service.smtp_host = 'smtp.invalid'
    service.smtp_username = 'test'
    service.smtp_password = 'unused-test-value'
    service.from_email = 'test@airis.you'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'FRONTEND_URL', 'https://chat.airis.you')
    assert not await service.send_welcome_email('1')
    smtp.send_message.assert_not_awaited()
    assert await service.send_verification_email('person1@airis.you', 'Test', 'verification-test')
    assert 'List-Unsubscribe' not in smtp.send_message.await_args.args[0]
    smtp.reset_mock()
    await prefs.set_product_preference('1', True, 'settings')
    assert await service.send_welcome_email('1')
    message = smtp.send_message.await_args.args[0]
    assert message['List-Unsubscribe-Post'] == 'List-Unsubscribe=One-Click'
    assert message['List-Unsubscribe'].startswith('<https://chat.airis.you/api/v1/email-preferences/one-click/')
    assert '/unsubscribe#token=' in message.get_payload()[0].get_payload(decode=True).decode()
    smtp.reset_mock()

    async def connect_then_opt_out() -> AsyncMock:
        await prefs.set_product_preference('1', False, 'settings')
        return smtp

    service._create_connection = connect_then_opt_out
    assert not await service.send_welcome_email('1')
    smtp.send_message.assert_not_awaited()
    smtp.quit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_and_bounded_retention(accounts: async_sessionmaker[AsyncSession]) -> None:
    await prefs.set_product_preference('1', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('1')
    async with accounts() as db:
        await prefs.delete_product_preferences(db, '1')
        await db.commit()
        assert await db.get(prefs.EmailPreference, '1') is None
        assert await db.get(prefs.EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest()) is None
        event = (await db.scalars(select(prefs.EmailPreferenceEvent))).one()
        assert event.user_id is None and event.email_hash == prefs.email_fingerprint('person1@airis.you')
        event.created_at = int(time.time()) - prefs.HISTORY_DAYS * 86400 - 1
        await db.commit()
    await prefs.set_product_preference('2', True, 'settings')
    token = await prefs.create_product_unsubscribe_token('2')
    async with accounts() as db:
        record = await db.get(prefs.EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest())
        record.expires_at = 1
        await db.commit()
    await prefs.cleanup_product_email_records()
    await prefs.cleanup_product_email_records()
    async with accounts() as db:
        assert await db.scalar(select(func.count()).select_from(prefs.EmailPreferenceEvent)) == 1
        assert await db.scalar(select(func.count()).select_from(prefs.EmailUnsubscribeToken)) == 0


@pytest.mark.parametrize(
    'address',
    [
        'x@localhost',
        'x@service.local',
        'x@example.com',
        'x@mail.invalid',
        'bad',
        'x@mail.test',
        'x@sub.example.org',
        'a b@airis.you',
        'x@127.0.0.1',
        'x@airis.you\nInjected: x',
    ],
)
def test_technical_addresses_are_ineligible(address: str) -> None:
    assert not prefs.valid_product_address(address)


def test_access_log_redaction() -> None:
    secret = 'opaque-token-value'
    record = logging.LogRecord(
        'uvicorn.access',
        20,
        '',
        0,
        '%s - "%s %s HTTP/%s" %d',
        ('localhost', 'GET', f'/api/v1/email-preferences/one-click/{secret}?extra={secret}', '1.1', 200),
        None,
    )
    redacted = redact_email_tokens(record.getMessage())
    assert secret not in redacted and '/one-click/[redacted]' in redacted


@pytest.mark.asyncio
async def test_preloaded_identity_is_refreshed_before_choice(accounts: async_sessionmaker[AsyncSession]) -> None:
    async with accounts() as stale_session:
        stale_user = await stale_session.get(User, '1')
        await stale_session.commit()
        await users.Users.update_user_by_id('1', {'email': 'fresh@airis.you'})
        assert stale_user.email == 'person1@airis.you'
        choice = await prefs.set_product_preference('1', True, 'settings', db=stale_session)
        assert choice.subscribed and not choice.can_receive
        assert (await stale_session.get(prefs.EmailPreference, '1')).email_hash == prefs.email_fingerprint(
            'fresh@airis.you'
        )


@pytest.mark.asyncio
@pytest.mark.skipif(not os.getenv('EMAIL_PREFERENCES_TEST_DATABASE_URL'), reason='Requires disposable PostgreSQL')
async def test_concurrent_choices_unsubscribe_and_address_change_serialize(
    accounts: async_sessionmaker[AsyncSession],
) -> None:
    import asyncio

    await asyncio.gather(
        prefs.set_product_preference('1', True, 'settings'), prefs.set_product_preference('1', True, 'settings')
    )
    async with accounts() as db:
        assert await db.scalar(select(func.count()).select_from(prefs.EmailPreferenceEvent)) == 1
    token = await prefs.create_product_unsubscribe_token('1')
    await asyncio.gather(prefs.unsubscribe_product_email(token), prefs.unsubscribe_product_email(token))
    async with accounts() as db:
        assert await db.scalar(select(func.count()).select_from(prefs.EmailPreferenceEvent)) == 2
        await db.scalar(select(User).where(User.id == '1').with_for_update())
        choice = asyncio.create_task(prefs.set_product_preference('1', True, 'settings'))
        await asyncio.sleep(0.1)
        assert not choice.done()
        await users.Users.update_user_by_id('1', {'email': 'concurrent@airis.you'}, db=db)
        result = await choice
        assert result.subscribed and not result.can_receive
    assert not await prefs.product_email_allowed('1', 'person1@airis.you')


@pytest.mark.asyncio
async def test_verify_route_rejects_a_token_for_an_old_address(
    accounts: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    from open_webui.models.email_verification import EmailVerificationTokenModel

    monkeypatch.setattr(password_reset.EmailVerificationTokens, 'is_token_valid', AsyncMock(return_value=True))
    monkeypatch.setattr(
        password_reset.EmailVerificationTokens,
        'get_token_by_token_string',
        AsyncMock(
            return_value=EmailVerificationTokenModel(
                id='old', user_id='1', email='old@airis.you', token='opaque', created_at=1, expires_at=9999999999
            )
        ),
    )
    monkeypatch.setattr(password_reset.EmailVerificationTokens, 'delete_token_by_id', AsyncMock())
    monkeypatch.setattr(password_reset.email_service, 'send_welcome_email', AsyncMock())
    await users.Users.update_user_by_id('1', {'email_verified': False})
    with pytest.raises(HTTPException) as caught:
        await password_reset.verify_email('opaque', db=None)
    assert caught.value.status_code == 400
    assert not (await users.Users.get_user_by_id('1')).email_verified
    password_reset.email_service.send_welcome_email.assert_not_awaited()


@pytest.mark.asyncio
async def test_product_mail_disabled_by_default_before_queue_release(
    accounts: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(email, 'AIRIS_PRODUCT_EMAILS_ENABLED', False)
    await prefs.set_product_preference('1', True, 'settings')
    sender = email.EmailService()
    sender._create_connection = AsyncMock()
    result = await sender.send_product_email('1', 'Test', '<p>Test</p>', 'Test')
    assert result.status == 'failed' and result.attempts == 0
    sender._create_connection.assert_not_awaited()
