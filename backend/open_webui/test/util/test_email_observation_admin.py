"""Authenticated diagnostic commands retain replay history and never mutate sources."""

import asyncio
import importlib
import json
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from open_webui.internal.db import Base
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import EmailDelivery
from open_webui.models.email_observation_commands import EmailObservationCommand, ObservationCommandConflict
from open_webui.models.email_preferences import EmailPreference, EmailPreferenceEvent, EmailUnsubscribeToken
from open_webui.models.users import User, UserModel
from open_webui.routers.airis import email_observation as routes
from open_webui.utils.airis import email_observation_admin as admin
from open_webui.utils.airis import email_observer as observer
from open_webui.utils.auth import get_current_user
from sqlalchemy import delete, func, inspect, select, update
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from test.util import test_email_observer as runner_tests

store = runner_tests.store
database = runner_tests.database
journal_db = runner_tests.journal_db
observed_db = runner_tests.observed_db


@pytest_asyncio.fixture
async def admin_db(
    observed_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async with observed_db() as session:
        engine = session.bind
        assert isinstance(engine, AsyncEngine)
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[EmailObservationCommand.__table__]))

    @asynccontextmanager
    async def context() -> AsyncIterator[AsyncSession]:
        async with observed_db() as session:
            yield session

    monkeypatch.setattr(admin, 'get_async_db_context', context)
    yield observed_db
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.drop_all(c, tables=[EmailObservationCommand.__table__]))


def declaration(key: str = 'declare-1', ids: list[str] | None = None) -> admin.DiagnosticDeclaration:
    now = int(time.time())
    return admin.DiagnosticDeclaration(
        request_key=key,
        user_ids=ids or ['1', '2'],
        registrations_from=0,
        registrations_until=now,
        payments_from=0,
        payments_until=now + 86400,
    )


async def snapshot(factory: async_sessionmaker[AsyncSession]) -> str:
    async with factory() as session:
        values = []
        for model in [
            User,
            Auth,
            EmailPreference,
            EmailPreferenceEvent,
            EmailUnsubscribeToken,
            Payment,
            LedgerEntry,
            EmailDelivery,
        ]:
            values.append([dict(r) for r in (await session.execute(select(model.__table__))).mappings()])
        return json.dumps(values, sort_keys=True, default=str)


@pytest.mark.asyncio
async def test_declaration_replay_is_durable_normalized_actor_bound_and_survives_member_deletion(
    admin_db: async_sessionmaker[AsyncSession],
) -> None:
    form = declaration()
    first = await admin.declare_diagnostic('operator', form)
    assert first.administrative and first.member_count == 2 and first.purpose == 'diagnostic'
    replay = await admin.declare_diagnostic('operator', form.model_copy(update={'user_ids': ['2', '1']}))
    assert replay.id == first.id
    with pytest.raises(ObservationCommandConflict):
        await admin.declare_diagnostic('operator', form.model_copy(update={'payments_until': form.payments_until + 1}))
    other = await admin.declare_diagnostic('another-operator', form)
    assert other.id != first.id
    async with admin_db() as session:
        await session.execute(delete(User).where(User.id == '1'))
        await session.commit()
    assert (await admin.declare_diagnostic('operator', form)).id == first.id
    async with admin_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 2
        assert await session.scalar(select(func.count()).select_from(EmailObservationCommand)) == 2


@pytest.mark.asyncio
async def test_parallel_declaration_creates_one_population_and_receipt(
    admin_db: async_sessionmaker[AsyncSession],
) -> None:
    form = declaration()
    results = await asyncio.gather(
        admin.declare_diagnostic('operator', form), admin.declare_diagnostic('operator', form)
    )
    assert results[0].id == results[1].id
    async with admin_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 1
        assert await session.scalar(select(func.count()).select_from(EmailObservationCommand)) == 1
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationMember)) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('invalid', ['missing', 'admin', 'window', 'future'])
async def test_rejected_declaration_leaves_no_scope_or_command(
    admin_db: async_sessionmaker[AsyncSession], invalid: str
) -> None:
    form = declaration()
    if invalid == 'missing':
        form = form.model_copy(update={'user_ids': ['1', 'missing']})
    elif invalid == 'admin':
        async with admin_db() as session:
            await session.execute(update(User).where(User.id == '2').values(role='admin'))
            await session.commit()
    elif invalid == 'window':
        form = form.model_copy(update={'registrations_from': form.registrations_until - 1})
    else:
        form = form.model_copy(update={'registrations_until': int(time.time()) + 100})
    with pytest.raises(ValueError):
        await admin.declare_diagnostic('operator', form)
    async with admin_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 0
        assert await session.scalar(select(func.count()).select_from(EmailObservationCommand)) == 0


