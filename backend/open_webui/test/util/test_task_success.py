"""Completion, replay, recovery and source-trust regression checks."""

import asyncio
import json
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from open_webui.internal.db import Base
from open_webui.models import chat_messages
from open_webui.models import task_success as journal
from open_webui.models.chats import Chat
from open_webui.models.users import User
from open_webui.utils.airis import task_success as rules
from sqlalchemy import delete, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.responses import StreamingResponse


@pytest_asyncio.fixture
async def database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        os.getenv('TASK_SUCCESS_TEST_DATABASE_URL', f'sqlite+aiosqlite:///{tmp_path / "success.db"}')
    )
    tables = [User.__table__, Chat.__table__, chat_messages.ChatMessage.__table__, journal.TaskSuccess.__table__]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    factory = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def context(db: AsyncSession | None = None) -> AsyncIterator[AsyncSession]:
        if db is not None:
            yield db
        else:
            async with factory() as session:
                yield session

    monkeypatch.setattr(journal, 'get_async_db_context', context)
    monkeypatch.setattr(chat_messages, 'get_async_db_context', context)
    async with factory() as session:
        session.add(
            User(
                id='owner',
                email='unused@airis.you',
                name='Test',
                role='user',
                created_at=1,
                updated_at=1,
                last_active_at=1,
            )
        )
        session.add(Chat(id='chat', user_id='owner', chat={}, created_at=1, updated_at=1))
        await session.commit()
    yield factory
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.drop_all(sync, tables=tables))
    await engine.dispose()


def proof(operation: str = 'operation', when: int = 1) -> journal.SuccessCheckpoint:
    return journal.SuccessCheckpoint(
        operation_id=operation, kind='foreground_chat', completed_at=when, source='saved_chat'
    )


@pytest.mark.asyncio
async def test_concurrent_models_replay_and_first_last(database: async_sessionmaker[AsyncSession]) -> None:
    await asyncio.gather(*(journal.insert_success('owner', proof()) for _ in range(12)))
    await journal.insert_success('owner', proof('operation', 0))
    await journal.insert_success('owner', proof('new-human-generation', 5))
    result = await journal.success_summary('owner')
    assert result.model_dump() == {'count': 2, 'first_at': 0, 'last_at': 5}
    assert (await journal.success_summary('other-account')).count == 0
    async with database() as session:
        columns = set(journal.TaskSuccess.__table__.columns.keys())
        assert columns == {'user_id', 'operation_id', 'kind', 'completed_at', 'source'}
        await journal.delete_task_success(session, 'owner')
        await session.execute(delete(User).where(User.id == 'owner'))
        await session.commit()
    await journal.insert_success('owner', proof('deleted'))
    assert (await journal.success_summary('owner')).count == 0


@pytest.mark.asyncio
async def test_saved_checkpoint_recovery_preserves_continuations_and_ignores_imports(
    database: async_sessionmaker[AsyncSession],
) -> None:
    data = {'role': 'assistant', 'content': 'visible', 'done': True, 'success_checkpoints': [proof('forged-client')]}
    await chat_messages.ChatMessages.upsert_message('message', 'chat', 'owner', data, success_checkpoint=proof())
    await chat_messages.ChatMessages.upsert_message(
        'message', 'chat', 'owner', data, success_checkpoint=proof('continuation', 2)
    )
    await chat_messages.ChatMessages.upsert_message('imported', 'chat', 'owner', data)
    assert await journal.reconcile_success(limit=1) == 1
    assert (await journal.success_summary('owner')).count == 2
    assert await journal.reconcile_success() == 0
    async with database() as session:
        rows = (await session.execute(select(chat_messages.ChatMessage))).scalars().all()
        assert all(row.success_checkpoints is None for row in rows)
    # A replay after checkpoint cleanup still hits the durable unique constraint.
    await journal.insert_success('owner', proof())
    assert (await journal.success_summary('owner')).count == 2


