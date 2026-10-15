"""Real API/JWT/database dispatch replay; the provider boundary is explicitly fake."""

import asyncio
import importlib
import json
import os
from collections.abc import Coroutine, Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from copy import deepcopy
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from anyio.from_thread import BlockingPortal, start_blocking_portal
from fastapi.testclient import TestClient
from open_webui import tasks
from open_webui.internal import db as native_db
from open_webui.models.access_grants import AccessGrants
from open_webui.models.chats import ChatForm, ChatModel, Chats
from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models
from open_webui.models.notes import NoteForm, Notes
from open_webui.models.task_success import success_summary
from open_webui.models.users import Users
from open_webui.utils.airis import chat_dispatch as rules
from open_webui.utils.auth import create_token, decode_token
from redis.asyncio import Redis
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.requests import Request

main = importlib.import_module('open_webui.main')
DispatchAPI = tuple[TestClient, dict[str, str], dict[str, object], list[str]]


def test_note_chat_creation_replays_the_original_chat(dispatch_api: DispatchAPI) -> None:
    client, headers, _, scheduled = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    note = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Replay note')))
    assert note is not None
    url = f'/api/v1/notes/{note.id}/chat?operation_id={uuid4()}'
    first = client.post(url, headers=headers)
    second = client.post(url, headers=headers)
    assert first.status_code == second.status_code == 200, (first.text, second.text)
    assert first.json()['id'] == second.json()['id']
    assert len(client.get(f'/api/v1/notes/{note.id}/chats', headers=headers).json()) == 1
    assert scheduled == []


@pytest.mark.parametrize('method', ['GET', 'POST'])
def test_concurrent_note_chat_creation_has_one_row(
    dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch, method: str
) -> None:
    client, headers, _, scheduled = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    note = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Concurrent note')))
    assert note is not None
    ready = asyncio.Event()
    entered = 0
    native_insert = Chats.insert_new_chat

    async def concurrent_insert(
        id: str,
        user_id: str,
        form_data: ChatForm,
        db: native_db.AsyncSession | None = None,
        *,
        internal_meta: dict[str, object] | None = None,
    ) -> ChatModel | None:
        nonlocal entered
        entered += 1
        if entered == 2:
            ready.set()
        await asyncio.wait_for(ready.wait(), timeout=5)
        return await native_insert(id, user_id, form_data, db=db, internal_meta=internal_meta)

    monkeypatch.setattr(Chats, 'insert_new_chat', concurrent_insert)
    url = f'/api/v1/notes/{note.id}/chat?operation_id={uuid4()}'
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: client.request(method, url, headers=headers), range(2)))
    assert [response.status_code for response in responses] == [200, 200], [response.text for response in responses]
    assert responses[0].json()['id'] == responses[1].json()['id']
    assert len(client.get(f'/api/v1/notes/{note.id}/chats', headers=headers).json()) == 1
    assert entered == 2 and scheduled == []


def test_note_chat_replay_preserves_edits_and_distinct_intents(dispatch_api: DispatchAPI) -> None:
    client, headers, _, _ = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    note = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Edited note')))
    assert note is not None
    url = f'/api/v1/notes/{note.id}/chat?operation_id={uuid4()}'
    first = client.post(url, headers=headers)
    assert first.status_code == 200
    chat_id = first.json()['id']
    updated = asyncio.run(
        Chats.update_chat_by_id(chat_id, {'title': 'User title', 'history': {'messages': {}, 'currentId': None}})
    )
    assert updated is not None
    replay = client.post(url, headers=headers)
    assert replay.status_code == 200 and replay.json()['chat']['title'] == 'User title'
    new_intent = client.post(f'/api/v1/notes/{note.id}/chat?operation_id={uuid4()}', headers=headers)
    legacy = client.post(f'/api/v1/notes/{note.id}/chat', headers=headers)
    assert new_intent.status_code == legacy.status_code == 200
    assert len({chat_id, new_intent.json()['id'], legacy.json()['id']}) == 3


