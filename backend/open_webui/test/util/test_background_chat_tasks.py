import asyncio
import copy
from unittest.mock import AsyncMock

import pytest
from fastapi import Request
from open_webui.constants import TASKS
from open_webui.models.users import UserModel
from open_webui.utils import middleware


def _context(saved: bool) -> dict[str, object]:
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', created_at=0, updated_at=0, last_active_at=0
    )
    return {
        'request': Request({'type': 'http'}),
        'user': user,
        'form_data': {'model': 'fixture-model', 'messages': [{'id': 'user', 'role': 'user', 'content': 'question'}]},
        'metadata': {'chat_id': 'saved-fixture' if saved else 'local:fixture', 'message_id': 'answer'},
        'tasks': {TASKS.FOLLOW_UP_GENERATION: True, TASKS.TITLE_GENERATION: True, TASKS.TAGS_GENERATION: True},
        'event_emitter': AsyncMock(),
        'model': {'id': 'fixture-model'},
        'assistant_message': {'content': 'answer'},
    }


def _messages() -> dict[str, dict[str, object]]:
    return {
        'user': {'id': 'user', 'parentId': None, 'role': 'user', 'content': 'question'},
        'answer': {
            'id': 'answer',
            'parentId': 'user',
            'model': 'fixture-model',
            'content': [
                {'type': 'image_url', 'image_url': {'url': 'image'}},
                {'type': 'text', 'text': '  result <details>hidden</details> ![image](url)  '},
            ],
        },
    }