@pytest.mark.asyncio
async def test_start_replay_and_same_second_new_run_are_stable_and_content_free(
    admin_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    form = declaration()
    scope = await admin.declare_diagnostic('operator', form)
    now = int(time.time())
    monkeypatch.setattr(admin.time, 'time', lambda: now)
    request = admin.DiagnosticStart(request_key='start-1', expected_run_id=None)
    first, second = await asyncio.gather(
        admin.start_diagnostic('operator', scope.id, request), admin.start_diagnostic('operator', scope.id, request)
    )
    assert first.run_id == second.run_id and first.claim_id == second.claim_id
    assert first.claim_id and first.scope.observed_from == now
    page = admin.DiagnosticPage(run_id=first.run_id, claim_id=first.claim_id, expected_cursor=0)
    claim = await admin.owned_diagnostic_claim('operator', scope.id, page)
    result = await observer.observe_scope_page(scope.id, claim=claim, expected_cursor=0)
    assert result.completed
    replay = await admin.start_diagnostic('operator', scope.id, request)
    assert replay.run_id == first.run_id and replay.claim_id is None
    with pytest.raises(admin.DiagnosticOperationConflict, match='stale_run'):
        await admin.start_diagnostic(
            'operator', scope.id, admin.DiagnosticStart(request_key='stale', expected_run_id=None)
        )
    new = await admin.start_diagnostic(
        'operator', scope.id, admin.DiagnosticStart(request_key='start-2', expected_run_id=first.run_id)
    )
    assert new.run_id != first.run_id and new.scope.last_run and new.scope.last_run.id == new.run_id
    assert (await admin.diagnostic_scope(scope.id)).last_run.id == new.run_id
    assert 'claim_id' not in (await admin.diagnostic_scope(scope.id)).model_dump_json()
    async with admin_db() as session:
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationRun)) == 2
        assert await session.scalar(select(func.count()).select_from(EmailObservationCommand)) == 3