@pytest.mark.asyncio
async def test_exhausted_database_retry_keeps_saved_proof_and_recovers(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    await chat_messages.ChatMessages.upsert_message(
        'message', 'chat', 'owner', {'role': 'assistant', 'content': 'result'}, success_checkpoint=proof()
    )
    real_insert = journal.insert_success
    failing = AsyncMock(side_effect=OperationalError('private-statement', {}, Exception('private-data')))
    monkeypatch.setattr(journal, 'insert_success', failing)
    assert not await journal.record_success('owner', proof(), message_row_id='chat-message')
    assert failing.await_count == 3
    assert 'private-data' not in caplog.text and 'private-statement' not in caplog.text
    assert 'exhausted' in caplog.text
    monkeypatch.setattr(journal, 'insert_success', real_insert)
    assert await journal.reconcile_success() == 1
    assert (await journal.success_summary('owner')).count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'change,content,output',
    [
        ({'failed': True}, 'partial', None),
        ({'completed': False}, 'partial', None),
        ({}, '  ', None),
        ({}, '<think>hidden</think>', None),
        ({}, '<think>unfinished', None),
        ({}, 'ignored fallback', [{'type': 'reasoning', 'content': [{'text': 'hidden'}]}]),
        ({}, '', [{'type': 'function_call', 'status': 'completed'}]),
        ({'initial_text': 'old result'}, 'old result', None),
    ],
)
async def test_empty_failed_incomplete_reasoning_and_old_continuation_are_not_success(
    change: dict[str, object], content: str, output: list[dict[str, object]] | None
) -> None:
    assert await rules.completion_checkpoint('owner', {'airis_operation_id': 'op'}, content, output, **change) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'metadata',
    [
        {'internal': True},
        {'session_id': 'automation:1'},
        {'session_id': 'timer:1'},
        {'session_id': 'subagent:1'},
        {'session_id': 'subagent-result:1'},
        {'user_message': {'meta': {'internal': True}}},
    ],
)
async def test_background_producers_are_not_human_success(metadata: dict[str, object]) -> None:
    assert await rules.completion_checkpoint('owner', {'airis_operation_id': 'op', **metadata}, 'visible') is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'chat_id,source',
    [('', 'api'), ('local:1', 'temporary_chat'), ('temporary:1', 'temporary_chat'), ('chat', 'saved_chat')],
)
async def test_source_and_operation_ids(chat_id: str, source: str) -> None:
    group = [{'message_id': 'a'}, {'message_id': 'b'}]
    assert rules.operation_id(None, group) == rules.operation_id(None, group[::-1])
    assert rules.operation_id(None, group) != rules.operation_id(None, [{'message_id': 'regeneration'}])
    client = str(uuid.uuid4())
    assert rules.operation_id(client, group) == rules.operation_id(client, [])
    assert rules.operation_id(str(uuid.uuid4()), group) != rules.operation_id(client, group)
    checkpoint = await rules.completion_checkpoint(
        'owner', {'airis_operation_id': 'op', 'chat_id': chat_id}, 'real result'
    )
    assert checkpoint and checkpoint['source'] == source


@pytest.mark.asyncio
async def test_artifact_requires_displayed_owned_available_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    artifact = tmp_path / 'result.png'
    artifact.write_bytes(b'real-local-artifact')
    own = SimpleNamespace(path=str(artifact))
    resolver = AsyncMock(return_value=own)
    monkeypatch.setattr(rules.Files, 'get_file_by_id_and_user_id', resolver)
    output = [
        {'type': 'function_call_output', 'status': 'completed', 'files': [{'url': '/api/v1/files/owned/content'}]}
    ]
    metadata = {'airis_operation_id': 'op'}
    assert await rules.completion_checkpoint('owner', metadata, '', output)
    resolver.assert_awaited_with('owned', 'owner')
    assert (
        await rules.completion_checkpoint('owner', metadata, '', output, initial_files={'/api/v1/files/owned/content'})
        is None
    )
    resolver.return_value = None
    assert await rules.completion_checkpoint('owner', metadata, '', output) is None
    resolver.return_value = SimpleNamespace(path=str(tmp_path / 'missing'))
    assert await rules.completion_checkpoint('owner', metadata, '', output) is None
    output[0]['files'] = [{'url': 'http://127.0.0.1/private'}, {'url': 'https://outside.example/image.png'}]
    resolver.reset_mock()
    assert await rules.completion_checkpoint('owner', metadata, '', output) is None
    resolver.assert_not_awaited()