def test_note_chat_operation_requires_auth_access_and_uuid(dispatch_api: DispatchAPI) -> None:
    client, headers, _, _ = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    note = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Private note')))
    assert note is not None
    url = f'/api/v1/notes/{note.id}/chat?operation_id={uuid4()}'
    assert client.post(url).status_code == 401
    assert client.post(f'/api/v1/notes/{note.id}/chat?operation_id=broken', headers=headers).status_code == 422
    other = asyncio.run(
        Users.insert_new_user(str(uuid4()), 'Other reader', f'{uuid4()}@example.invalid', '/user.png', role='user')
    )
    assert other is not None
    assert client.post(url, headers={'Authorization': f'Bearer {create_token({"id": other.id})}'}).status_code == 403
    assert client.get(f'/api/v1/notes/{note.id}/chats', headers=headers).json() == []


def test_same_note_operation_is_isolated_by_note_and_authorized_actor(dispatch_api: DispatchAPI) -> None:
    client, headers, _, _ = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    first = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='First note')))
    second = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Second note')))
    assert first is not None and second is not None
    other = asyncio.run(
        Users.insert_new_user(str(uuid4()), 'Shared reader', f'{uuid4()}@example.invalid', '/user.png', role='user')
    )
    assert other is not None
    asyncio.run(
        AccessGrants.set_access_grants(
            'note', first.id, [{'principal_type': 'user', 'principal_id': other.id, 'permission': 'read'}]
        )
    )
    operation = uuid4()
    first_result = client.post(f'/api/v1/notes/{first.id}/chat?operation_id={operation}', headers=headers)
    second_result = client.post(f'/api/v1/notes/{second.id}/chat?operation_id={operation}', headers=headers)
    shared = client.post(
        f'/api/v1/notes/{first.id}/chat?operation_id={operation}',
        headers={'Authorization': f'Bearer {create_token({"id": other.id})}'},
    )
    assert first_result.status_code == second_result.status_code == shared.status_code == 200
    assert len({first_result.json()['id'], second_result.json()['id'], shared.json()['id']}) == 3
    assert shared.json()['user_id'] == other.id


def test_note_operation_collision_does_not_overwrite_unrelated_chat(dispatch_api: DispatchAPI) -> None:
    from open_webui.utils.airis.note_chat import note_chat_id

    client, headers, _, _ = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    note = asyncio.run(Notes.insert_new_note(token['id'], NoteForm(title='Collision note')))
    assert note is not None
    operation = uuid4()
    chat_id = note_chat_id(token['id'], note.id, operation)
    original = asyncio.run(Chats.insert_new_chat(chat_id, token['id'], ChatForm(chat={'title': 'Keep this chat'})))
    assert original is not None
    response = client.post(f'/api/v1/notes/{note.id}/chat?operation_id={operation}', headers=headers)
    assert response.status_code == 409
    assert response.json()['detail']['error'] == 'note_chat_operation_conflict'
    saved = asyncio.run(Chats.get_chat_by_id(chat_id))
    assert saved is not None and saved.title == 'Keep this chat' and saved.meta == {}


@pytest.mark.asyncio
async def test_note_operation_database_failure_is_a_safe_503() -> None:
    from fastapi import HTTPException
    from open_webui.utils.airis.note_chat import create_or_replay_note_chat

    db = AsyncMock(spec=native_db.AsyncSession)
    db.get.side_effect = OperationalError('fixture sensitive database message', {}, RuntimeError('fixture'))
    with pytest.raises(HTTPException) as caught:
        await create_or_replay_note_chat('chat', 'user', 'note', ChatForm(chat={}), db)
    assert caught.value.status_code == 503
    assert caught.value.detail == {'error': 'note_chat_creation_unavailable'}
    db.commit.assert_not_called()