@pytest.mark.asyncio
async def test_different_operators_busy_and_expired_resume_cannot_reuse_old_credential(
    admin_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    scope = await admin.declare_diagnostic('a', declaration())
    first = await admin.start_diagnostic(
        'a', scope.id, admin.DiagnosticStart(request_key='a-start', expected_run_id=None)
    )
    assert first.claim_id
    old_page = admin.DiagnosticPage(run_id=first.run_id, claim_id=first.claim_id, expected_cursor=0)
    with pytest.raises(admin.DiagnosticOperationConflict, match='lease_not_owned'):
        await admin.owned_diagnostic_claim('b', scope.id, old_page)
    with pytest.raises(admin.DiagnosticOperationConflict, match='busy'):
        await admin.start_diagnostic(
            'b', scope.id, admin.DiagnosticStart(request_key='b-start', expected_run_id=first.run_id)
        )
    monkeypatch.setattr(admin.time, 'time', lambda: first.scope.last_run.lease_until)
    resumed = await admin.start_diagnostic(
        'b', scope.id, admin.DiagnosticStart(request_key='b-start', expected_run_id=first.run_id)
    )
    assert resumed.run_id == first.run_id and resumed.claim_id != first.claim_id
    with pytest.raises(observer.ObservationPageConflict, match='lease_lost'):
        await observer.observe_scope_page(
            scope.id, claim=await admin.owned_diagnostic_claim('a', scope.id, old_page), expected_cursor=0
        )
    current = await admin.diagnostic_scope(scope.id)
    assert current.last_run and current.last_run.status == 'running' and current.last_run.cursor == 0


@pytest.mark.asyncio
async def test_operational_path_preserves_all_sources_and_negative_members(
    admin_db: async_sessionmaker[AsyncSession],
) -> None:
    async with admin_db() as session:
        await session.execute(update(User).where(User.id == '1').values(email_verified=False))
        await session.execute(update(Auth).where(Auth.id == '2').values(active=False))
        await session.commit()
    before = await snapshot(admin_db)
    scope = await admin.declare_diagnostic('operator', declaration())
    lease = await admin.start_diagnostic(
        'operator', scope.id, admin.DiagnosticStart(request_key='run', expected_run_id=None)
    )
    assert lease.claim_id
    page = admin.DiagnosticPage(run_id=lease.run_id, claim_id=lease.claim_id, expected_cursor=0)
    await observer.observe_scope_page(
        scope.id, claim=await admin.owned_diagnostic_claim('operator', scope.id, page), expected_cursor=0
    )
    closed = await admin.close_diagnostic(scope.id)
    assert closed.closed_at and closed.last_run and closed.last_run.scanned_members == 2
    assert closed.last_run.scanned_scenarios == 12
    assert await snapshot(admin_db) == before
    with pytest.raises(admin.DiagnosticOperationConflict):
        await admin.start_diagnostic(
            'operator', scope.id, admin.DiagnosticStart(request_key='new', expected_run_id=lease.run_id)
        )


@pytest.mark.asyncio
async def test_list_keysets_and_legacy_purpose(admin_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    legacy = await runner_tests.scope(admin_db, now)
    for number in range(3):
        await admin.declare_diagnostic('operator', declaration(f'group-{number}'))
    first = await admin.diagnostic_scopes(None, 2)
    assert first.next_cursor
    second = await admin.diagnostic_scopes(first.next_cursor, 2)
    assert second.next_cursor is None
    assert len({row.id for row in first.items + second.items}) == 4
    old = await admin.diagnostic_scope(legacy)
    assert not old.administrative and old.purpose == 'diagnostic' and old.last_run is None


@pytest.mark.asyncio
async def test_every_http_action_requires_admin_and_has_no_store(admin_db: async_sessionmaker[AsyncSession]) -> None:
    app = FastAPI()
    app.include_router(routes.router, prefix='/observations')
    form = declaration()
    paths = [
        ('GET', '/observations', None),
        ('POST', '/observations', form.model_dump()),
        ('GET', '/observations/missing', None),
        ('POST', '/observations/missing/runs', {'request_key': 'run', 'expected_run_id': None}),
        ('POST', '/observations/missing/pages', {'run_id': 'run', 'claim_id': 'secret-claim', 'expected_cursor': 0}),
        ('POST', '/observations/missing/closure', None),
    ]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        async with admin_db() as session:
            account = UserModel.model_validate(await session.get(User, '1'), from_attributes=True)
        for role in ['anonymous', 'user', 'admin']:
            app.dependency_overrides.clear()
            if role != 'anonymous':
                app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': role})
            for method, path, body in paths:
                response = await client.request(method, path, json=body) if body else await client.request(method, path)
                assert response.headers['cache-control'] == 'no-store'
                if role != 'admin':
                    assert response.status_code in {401, 403}
                else:
                    assert response.status_code in {200, 404, 409}
                assert 'secret-claim' not in response.text and 'person1@airis.you' not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'change',
    [
        {'user_ids': []},
        {'user_ids': ['1', '1']},
        {'user_ids': ['1'] * 501},
        {'user_ids': ['']},
        {'user_ids': ['x' * 129]},
        {'now': 1},
        {'mode': 'dispatch'},
        {'registrations_until': '100'},
    ],
)
async def test_http_validation_rejects_entire_request_without_echoing_secrets(
    admin_db: async_sessionmaker[AsyncSession], change: dict[str, object]
) -> None:
    app = FastAPI()
    app.include_router(routes.router, prefix='/observations')
    async with admin_db() as session:
        account = UserModel.model_validate(await session.get(User, '1'), from_attributes=True)
    app.dependency_overrides[get_current_user] = lambda: account.model_copy(update={'role': 'admin'})
    body = declaration().model_dump() | change
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        result = await client.post('/observations', json=body)
    assert result.status_code == 422 and result.headers['cache-control'] == 'no-store'
    assert result.json() == {'detail': 'Invalid diagnostic request'}
    async with admin_db() as session:
        assert await session.scalar(select(func.count()).select_from(EmailObservationCommand)) == 0
        assert await session.scalar(select(func.count()).select_from(store.EmailObservationScope)) == 0


@pytest.mark.asyncio
async def test_command_migration_roundtrip_preserves_existing_journal(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now)
    await observer.observe_scope_page(scope_id, now=now + 1)
    migration = importlib.import_module('open_webui.migrations.versions.o1a020261003_add_email_observation_commands')
    async with observed_db() as session:
        engine = session.bind
        assert isinstance(engine, AsyncEngine)

    def verify(conn: Connection) -> None:
        before = set(inspect(conn).get_table_names())
        models = [
            store.EmailObservationScope,
            store.EmailObservationMember,
            store.EmailObservationRun,
            store.EmailScenarioObservation,
            store.EmailDecisionEvent,
        ]
        original = [list(conn.execute(select(model.__table__))) for model in models]
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            assert set(inspect(conn).get_table_names()) - before == {'airis_email_observation_command'}
            assert original == [list(conn.execute(select(model.__table__))) for model in models]
            migration.downgrade()
            assert set(inspect(conn).get_table_names()) == before
            migration.upgrade()
            migration.downgrade()
        assert original == [list(conn.execute(select(model.__table__))) for model in models]

    async with engine.begin() as conn:
        await conn.run_sync(verify)