@pytest.mark.parametrize(
    'tail,expected',
    [
        ('data: [DONE]\n\n', (True, False)),
        ('data: {"error":{"message":"failed"}}\n\ndata: [DONE]\n\n', (True, True)),
        ('data: {"type":"response.incomplete"}\n\n', (False, True)),
        ('', (False, False)),
    ],
)
def test_terminal_and_error_signals_survive_byte_fragmentation(tail: str, expected: tuple[bool, bool]) -> None:
    observer = rules.CompletionStreamState()
    raw = (
        'data: ' + json.dumps({'choices': [{'delta': {'content': 'ответ'}}]}, ensure_ascii=False) + '\n\n' + tail
    ).encode()
    lines = []
    for byte in raw:
        lines.extend(observer.feed(bytes([byte])))
    lines.extend(observer.feed(b'', final=True))
    assert (observer.completed, observer.failed) == expected
    assert any('ответ' in line for line in lines)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'with_emitter,tail,expected',
    [
        (False, 'data: [DONE]\n\n', True),
        (True, 'data: [DONE]\n\n', True),
        (False, '', False),
        (True, '', False),
        (False, 'data: {"error":"failed"}\n\ndata: [DONE]\n\n', False),
        (True, 'data: {"error":"failed"}\n\ndata: [DONE]\n\n', False),
    ],
)
async def test_real_stream_handlers_use_common_completion_boundary(
    monkeypatch: pytest.MonkeyPatch, with_emitter: bool, tail: str, expected: bool
) -> None:
    from open_webui.utils import middleware

    for name in [
        'get_system_oauth_token',
        'get_filter_functions',
        'outlet_filter_handler',
        'background_tasks_handler',
        'publish_chat_finished_event',
    ]:
        monkeypatch.setattr(middleware, name, AsyncMock(return_value=[] if name == 'get_filter_functions' else None))
    monkeypatch.setattr(middleware.Config, 'get', AsyncMock(return_value=False))
    monkeypatch.setattr(middleware, 'ENABLE_API_OUTLET_FILTERS', False)
    monkeypatch.setattr(middleware, 'ENABLE_PLUGINS', False)
    recorded = AsyncMock()
    monkeypatch.setattr(middleware, 'record_success', recorded)

    async def chunks() -> AsyncIterator[bytes]:
        yield b'data: {"choices":[{"delta":{"content":"visible result"}}]}\n\n'
        if tail:
            yield tail.encode()

    response = StreamingResponse(chunks(), media_type='text/event-stream')
    ctx = {
        'request': SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(MODELS={})), state=SimpleNamespace()),
        'form_data': {'model': 'test', 'messages': [{'role': 'user', 'content': 'test'}]},
        'user': SimpleNamespace(id='owner', role='user'),
        'model': {'id': 'test'},
        'metadata': {'airis_operation_id': 'op', 'chat_id': 'temporary:1', 'message_id': 'message'},
        'events': [],
        'event_emitter': AsyncMock() if with_emitter else None,
        'event_caller': None,
    }
    result = await middleware.streaming_chat_response_handler(response, ctx)
    if result is not None:
        async for _ in result.body_iterator:
            pass
    assert recorded.await_count == 1
    assert bool(recorded.await_args.args[1]) is expected


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'with_emitter,error,output_only',
    [(False, False, False), (True, False, False), (False, True, False), (True, True, False), (True, False, True)],
)
async def test_real_nonstream_handler_checks_error_and_output_without_choices(
    monkeypatch: pytest.MonkeyPatch, with_emitter: bool, error: bool, output_only: bool
) -> None:
    from open_webui.utils import middleware

    for name in ['outlet_filter_handler', 'background_tasks_handler', 'publish_chat_finished_event']:
        monkeypatch.setattr(middleware, name, AsyncMock())
    recorded = AsyncMock()
    monkeypatch.setattr(middleware, 'record_success', recorded)
    monkeypatch.setattr(middleware, 'ENABLE_API_OUTLET_FILTERS', False)
    body = (
        {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'visible'}]}]}
        if output_only
        else {'choices': [{'message': {'content': 'visible'}}]}
    )
    if error:
        body['error'] = {'message': 'provider failed'}
    ctx = {
        'request': SimpleNamespace(state=SimpleNamespace()),
        'user': SimpleNamespace(id='owner'),
        'metadata': {'airis_operation_id': 'op', 'chat_id': 'temporary:1', 'message_id': 'm'},
        'events': [],
        'event_emitter': AsyncMock() if with_emitter else None,
    }
    await middleware.non_streaming_chat_response_handler(body, ctx)
    assert recorded.await_count == 1
    assert bool(recorded.await_args.args[1]) is not error