@pytest.fixture(autouse=True)
def separate_test_loops(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # TestClient and asyncio.run use separate loops; don't reuse SQLite thread connections between them.
    engine = create_async_engine(native_db.ASYNC_SQLALCHEMY_DATABASE_URL, poolclass=NullPool)
    monkeypatch.setattr(native_db, 'AsyncSessionLocal', async_sessionmaker(engine, expire_on_commit=False))
    # Keep the HTTP loop alive between requests, including failed requests with native activity writes.
    with start_blocking_portal() as portal:

        @contextmanager
        def http_portal(client: TestClient) -> Iterator[BlockingPortal]:
            yield portal

        monkeypatch.setattr(TestClient, '_portal_factory', http_portal)
        try:
            yield
        finally:

            async def finish_activity_writes() -> None:
                pending = [
                    task
                    for task in asyncio.all_tasks()
                    if getattr(task.get_coro(), 'cr_code', None) is Users.update_last_active_by_id.__code__
                ]
                await asyncio.wait_for(asyncio.gather(*pending), timeout=10)

            portal.call(finish_activity_writes)
    asyncio.run(engine.dispose())


@pytest.fixture
def dispatch_api(monkeypatch: pytest.MonkeyPatch) -> DispatchAPI:
    """Two identical HTTP requests must not create two chats or schedule two providers."""
    assert not main.app.dependency_overrides
    user_id, model_id = str(uuid4()), str(uuid4())
    user = asyncio.run(
        Users.insert_new_user(
            id=user_id,
            name='Dispatch replay acceptance',
            email=f'{user_id}@example.invalid',
            profile_image_url='/user.png',
            role='user',
        )
    )
    assert user is not None
    model = asyncio.run(
        Models.insert_new_model(
            ModelForm(id=model_id, name='Dispatch fixture', meta=ModelMeta(), params=ModelParams()),
            user_id,
        )
    )
    assert model is not None
    monkeypatch.setattr(main.app.state, 'MODELS', {model_id: {'id': model_id, 'name': model.name}})
    monkeypatch.setattr(main.app.state, 'redis', None)
    scheduled: list[str] = []

    async def schedule(
        redis: Redis | None,
        coroutine: Coroutine[object, object, object],
        id: str | None = None,
        task_id: str | None = None,
    ) -> tuple[str, None]:
        assert task_id is not None
        scheduled.append(task_id)
        coroutine.close()
        return task_id, None

    monkeypatch.setattr(main, 'create_task', schedule)
    payload = {
        'model': model_id,
        'operation_id': str(uuid4()),
        'session_id': 'fixture-socket',
        'parent_id': None,
        'message_ids': [{'model_id': model_id, 'message_id': str(uuid4()), 'modelIdx': 0}],
        'user_message': {
            'id': str(uuid4()),
            'parentId': None,
            'childrenIds': [],
            'role': 'user',
            'content': 'One visible task',
            'models': [model_id],
            'timestamp': 1791560000,
        },
    }
    headers = {'Authorization': f'Bearer {create_token({"id": user_id})}'}
    client = TestClient(main.app)
    return client, headers, payload, scheduled


@pytest.mark.parametrize('explicit_id', [True, False])
def test_duplicate_dispatch_returns_one_receipt(dispatch_api: DispatchAPI, explicit_id: bool) -> None:
    client, headers, payload, scheduled = dispatch_api
    if not explicit_id:
        payload.pop('operation_id')
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    second = client.post('/api/v1/chat/completions', headers=headers, json=payload)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    observation = {
        'first': first.json(),
        'second': second.json(),
        'scheduled': scheduled,
        'authOverrides': 0,
        'providerBoundaryFake': True,
    }
    if explicit_id and (path := os.getenv('CHAT_DISPATCH_PROOF_PATH')):
        Path(path).write_text(json.dumps(observation, indent=2) + '\n')
    assert first.json() == second.json(), observation
    assert len(scheduled) == 1, observation
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    assert asyncio.run(success_summary(token['id'])).count == 0  # Acceptance is not a completed answer.


@pytest.mark.asyncio
async def test_redis_registration_failure_never_starts_coroutine(monkeypatch: pytest.MonkeyPatch) -> None:
    """The common scheduler must not launch a provider while registration is failing."""
    started: list[bool] = []

    async def provider() -> None:
        started.append(True)

    async def registration(redis: Redis, task_id: str, item_id: str | None) -> None:
        await asyncio.sleep(0)
        raise RuntimeError('Fixture registration failed')

    monkeypatch.setattr(tasks, 'redis_save_task', registration)
    monkeypatch.setattr(tasks, 'redis_cleanup_task', AsyncMock())
    redis = Redis()
    try:
        with pytest.raises(RuntimeError, match='Fixture registration failed'):
            await tasks.create_task(redis, provider(), id='fixture-chat')
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert started == []
    finally:
        await redis.aclose()


def test_transport_reconnect_and_new_client_replay(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    payload['metadata'] = {'request_id': 'first', 'purpose': 'kept'}
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == 200
    payload['session_id'] = 'reconnected-socket'
    payload['metadata'] = {'request_id': 'second', 'purpose': 'kept'}
    importlib.reload(rules)  # No in-process cache is required to replay the receipt.
    second = TestClient(main.app).post('/api/chat/completions', headers=headers, json=payload)
    assert second.status_code == 200
    assert second.json() == first.json()
    assert len(scheduled) == 1


@pytest.mark.parametrize('field', ['params', 'user_message', 'metadata'])
def test_changed_semantic_payload_never_dispatches_again(dispatch_api: DispatchAPI, field: str) -> None:
    client, headers, payload, scheduled = dispatch_api
    assert client.post('/api/chat/completions', headers=headers, json=payload).status_code == 200
    changed = deepcopy(payload)
    changed[field] = {'content': 'changed'}
    result = client.post('/api/chat/completions', headers=headers, json=changed)
    assert result.status_code == 409
    assert result.json()['detail']['error'] == 'dispatch_payload_conflict'
    assert len(scheduled) == 1


def test_invalid_uuid_and_missing_auth_never_dispatch(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    assert client.post('/api/chat/completions', json=payload).status_code == 401
    payload['operation_id'] = 'invalid'
    result = client.post('/api/chat/completions', headers=headers, json=payload)
    assert result.status_code == 422
    assert scheduled == []


def test_other_user_cannot_replay_owners_receipt(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == 200
    other = asyncio.run(
        Users.insert_new_user(str(uuid4()), 'Other user', f'{uuid4()}@example.invalid', '/user.png', role='user')
    )
    assert other is not None
    result = client.post(
        '/api/chat/completions', json=payload, headers={'Authorization': f'Bearer {create_token({"id": other.id})}'}
    )
    assert result.status_code in (400, 403)  # Native model access denial, never the owner's receipt.
    assert result.json() != first.json()
    assert len(scheduled) == 1


@pytest.mark.asyncio
async def test_concurrent_request_has_one_owner(dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    _, headers, payload, scheduled = dispatch_api
    registered, release = asyncio.Event(), asyncio.Event()
    native = main.create_task

    async def paused(
        redis: Redis | None,
        coroutine: Coroutine[object, object, object],
        id: str | None = None,
        task_id: str | None = None,
    ) -> tuple[str, None]:
        registered.set()
        await release.wait()
        return await native(redis, coroutine, id=id, task_id=task_id)

    monkeypatch.setattr(main, 'create_task', paused)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='http://fixture') as client:
        first = asyncio.create_task(client.post('/api/chat/completions', headers=headers, json=payload))
        await asyncio.wait_for(registered.wait(), timeout=10)
        try:
            second = await client.post('/api/chat/completions', headers=headers, json=payload)
            assert second.status_code == 409
            assert second.json()['detail']['error'] == 'dispatch_pending_or_unknown'
        finally:
            release.set()
        accepted = await first
        assert accepted.status_code == 200
        replay = await client.post('/api/chat/completions', headers=headers, json=payload)
        assert replay.json() == accepted.json()
        assert len(scheduled) == 1


def test_committed_claim_survives_lost_process(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    # Obtain the authenticated account from the real signed token without an auth override.
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    user_id = token['id']
    scope = {'type': 'http', 'app': main.app, 'headers': [], 'state': {}}
    key = rules.dispatch_identity(Request(scope), payload)
    assert key is not None
    row, owned = asyncio.run(rules.reserve_dispatch(user_id, key, rules.dispatch_hash(payload)))
    assert owned and row.receipt is None
    importlib.reload(rules)
    result = client.post('/api/chat/completions', headers=headers, json=payload)
    assert result.status_code == 409
    assert scheduled == []


@pytest.mark.parametrize('stage', ['reserve', 'accept'])
def test_database_failure_is_safe_to_retry(
    dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch, stage: str, caplog: pytest.LogCaptureFixture
) -> None:
    client, headers, payload, scheduled = dispatch_api
    real = getattr(rules, f'{stage}_dispatch')
    failing = AsyncMock(side_effect=OperationalError('private-statement', {}, Exception('private-data')))
    monkeypatch.setattr(rules, f'{stage}_dispatch', failing)
    result = client.post('/api/chat/completions', headers=headers, json=payload)
    assert result.status_code == 503
    assert len(scheduled) == (0 if stage == 'reserve' else 1)
    assert 'private-statement' not in caplog.text and 'private-data' not in caplog.text
    monkeypatch.setattr(rules, f'{stage}_dispatch', real)
    replay = client.post('/api/chat/completions', headers=headers, json=payload)
    assert replay.status_code == (200 if stage == 'reserve' else 409)
    assert len(scheduled) == 1


def test_multi_model_replay_and_title_have_no_extra_work(
    dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, headers, payload, scheduled = dispatch_api
    entries = payload['message_ids']
    assert isinstance(entries, list)
    entries.append({'model_id': payload['model'], 'message_id': str(uuid4()), 'modelIdx': 1})
    title = AsyncMock()
    monkeypatch.setattr(main, 'background_tasks_handler', title)
    payload['background_tasks'] = {'title_generation': True}
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    second = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(scheduled) == 2
    assert title.await_count == 1


def test_partial_multi_model_dispatch_is_never_restarted(
    dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, headers, payload, scheduled = dispatch_api
    entries = payload['message_ids']
    assert isinstance(entries, list)
    entries.append({'model_id': payload['model'], 'message_id': str(uuid4()), 'modelIdx': 1})
    native = main.create_task

    async def fail_second(
        redis: Redis | None,
        coroutine: Coroutine[object, object, object],
        id: str | None = None,
        task_id: str | None = None,
    ) -> tuple[str, None]:
        if scheduled:
            coroutine.close()
            raise RuntimeError('Fixture partial registration failure')
        return await native(redis, coroutine, id=id, task_id=task_id)

    monkeypatch.setattr(main, 'create_task', fail_second)
    client = TestClient(main.app, raise_server_exceptions=False)
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == 500
    second = client.post('/api/chat/completions', headers=headers, json=payload)
    assert second.status_code == 409
    assert len(scheduled) == 1


@pytest.mark.asyncio
async def test_registration_cancel_closes_unstarted_work(monkeypatch: pytest.MonkeyPatch) -> None:
    started: list[bool] = []
    entered = asyncio.Event()

    async def provider() -> None:
        started.append(True)

    async def registration(redis: Redis, task_id: str, item_id: str | None) -> None:
        entered.set()
        await asyncio.Future()

    monkeypatch.setattr(tasks, 'redis_save_task', registration)
    redis = Redis()
    work = provider()
    pending = asyncio.create_task(tasks.create_task(redis, work, id='cancelled-fixture'))
    try:
        await asyncio.wait_for(entered.wait(), 5)
        pending.cancel()
        with pytest.raises(asyncio.CancelledError):
            await pending
        assert started == [] and work.cr_frame is None
    finally:
        await redis.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize('registered', [True, False])
async def test_registered_work_runs_and_cleans_up(monkeypatch: pytest.MonkeyPatch, registered: bool) -> None:
    order: list[str] = []

    async def provider() -> str:
        order.append('run')
        return 'result'

    async def registration(redis: Redis, task_id: str, item_id: str | None) -> None:
        await asyncio.sleep(0)
        order.append('registered')

    cleanup = AsyncMock()
    monkeypatch.setattr(tasks, 'redis_save_task', registration)
    monkeypatch.setattr(tasks, 'redis_cleanup_task', cleanup)
    redis = Redis() if registered else None
    try:
        task_id, work = await tasks.create_task(redis, provider(), id='successful-fixture')
        assert await work == 'result'
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert order == (['registered', 'run'] if registered else ['run'])
        assert task_id not in tasks.tasks
        assert 'successful-fixture' not in tasks.item_tasks
        assert cleanup.await_count == int(registered)
    finally:
        if redis:
            await redis.aclose()


@pytest.mark.parametrize('intent', ['continue', 'regenerate', 'followup', 'temporary'])
def test_new_intents_have_new_receipts_and_stable_replays(dispatch_api: DispatchAPI, intent: str) -> None:
    client, headers, payload, scheduled = dispatch_api
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == 200
    previous = payload['message_ids']
    assert isinstance(previous, list)
    previous_id = previous[0]['message_id']
    payload['chat_id'] = first.json()['chat_id']
    payload['operation_id'] = str(uuid4())
    if intent == 'continue':
        payload['assistant_message_id'] = previous_id
    else:
        previous[0]['message_id'] = str(uuid4())
    if intent == 'followup':
        user_message = payload['user_message']
        assert isinstance(user_message, dict)
        user_message['id'] = str(uuid4())
        user_message['parentId'] = previous_id
        payload['parent_id'] = previous_id
    elif intent == 'temporary':
        payload['chat_id'] = 'temporary:fixture-socket'
    second = client.post('/api/chat/completions', headers=headers, json=payload)
    replay = client.post('/api/chat/completions', headers=headers, json=payload)
    assert second.status_code == replay.status_code == 200
    assert second.json() == replay.json()
    assert second.json()['task_ids'] != first.json()['task_ids']
    assert len(scheduled) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['legacy', 'internal', 'legacy-continuation'])
async def test_native_bypass_contracts(dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch, path: str) -> None:
    _, headers, payload, _ = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    user = await Users.get_user_by_id(token['id'])
    assert user is not None
    scope = {'type': 'http', 'app': main.app, 'headers': [], 'state': {}}
    request = Request(scope)
    if path == 'internal':
        request.state.internal = True
    elif path == 'legacy':
        payload.pop('parent_id')
    else:
        payload.pop('operation_id')
        payload['assistant_message_id'] = str(uuid4())
    result = {'legacy': 'native result'}
    handler = AsyncMock(return_value=result)
    reserve = AsyncMock(side_effect=AssertionError('Native bypass must not reserve'))
    monkeypatch.setattr(rules, 'reserve_dispatch', reserve)
    assert await rules.dispatch_chat(request, payload, user, handler) is result
    handler.assert_awaited_once_with(request, payload, user)
    reserve.assert_not_awaited()


def test_read_receipt_never_dispatches_and_requires_actor(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    url = f"/api/v1/chat/dispatches/{payload['operation_id']}"
    assert client.get(url).status_code == 401
    absent = client.get(url, headers=headers)
    assert absent.status_code == 200, absent.text
    assert absent.json() == {'state': 'absent', 'receipt': None}
    assert scheduled == []
    accepted = client.post('/api/chat/completions', headers=headers, json=payload)
    assert accepted.status_code == 200
    for _ in range(2):
        read = client.get(url, headers=headers)
        assert read.status_code == 200, read.text
        assert read.json() == {'state': 'accepted', 'receipt': accepted.json()}
        assert read.headers['cache-control'] == 'no-store'
    assert len(scheduled) == 1


def test_read_unknown_never_launches_or_expires(dispatch_api: DispatchAPI) -> None:
    from open_webui.models.chat_dispatch import reserve_dispatch

    client, headers, payload, scheduled = dispatch_api
    token = decode_token(headers['Authorization'].split()[1])
    assert token is not None
    key = rules.operation_id(payload['operation_id'], [])
    asyncio.run(reserve_dispatch(token['id'], key, rules.dispatch_hash(payload)))
    url = f"/api/v1/chat/dispatches/{payload['operation_id']}"
    for _ in range(2):
        response = client.get(url, headers=headers)
        assert response.status_code == 200
        assert response.json() == {'state': 'unknown', 'receipt': None}
    assert scheduled == []


def test_read_receipt_account_isolation_and_uuid_normalization(dispatch_api: DispatchAPI) -> None:
    client, headers, payload, scheduled = dispatch_api
    first = client.post('/api/chat/completions', headers=headers, json=payload)
    assert first.status_code == 200
    url = f"/api/v1/chat/dispatches/{str(payload['operation_id']).upper()}"
    assert client.get(url, headers=headers).json()['receipt'] == first.json()
    other = asyncio.run(
        Users.insert_new_user(str(uuid4()), 'Lookup other', f'{uuid4()}@example.invalid', '/user.png', role='user')
    )
    assert other is not None
    response = client.get(url, headers={'Authorization': f'Bearer {create_token({"id": other.id})}'})
    assert response.status_code == 200
    assert response.json() == {'state': 'absent', 'receipt': None}
    assert len(scheduled) == 1


def test_read_invalid_id_and_database_failure(dispatch_api: DispatchAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.routers.airis import chat_dispatch as router

    client, headers, payload, scheduled = dispatch_api
    assert client.get('/api/v1/chat/dispatches/invalid', headers=headers).status_code == 422
    monkeypatch.setattr(
        router, 'get_dispatch', AsyncMock(side_effect=OperationalError('private', {}, Exception('private')))
    )
    response = client.get(f"/api/v1/chat/dispatches/{payload['operation_id']}", headers=headers)
    assert response.status_code == 503
    assert response.json() == {'detail': {'error': 'dispatch_journal_unavailable'}}
    assert 'private' not in response.text
    assert scheduled == []