@pytest.mark.asyncio
@pytest.mark.parametrize('saved', [False, True])
@pytest.mark.parametrize(
    'case',
    [
        'valid',
        'reasoning',
        'broken-json',
        'no-response',
        'empty-choices',
        'provider-error',
        'persist-error',
        'emit-error',
        'cancel',
    ],
)
async def test_background_task_contract(monkeypatch: pytest.MonkeyPatch, saved: bool, case: str) -> None:
    ctx = _context(saved)
    messages = _messages()
    original = copy.deepcopy(messages)
    read = AsyncMock(return_value=messages)
    persist = AsyncMock(side_effect=RuntimeError('local write failure') if case == 'persist-error' else None)
    title = AsyncMock()
    tags = AsyncMock()
    review = AsyncMock()
    responses = [
        {'follow_ups': ['next']},
        {'title': 'Title'},
        {'tags': ['tag']},
    ]
    values = [
        {
            'choices': [
                {
                    'message': {
                        'reasoning_content' if case == 'reasoning' else 'content': middleware.JSONCodec.dumps(value)
                    }
                }
            ]
        }
        for value in responses
    ]
    if case in {'broken-json', 'no-response', 'empty-choices'}:
        first = {
            'broken-json': {'choices': [{'message': {'content': 'not-json'}}]},
            'no-response': None,
            'empty-choices': {'choices': []},
        }[case]
        values[0] = first
    generate_follow = AsyncMock(
        return_value=values[0],
        side_effect=(
            asyncio.CancelledError()
            if case == 'cancel'
            else RuntimeError('local provider failure') if case == 'provider-error' else None
        ),
    )
    generate_title = AsyncMock(return_value=values[1])
    generate_tags = AsyncMock(return_value=values[2])
    events = ctx['event_emitter']
    if case == 'emit-error':
        events.side_effect = [RuntimeError('local event failure'), None, None]
    monkeypatch.setattr(middleware.Chats, 'get_messages_map_by_chat_id', read)
    monkeypatch.setattr(middleware.Chats, 'upsert_message_to_chat_by_id_and_message_id', persist)
    monkeypatch.setattr(middleware.Chats, 'update_chat_title_by_id', title)
    monkeypatch.setattr(middleware.Chats, 'update_chat_tags_by_id', tags)
    monkeypatch.setattr(middleware, 'generate_follow_ups', generate_follow)
    monkeypatch.setattr(middleware, 'generate_title', generate_title)
    monkeypatch.setattr(middleware, 'generate_chat_tags', generate_tags)
    monkeypatch.setattr(middleware, 'review_memory_after_turn', review)
    if case in {'provider-error', 'cancel'}:
        with pytest.raises(asyncio.CancelledError if case == 'cancel' else RuntimeError):
            await middleware.background_tasks_handler(ctx)
        assert review.await_count == title.await_count == tags.await_count == 0
        return
    await middleware.background_tasks_handler(ctx)
    assert generate_follow.await_count == 1 and review.await_count == 1
    assert generate_title.await_count == generate_tags.await_count == (1 if saved else 0)
    if saved:
        assert read.await_count == 1
        assert generate_follow.call_args.args[1]['messages'] == [
            original['user'],
            {**original['answer'], 'role': 'assistant', 'content': 'result'},
        ]
        assert title.await_args.args == ('saved-fixture', 'Title')
        assert tags.await_args.args == ('saved-fixture', ['tag'], ctx['user'])
    else:
        assert read.await_count == 0
        assert ctx['form_data']['messages'][0]['model'] == 'fixture-model'
    follow_present = case not in {'broken-json', 'no-response', 'empty-choices'}
    expected = (['chat:message:follow_ups'] if follow_present else []) + (['chat:title', 'chat:tags'] if saved else [])
    assert [c.args[0]['type'] for c in events.await_args_list] == expected
    assert persist.await_count == (1 if saved and follow_present and case != 'emit-error' else 0)
    if persist.await_count:
        assert persist.await_args.kwargs == {'touch': False}
        assert persist.await_args.args == ('saved-fixture', 'answer', {'followUps': ['next']})
    assert messages == original
    assert review.call_args.kwargs['assistant_message'] is ctx['assistant_message']
    assert review.call_args.kwargs['model'] is ctx['model']


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['deleted', 'missing-model', 'no-tasks'])
async def test_background_task_guards(monkeypatch: pytest.MonkeyPatch, case: str) -> None:
    ctx = _context(True)
    messages = _messages()
    if case == 'missing-model':
        del messages['answer']['model']
    if case == 'no-tasks':
        ctx['tasks'] = {}
    generate = AsyncMock()
    review = AsyncMock()
    monkeypatch.setattr(
        middleware.Chats, 'get_messages_map_by_chat_id', AsyncMock(return_value={} if case == 'deleted' else messages)
    )
    monkeypatch.setattr(middleware, 'generate_follow_ups', generate)
    monkeypatch.setattr(middleware, 'review_memory_after_turn', review)
    await middleware.background_tasks_handler(ctx)
    assert generate.await_count == 0
    assert review.await_count == (1 if case == 'no-tasks' else 0)


@pytest.mark.asyncio
@pytest.mark.parametrize('enabled', [False, True])
async def test_background_title_fallback(monkeypatch: pytest.MonkeyPatch, enabled: bool) -> None:
    ctx = _context(True)
    ctx['tasks'] = {TASKS.TITLE_GENERATION: enabled}
    messages = _messages()
    messages['user']['content'] = 'x' * 120
    generated = AsyncMock(return_value={'choices': [{'message': {'content': '{}'}}]})
    update = AsyncMock()
    monkeypatch.setattr(middleware.Chats, 'get_messages_map_by_chat_id', AsyncMock(return_value=messages))
    monkeypatch.setattr(middleware.Chats, 'update_chat_title_by_id', update)
    monkeypatch.setattr(middleware, 'generate_title', generated)
    monkeypatch.setattr(middleware, 'review_memory_after_turn', AsyncMock())
    await middleware.background_tasks_handler(ctx)
    assert generated.await_count == 1 if enabled else generated.await_count == 0
    assert update.await_args.args == ('saved-fixture', 'x' * 100 + '...' if enabled else 'x' * 120)