@pytest.mark.asyncio
async def test_stream_cancellation_does_not_record_partial_success(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.utils import middleware

    monkeypatch.setattr(middleware, 'get_system_oauth_token', AsyncMock(return_value=None))
    monkeypatch.setattr(middleware, 'ENABLE_PLUGINS', False)
    monkeypatch.setattr(middleware.Config, 'get', AsyncMock(return_value=False))
    recorded = AsyncMock()
    monkeypatch.setattr(middleware, 'record_success', recorded)

    async def cancelled() -> AsyncIterator[bytes]:
        yield b'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'
        raise asyncio.CancelledError

    ctx = {
        'request': SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(MODELS={})), state=SimpleNamespace()),
        'form_data': {'model': 'test', 'messages': []},
        'user': SimpleNamespace(id='owner', role='user'),
        'model': {'id': 'test'},
        'metadata': {'airis_operation_id': 'op', 'chat_id': 'temporary:1', 'message_id': 'message'},
        'events': [],
        'event_emitter': AsyncMock(),
        'event_caller': None,
    }
    with pytest.raises(asyncio.CancelledError):
        await middleware.streaming_chat_response_handler(
            StreamingResponse(cancelled(), media_type='text/event-stream'), ctx
        )
    recorded.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('realtime,usage', [(False, False), (True, False), (True, True)])
