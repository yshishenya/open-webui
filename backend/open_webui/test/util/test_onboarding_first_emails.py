"""First-email copy and social-login trust/lifecycle acceptance checks."""

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from fastapi import HTTPException
from open_webui.internal.db import Base
from open_webui.models import email_preferences as prefs
from open_webui.models import email_verification as verification
from open_webui.models.auths import Auth
from open_webui.models.email_verification import EmailVerificationToken
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User, Users
from open_webui.routers import oauth_russian as vk
from open_webui.utils import email
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from open_webui.utils.airis import social_account as social
from open_webui.utils.airis.email_onboarding import first_email_context
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.requests import Request
from starlette.responses import Response
from test.util import test_email_delivery_queue as queue_tests
from test.util.test_email_delivery_queue import config

queue_database = queue_tests.database


queue_database = queue_tests.database


@pytest_asyncio.fixture
async def database(
    queue_database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    for module in [social, verification]:
        monkeypatch.setattr(module, 'get_async_db_context', prefs.get_async_db_context)
    yield queue_database


@pytest.mark.parametrize(
    'origin',
    [
        'http://chat.airis.you',
        'https://evil.invalid',
        'https://chat.airis.you.evil.invalid',
        'https://user@chat.airis.you',
        'https://chat.airis.you/path',
        'https://chat.airis.you?next=x',
        'https://chat.airis.you:80',
        'https://chat.airis.you:bad',
        ' https://chat.airis.you',
    ],
)
def test_mail_links_reject_untrusted_origins(origin: str) -> None:
    with pytest.raises(ValueError):
        first_email_context(origin, 'Name')


def test_both_template_formats_escape_html_and_have_one_primary_task() -> None:
    service = email.EmailService()
    service.reply_to = 'support@airis.you'
    name = '<img src=x onerror=alert(1)>'
    for kind in ['welcome', 'activation_24h']:
        html, text = service.render_template(
            'onboarding_v1/' + kind, **first_email_context('https://chat.airis.you/', name)
        )
        assert '<img src=x' not in html and '&lt;img' in html
        assert name in text and 'mailto:support@airis.you' in html
        assert html.count('https://chat.airis.you/guide#example-letter') == 1
        assert 'https://chat.airis.you/guide#example-letter' in text
        assert 'ничего не отправляет автоматически' in text or 'не запускает отправку' in text
        assert 'пополн' not in text.lower() and 'неогранич' not in text.lower()


@pytest.mark.asyncio
async def test_credential_repair_keeps_identity_and_never_reactivates(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as session:
        user = await Users.get_user_by_id('1', db=session)
        await session.execute(delete(Auth).where(Auth.id == '1'))
        await session.commit()
        with pytest.raises(HTTPException):
            await social.require_active_social_account(user, session)
        await social.require_active_social_account(user, session, repair_legacy_vk=True)
        original = (await session.get(Auth, '1')).password
        await social.require_active_social_account(user, session, repair_legacy_vk=True)
        assert (await session.get(Auth, '1')).password == original
        await session.execute(update(Auth).where(Auth.id == '1').values(active=False))
        await session.commit()
        with pytest.raises(HTTPException):
            await social.require_active_social_account(user, session, repair_legacy_vk=True)
        assert not (await session.get(Auth, '1', populate_existing=True)).active
        assert await session.scalar(select(func.count()).select_from(User)) == 2


@pytest.mark.asyncio
async def test_new_social_address_requests_proof_once_and_does_not_verify_or_opt_in(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    async with database() as session:
        await session.run_sync(
            lambda sync: Base.metadata.create_all(sync.bind, tables=[EmailVerificationToken.__table__])
        )
        await session.execute(update(User).where(User.id == '1').values(email_verified=False))
        await session.commit()
        user = await Users.get_user_by_id('1', db=session)
        monkeypatch.setattr(email.email_service, 'is_configured', lambda: True)
        sender = AsyncMock(return_value=True)
        monkeypatch.setattr(email.email_service, 'send_verification_email', sender)
        await social.verify_social_address(user, session)
        await social.verify_social_address(user, session)
        assert sender.await_count == 1
        assert not (await session.get(User, '1', populate_existing=True)).email_verified
        assert await session.scalar(select(func.count()).select_from(EmailVerificationToken)) == 1
        await session.commit()
        await session.run_sync(lambda sync: EmailVerificationToken.__table__.drop(sync.bind))


@pytest.mark.asyncio
async def test_vk_id_ignores_browser_claims_and_creates_auth_without_verifying_email(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(vk, 'ENABLE_OAUTH_SIGNUP', True)
    monkeypatch.setattr(vk, 'VK_CLIENT_ID', 'test-client')
    monkeypatch.setattr(
        vk.Config, 'get', AsyncMock(side_effect=lambda key: 'user' if key == 'ui.default_user_role' else '1h')
    )
    monkeypatch.setattr(vk, 'create_token', lambda **kwargs: 'test-only-session')
    monkeypatch.setattr(email.email_service, 'is_configured', lambda: False)
    payload: dict[str, object] = {'user': {'user_id': '900', 'email': 'provider@airis.you', 'first_name': 'Name'}}

    @asynccontextmanager
    async def response() -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(status=200, json=AsyncMock(return_value=payload))

    @asynccontextmanager
    async def client(*args: object, **kwargs: object) -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(post=Mock(side_effect=lambda *args, **kwargs: response()))

    monkeypatch.setattr(vk, 'ClientSession', client)
    request = Request({'type': 'http', 'headers': [], 'method': 'POST', 'path': '/callback'})
    claims = vk.VKIDAuthRequest(access_token='test-provider-access', user_id=123, email='person1@airis.you')
    async with database() as session:
        result = await vk.vkid_callback(request, Response(), claims, db=session)
        assert result.user['email'] == 'provider@airis.you'
        user = await Users.get_user_by_oauth_sub('vk', '900', db=session)
        assert user.id == result.user['id'] and not user.email_verified
        assert (await session.get(Auth, user.id)).active
        repeated = await vk.vkid_callback(request, Response(), claims, db=session)
        assert repeated.user['id'] == user.id
        assert await session.scalar(select(func.count()).select_from(User)) == 3
        for bad in [
            {'user_id': '900'},
            {'email': 'provider@airis.you'},
            {'user_id': 'None', 'email': 'provider@airis.you'},
        ]:
            payload['user'] = bad
            with pytest.raises(HTTPException) as error:
                await vk.vkid_callback(request, Response(), claims, db=session)
            assert error.value.status_code == 400
        payload['user'] = {'user_id': '901', 'email': 'person1@airis.you'}
        with pytest.raises(HTTPException):
            await vk.vkid_callback(request, Response(), claims, db=session)
        assert await Users.get_user_by_oauth_sub('vk', '901', db=session) is None


@pytest.mark.asyncio
async def test_success_excludes_activation_candidate(database: async_sessionmaker[AsyncSession]) -> None:
    from open_webui.models.email_delivery import EmailDelivery

    async with database() as session:
        session.add(
            TaskSuccess(
                operation_id='first',
                user_id='1',
                kind='foreground_chat',
                completed_at=int(time.time()),
                source='saved_chat',
            )
        )
        await session.commit()
    await scenarios.reconcile_email_candidates(config())
    async with database() as session:
        types = set((await session.scalars(select(EmailDelivery.type))).all())
    assert 'welcome' in types and 'activation_24h' not in types


@pytest.mark.asyncio
async def test_unknown_template_is_proven_unsent(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    from open_webui.models import email_delivery as journal

    now = int(time.time())
    async with database() as session:
        job_id = await journal.enqueue_email(session, '1', 'welcome', 'onboarding_v1', now, now + 60)
        await session.execute(
            update(journal.EmailDelivery)
            .where(journal.EmailDelivery.id == job_id)
            .values(template_version='missing_v2')
        )
        await session.commit()
    sender = AsyncMock()
    monkeypatch.setattr(email.email_service, 'send_product_email', sender)
    await worker.drain_email_queue(config())
    async with database() as session:
        row = await session.get(journal.EmailDelivery, job_id)
        assert row.status == 'failed' and row.submitted_at is None
    sender.assert_not_awaited()


@pytest.mark.asyncio
async def test_shared_yandex_signup_collision_and_disabled_login(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    from open_webui.utils import oauth

    runtime = SimpleNamespace(
        **{name: oauth._default_value(default) for name, (_, default) in oauth.OAUTH_RUNTIME_CONFIG.items()}
    )
    runtime.ENABLE_OAUTH = True
    runtime.ENABLE_OAUTH_SIGNUP = True
    runtime.OAUTH_MERGE_ACCOUNTS_BY_EMAIL = True
    runtime.OAUTH_ALLOWED_DOMAINS = ['*']
    runtime.OAUTH_PICTURE_CLAIM = None
    runtime.OAUTH_SUB_CLAIM = None
    runtime.OAUTH_EMAIL_CLAIM = 'email'
    runtime.OAUTH_USERNAME_CLAIM = 'name'
    runtime.ENABLE_OAUTH_GROUP_MANAGEMENT = False
    runtime.OAUTH_UPDATE_EMAIL_ON_LOGIN = False
    runtime.OAUTH_UPDATE_NAME_ON_LOGIN = False
    runtime.OAUTH_UPDATE_PICTURE_ON_LOGIN = False
    runtime.JWT_EXPIRES_IN = '1h'
    monkeypatch.setattr(oauth, 'get_oauth_runtime_config', AsyncMock(return_value=runtime))
    monkeypatch.setattr(oauth, 'OAUTH_PROVIDERS', {'yandex': {'sub_claim': 'id'}})
    monkeypatch.setattr(
        oauth.Config, 'get', AsyncMock(side_effect=lambda key: 'https://chat.airis.you' if key == 'webui.url' else None)
    )
    monkeypatch.setattr(oauth, 'apply_default_group_assignment', AsyncMock())
    monkeypatch.setattr(oauth, 'publish_event', AsyncMock())
    monkeypatch.setattr(oauth, 'create_token', lambda **kwargs: 'test-only-session')
    monkeypatch.setattr(oauth.OAuthSessions, 'get_sessions_by_user_id', AsyncMock(return_value=[]))
    monkeypatch.setattr(oauth.OAuthSessions, 'create_session', AsyncMock(return_value=None))
    monkeypatch.setattr(email.email_service, 'is_configured', lambda: False)
    data = {'id': 'yandex-900', 'default_email': 'yandex-user@airis.you', 'name': 'Name'}
    client = SimpleNamespace(
        authorize_access_token=AsyncMock(return_value={'userinfo': data}), userinfo=AsyncMock(return_value=data)
    )
    manager = object.__new__(oauth.OAuthManager)
    manager._clients = {'yandex': client}
    manager.get_user_role = AsyncMock(return_value='user')
    request = Request(
        {
            'type': 'http',
            'headers': [],
            'method': 'GET',
            'path': '/callback',
            'scheme': 'https',
            'server': ('chat.airis.you', 443),
        }
    )
    async with database() as session:
        first = await manager.handle_callback(request, 'yandex', Response(), db=session)
        assert 'error=' not in first.headers['location']
        user = await Users.get_user_by_oauth_sub('yandex', 'yandex-900', db=session)
        assert user and not user.email_verified and (await session.get(Auth, user.id)).active
        repeated = await manager.handle_callback(request, 'yandex', Response(), db=session)
        assert 'error=' not in repeated.headers['location']
        assert await session.scalar(select(func.count()).select_from(User)) == 3
        data['id'] = 'yandex-901'
        data['default_email'] = 'person1@airis.you'
        collision = await manager.handle_callback(request, 'yandex', Response(), db=session)
        assert 'error=' in collision.headers['location']
        assert await Users.get_user_by_oauth_sub('yandex', 'yandex-901', db=session) is None
        data['id'] = 'yandex-900'
        data['default_email'] = 'yandex-user@airis.you'
        await session.execute(update(Auth).where(Auth.id == user.id).values(active=False))
        await session.commit()
        disabled = await manager.handle_callback(request, 'yandex', Response(), db=session)
        assert 'error=' in disabled.headers['location'] and 'set-cookie' not in disabled.headers
        assert not (await session.get(Auth, user.id, populate_existing=True)).active


@pytest.mark.asyncio
async def test_late_consent_replays_once_and_exact_seven_day_boundary(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    monkeypatch.setattr(scenarios.time, 'time', lambda: now)
    monkeypatch.setattr(scenarios.EmailQueueConfig, 'from_env', lambda: config())
    await prefs.set_product_preference('1', False, 'settings')
    assert not await scenarios.queue_welcome('1')
    await prefs.set_product_preference('1', True, 'settings')
    assert await scenarios.queue_welcome('1')
    assert not await scenarios.queue_welcome('1')
    async with database() as session:
        await session.execute(update(User).where(User.id == '2').values(created_at=now - 7 * 86400))
        await session.commit()
    monkeypatch.setattr(
        scenarios.EmailQueueConfig,
        'from_env',
        lambda: scenarios.EmailQueueConfig(enabled=True, release_a=True, dry_run=False, pilot_only=False, start_at=1),
    )
    assert not await scenarios.queue_welcome('2')
    async with database() as session:
        await session.execute(update(User).where(User.id == '2').values(created_at=now - 7 * 86400 + 1))
        await session.commit()
    assert await scenarios.queue_welcome('2')


@pytest.mark.asyncio
async def test_oauth_role_claims_groups_and_logout_protocol_remain_compatible(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.utils import oauth

    runtime = SimpleNamespace(
        DEFAULT_USER_ROLE='pending',
        ENABLE_OAUTH_ROLE_MANAGEMENT=True,
        OAUTH_ROLES_CLAIM='claims.roles',
        OAUTH_ALLOWED_ROLES=['member'],
        OAUTH_ADMIN_ROLES=['owner'],
    )
    monkeypatch.setattr(oauth, 'get_oauth_runtime_config', AsyncMock(return_value=runtime))
    monkeypatch.setattr(oauth.Users, 'get_num_users', AsyncMock(return_value=2))
    manager = object.__new__(oauth.OAuthManager)
    for roles, expected in [(['member'], 'user'), (['owner'], 'admin'), ([], 'pending')]:
        assert await manager.get_user_role(None, {'claims': {'roles': roles}}) == expected
    with pytest.raises(HTTPException):
        await manager.get_user_role(None, {'claims': {'roles': ['foreign']}})
    assert await oauth._read_group_claims('claims.groups', {'claims': {'groups': ['one', 'two']}}) == ['one', 'two']
    event = {'http://schemas.openid.net/event/backchannel-logout': {}}
    sub, sid, error = await oauth._validate_logout_claims({'events': event, 'sub': 'one'})
    assert sub == 'one' and sid is None and error is None
    for claims in [{'sub': 'one'}, {'events': event}, {'events': event, 'sub': 'one', 'nonce': 'bad'}]:
        assert (await oauth._validate_logout_claims(claims))[2].status_code == 400
    monkeypatch.setattr(oauth.Users, 'get_user_by_oauth_sub', AsyncMock(return_value=None))
    assert await oauth._lookup_logout_users(None, 'yandex', None, 'missing') == []
    unknown = await manager.handle_backchannel_logout(SimpleNamespace(form=AsyncMock(return_value={})))
    assert unknown.status_code == 400


@pytest.mark.asyncio
async def test_oauth_rotated_signing_key_retries_once_without_client_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    from joserfc.errors import BadSignatureError
    from open_webui.utils import oauth

    client = SimpleNamespace(
        server_metadata={'jwks': {'old': True}},
        authorize_access_token=AsyncMock(side_effect=[BadSignatureError(), {'access_token': 'fixture'}]),
    )
    request = Request({'type': 'http', 'headers': [], 'method': 'GET', 'path': '/'})
    assert await oauth._exchange_login_token({}, client, 'yandex', request) == {'access_token': 'fixture'}
    assert client.authorize_access_token.await_count == 2 and 'jwks' not in client.server_metadata
    client.authorize_access_token = AsyncMock(side_effect=[BadSignatureError(), ValueError('fixture')])
    with pytest.raises(HTTPException):
        await oauth._exchange_login_token({}, client, 'yandex', request)
    assert client.authorize_access_token.await_count == 2
