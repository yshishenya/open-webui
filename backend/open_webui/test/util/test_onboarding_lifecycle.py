"""Combined real-route consent and durable mail timing acceptance."""

import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, replace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from open_webui.internal.db import Base, get_async_session
from open_webui.models import config as settings
from open_webui.models import email_delivery as delivery
from open_webui.models import email_preferences as prefs
from open_webui.models import email_verification as verification
from open_webui.models import groups, legal
from open_webui.models import task_success as successes
from open_webui.models.users import User
from open_webui.routers import auths as signup_routes
from open_webui.routers.airis import email_preferences as preference_routes
from open_webui.routers.airis import password_reset as verification_routes
from open_webui.utils import email
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from open_webui.utils.airis import task_success as completion
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests

queue_database = queue_tests.database
DAY = 86400


@dataclass
class Clock:
    """Move domain timestamps without sleeping or changing asyncio's clock."""

    now: int

    def time(self) -> int:
        return self.now


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    result = Clock(int(time.time()))
    for module in [delivery, prefs, verification, scenarios, worker, completion, queue_tests]:
        monkeypatch.setattr(module, 'time', result)
    return result


@pytest.fixture
def smtp(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    """Keep rendering, permission and capacity checks; isolate SMTP only."""
    service = email.EmailService()
    service.smtp_host = 'smtp.invalid'
    service.smtp_username, service.smtp_password = 'isolated', 'unused'
    service.from_email, service.reply_to = 'sender@airis.you', 'support@airis.you'
    transport = AsyncMock()
    transport.close = Mock()
    service._create_connection = AsyncMock(return_value=transport)
    for module in [email, signup_routes, verification_routes]:
        monkeypatch.setattr(module, 'email_service', service)
    return transport


@pytest_asyncio.fixture
async def app(
    queue_database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[FastAPI]:
    """Mount real routers and move their database boundaries to the test store."""
    tables = [
        settings.Config.__table__,
        groups.Group.__table__,
        groups.GroupMember.__table__,
        legal.LegalDocumentAcceptance.__table__,
        verification.EmailVerificationToken.__table__,
    ]
    async with queue_database() as session:
        connection = await session.connection()
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        # Existing administrators allow ordinary signup without becoming mail candidates.
        await session.execute(update(User).where(User.id.in_(['1', '2'])).values(role='admin'))
        await session.commit()
    for module in [groups, legal, verification, successes]:
        monkeypatch.setattr(module, 'get_async_db_context', prefs.get_async_db_context)
    monkeypatch.setattr(settings, 'get_async_db', prefs.get_async_db_context)
    await settings.Config.upsert(
        {
            'ui.enable_signup': True,
            'ui.enable_login_form': True,
            'ui.default_user_role': 'user',
            'ui.default_group_id': '',
            'auth.jwt_expiry': '1d',
            'events.webhooks': [],
        }
    )
    for name, value in {
        'AIRIS_EMAIL_QUEUE_ENABLED': 'true',
        'AIRIS_EMAIL_RELEASE_A_ENABLED': 'true',
        'AIRIS_EMAIL_RELEASE_B_ENABLED': 'false',
        'AIRIS_EMAIL_DRY_RUN': 'false',
        'AIRIS_EMAIL_PILOT_ONLY': 'false',
        'AIRIS_EMAIL_ONBOARDING_START_AT': '1',
    }.items():
        monkeypatch.setenv(name, value)

    async def session_dependency() -> AsyncIterator[AsyncSession]:
        async with queue_database() as session:
            yield session

    application = FastAPI()
    application.state.redis = None
    application.dependency_overrides[get_async_session] = session_dependency
    application.include_router(signup_routes.router, prefix='/api/v1/auths')
    application.include_router(verification_routes.router, prefix='/api/v1/auths')
    application.include_router(preference_routes.router, prefix='/api/v1/email-preferences')
    yield application
    async with queue_database() as session:
        connection = await session.connection()
        await connection.run_sync(lambda sync: Base.metadata.drop_all(sync, tables=tables))
        await session.commit()


async def signup(client: httpx.AsyncClient, subscribed: bool) -> str:
    response = await client.post(
        '/api/v1/auths/signup',
        json={
            'name': 'Lifecycle',
            'email': 'lifecycle@airis.you',
            'password': 'Test-lifecycle-4829!',
            'terms_accepted': True,
            'privacy_accepted': True,
            'product_emails_opt_in': subscribed,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()['role'] == 'user'
    return response.json()['id']


async def jobs(database: async_sessionmaker[AsyncSession], user_id: str) -> list[delivery.DeliveryView]:
    async with database() as session:
        rows = await session.scalars(select(delivery.EmailDelivery).where(delivery.EmailDelivery.user_id == user_id))
        return [delivery.DeliveryView.model_validate(row) for row in rows]


@pytest.mark.asyncio
@pytest.mark.parametrize('subscribed', [False, True])
async def test_signup_verify_consent_two_clients_and_replay(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], smtp: AsyncMock, subscribed: bool
) -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='https://test.invalid') as client:
        user_id = await signup(client, subscribed)
        assert not (await prefs.get_product_preference(user_id)).can_receive
        assert await jobs(queue_database, user_id) == []
        assert smtp.send_message.await_count == 1  # Verification is service mail.
        async with queue_database() as session:
            tokens = await verification.EmailVerificationTokens.get_tokens_by_user_id(user_id, db=session)
        assert len(tokens) == 1
        response = await client.get('/api/v1/auths/verify-email', params={'token': tokens[0].token})
        assert response.status_code == 200 and response.json()['user']['email_verified']
        queued = await jobs(queue_database, user_id)
        assert len(queued) == int(subscribed)
        if not subscribed:
            async with httpx.AsyncClient(transport=transport, base_url='https://test.invalid') as second:
                second.cookies.update(client.cookies)
                responses = await asyncio.gather(
                    *(
                        browser.post('/api/v1/email-preferences', json={'subscribed': True})
                        for browser in [client, second]
                    )
                )
                assert all(result.status_code == 200 for result in responses)
            await scenarios.reconcile_email_candidates(scenarios.EmailQueueConfig.from_env())
        replay = await client.get('/api/v1/auths/verify-email', params={'token': tokens[0].token})
        assert replay.status_code == 400
        assert smtp.send_message.await_count == 1  # The callbacks only enqueue.
        config = scenarios.EmailQueueConfig.from_env()
        await worker.drain_email_queue(config)
        await worker.drain_email_queue(config)
        queued = await jobs(queue_database, user_id)
        assert len([job for job in queued if job.type == 'welcome']) == 1
        assert next(job for job in queued if job.type == 'welcome').status == 'accepted'
        assert smtp.send_message.await_count == 2


async def prepare_activation(database: async_sessionmaker[AsyncSession], clock: Clock) -> str:
    welcome_id = await queue_tests.enqueue(database)
    async with database() as session:
        await session.execute(update(User).where(User.id == '1').values(created_at=clock.now - DAY))
        await session.execute(
            update(delivery.EmailDelivery)
            .where(delivery.EmailDelivery.id == welcome_id)
            .values(
                status='accepted',
                submitted_at=clock.now - DAY,
                accepted_at=clock.now - DAY,
            )
        )
        await session.commit()
    return await queue_tests.enqueue(database, 'activation_24h')


@pytest.mark.asyncio
async def test_exact_welcome_day_boundary(
    queue_database: async_sessionmaker[AsyncSession], clock: Clock, smtp: AsyncMock
) -> None:
    deadline = clock.now
    job_id = await prepare_activation(queue_database, clock)
    clock.now -= 1
    # Make the candidate visible early to exercise the domain guard itself.
    async with queue_database() as session:
        await session.execute(
            update(delivery.EmailDelivery)
            .where(delivery.EmailDelivery.id == job_id)
            .values(
                due_at=clock.now,
            )
        )
        await session.commit()
    await worker.execute_email(await delivery.claim_email(clock.now), queue_tests.config())
    smtp.send_message.assert_not_awaited()
    assert (await queue_tests.state(queue_database, job_id)).due_at == deadline
    clock.now = deadline
    await worker.execute_email(await delivery.claim_email(clock.now), queue_tests.config())
    assert (await queue_tests.state(queue_database, job_id)).status == 'accepted'
    smtp.send_message.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('during_connection', [False, True])
async def test_completion_minute_before_due_or_final_submission(
    queue_database: async_sessionmaker[AsyncSession],
    clock: Clock,
    smtp: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
    during_connection: bool,
) -> None:
    monkeypatch.setattr(successes, 'get_async_db_context', prefs.get_async_db_context)
    deadline = clock.now
    job_id = await prepare_activation(queue_database, clock)

    async def record_completion() -> None:
        clock.now = deadline - 60
        checkpoint = await completion.completion_checkpoint(
            '1',
            {
                'airis_operation_id': 'real-completion',
                'chat_id': 'temporary:lifecycle',
            },
            'A visible completed answer',
        )
        assert checkpoint is not None
        await successes.insert_success('1', checkpoint)
        clock.now = deadline

    if during_connection:

        async def connect() -> AsyncMock:
            await record_completion()
            return smtp

        email.email_service._create_connection = connect
    else:
        await record_completion()
    await worker.execute_email(await delivery.claim_email(clock.now), queue_tests.config())
    result = await queue_tests.state(queue_database, job_id)
    assert result.status == 'suppressed' and result.reason == 'activation'
    assert result.submitted_at is None
    smtp.send_message.assert_not_awaited()
    assert (await successes.success_summary('1')).count == 1


@pytest.mark.asyncio
async def test_late_verification_delays_activation_and_ten_day_restart_does_not_catch_up(
    app: FastAPI, queue_database: async_sessionmaker[AsyncSession], clock: Clock, smtp: AsyncMock
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test.invalid') as client:
        user_id = await signup(client, True)
        async with queue_database() as session:
            user = await session.get(User, user_id)
            created_at = user.created_at
            # Delayed confirmation uses a newly resent token, not an expired link.
            tokens = [
                await verification.EmailVerificationTokens.create_verification_token(
                    user_id, user.email, 72, db=session
                )
            ]
        clock.now = created_at + 2 * DAY
        response = await client.get('/api/v1/auths/verify-email', params={'token': tokens[0].token})
        assert response.status_code == 200
        config = replace(scenarios.EmailQueueConfig.from_env(), release_b=True)
        await worker.drain_email_queue(config)
        queued = await jobs(queue_database, user_id)
        welcome = next(job for job in queued if job.type == 'welcome')
        activation = next(job for job in queued if job.type == 'activation_24h')
        assert welcome.status == 'accepted'
        assert activation.status == 'pending' and activation.reason == 'welcome_pending'
        clock.now += 300  # The pending welcome is checked on the next queue poll.
        await worker.drain_email_queue(config)
        activation = next(job for job in await jobs(queue_database, user_id) if job.type == 'activation_24h')
        assert activation.status == 'pending' and activation.due_at == welcome.accepted_at + DAY
        assert smtp.send_message.await_count == 2
        clock.now = created_at + 10 * DAY
        scenarios._account_cursor, scenarios._payment_cursor = (0, ''), (0, '')
        await worker.drain_email_queue(config)
        scenarios._account_cursor, scenarios._payment_cursor = (0, ''), (0, '')
        await worker.drain_email_queue(config)
        queued = await jobs(queue_database, user_id)
        assert len(queued) == 4
        assert {job.type: job.status for job in queued} == {
            'welcome': 'accepted',
            'activation_24h': 'expired',
            'paid_value_72h': 'expired',
            'feedback_14d': 'pending',
        }
        assert smtp.send_message.await_count == 2