async def test_saved_stream_passes_server_checkpoint_in_all_save_modes(
    monkeypatch: pytest.MonkeyPatch, realtime: bool, usage: bool
) -> None:
    from open_webui.utils import middleware

    for name in [
        'get_system_oauth_token',
        'outlet_filter_handler',
        'background_tasks_handler',
        'publish_chat_finished_event',
    ]:
        monkeypatch.setattr(middleware, name, AsyncMock(return_value=None))
    monkeypatch.setattr(middleware, 'ENABLE_PLUGINS', False)
    monkeypatch.setattr(middleware, 'ENABLE_REALTIME_CHAT_SAVE', realtime)
    monkeypatch.setattr(middleware.Config, 'get', AsyncMock(return_value=False))
    monkeypatch.setattr(middleware.Chats, 'get_message_by_id_and_message_id', AsyncMock(return_value={'content': ''}))
    monkeypatch.setattr(middleware.Chats, 'get_chat_title_by_id', AsyncMock(return_value='Test'))
    saved = AsyncMock()
    monkeypatch.setattr(middleware.Chats, 'upsert_message_to_chat_by_id_and_message_id', saved)
    recorded = AsyncMock()
    monkeypatch.setattr(middleware, 'record_success', recorded)

    async def chunks() -> AsyncIterator[bytes]:
        yield b'data: {"choices":[{"delta":{"content":"visible result"}}]}\n\n'
        if usage:
            yield b'data: {"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n'
        yield b'data: [DONE]\n\n'

    ctx = {
        'request': SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(MODELS={})), state=SimpleNamespace()),
        'form_data': {'model': 'test', 'messages': [{'role': 'user', 'content': 'test'}]},
        'user': SimpleNamespace(id='owner', role='user'),
        'model': {'id': 'test'},
        'metadata': {'airis_operation_id': 'op', 'chat_id': 'chat', 'message_id': 'message'},
        'events': [],
        'event_emitter': AsyncMock(),
        'event_caller': None,
    }
    await middleware.streaming_chat_response_handler(StreamingResponse(chunks(), media_type='text/event-stream'), ctx)
    final_calls = [call for call in saved.await_args_list if call.kwargs.get('success_checkpoint')]
    assert len(final_calls) == 1
    assert final_calls[0].kwargs['success_checkpoint']['source'] == 'saved_chat'
    assert recorded.await_args.kwargs['message_row_id'] == 'chat-message'


@pytest.mark.asyncio
async def test_postgresql_concurrent_checkpoint_append_and_clear(database: async_sessionmaker[AsyncSession]) -> None:
    async with database() as session:
        if session.get_bind().dialect.name != 'postgresql':
            pytest.skip('PostgreSQL row-lock concurrency; SQLite ordinary/replay paths covered separately')
    await chat_messages.ChatMessages.upsert_message('message', 'chat', 'owner', {'role': 'assistant', 'done': False})
    await asyncio.gather(
        *(
            chat_messages.ChatMessages.upsert_message(
                'message',
                'chat',
                'owner',
                {'role': 'assistant', 'content': 'available', 'done': True},
                success_checkpoint=proof(f'continue-{index}', index + 1),
            )
            for index in range(12)
        )
    )
    assert await journal.reconcile_success() == 1
    assert (await journal.success_summary('owner')).count == 12
    assert await journal.reconcile_success() == 0


@pytest.mark.asyncio
async def test_api_filter_cannot_hide_provider_failure_from_success(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.utils import middleware

    monkeypatch.setattr(middleware, 'get_system_oauth_token', AsyncMock(return_value=None))
    monkeypatch.setattr(middleware, 'ENABLE_PLUGINS', False)
    monkeypatch.setattr(middleware, 'ENABLE_API_OUTLET_FILTERS', False)
    recorded = AsyncMock()
    monkeypatch.setattr(middleware, 'record_success', recorded)

    async def filter_data(**kwargs: object) -> tuple[object, None]:
        data = kwargs['form_data']
        return (None if isinstance(data, bytes) and b'error' in data else data), None

    monkeypatch.setattr(middleware, 'process_filter_functions', filter_data)

    async def chunks() -> AsyncIterator[bytes]:
        yield b'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'
        yield b'data: {"error":"failure"}\n\n'
        yield b'data: [DONE]\n\n'

    ctx = {
        'request': SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(MODELS={})), state=SimpleNamespace()),
        'form_data': {'model': 'test', 'messages': []},
        'user': SimpleNamespace(id='owner', role='user'),
        'model': {'id': 'test'},
        'metadata': {'airis_operation_id': 'op', 'chat_id': '', 'message_id': 'message'},
        'events': [],
        'event_emitter': None,
        'event_caller': None,
    }
    response = await middleware.streaming_chat_response_handler(
        StreamingResponse(chunks(), media_type='text/event-stream'), ctx
    )
    async for _ in response.body_iterator:
        pass
    assert recorded.await_count == 1
    assert recorded.await_args.args[1] is None
