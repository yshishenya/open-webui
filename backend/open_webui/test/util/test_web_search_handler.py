import asyncio
import copy
from unittest.mock import AsyncMock, call

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from open_webui.models.users import UserModel
from open_webui.utils import middleware

CASES = {
    'valid': '{"queries": ["first", "second"]}',
    'fenced': '```json\n{"queries": ["first", "second"]}\n```',
    'raw': 'raw query',
    'truncated': '{not-json',
    'blank': '{"queries": ["  "]}',
    'empty': '{"queries": []}',
    'missing': '{}',
    'error-json': JSONResponse({'detail': 'model unavailable'}, status_code=503),
    'error-body': Response('not-json', status_code=503),
    'provider-error': RuntimeError('local generation failure'),
    'null': '{"queries": null}',
    'number': '{"queries": 42}',
    'string': '{"queries": "bad"}',
    'bad-item': '{"queries": [42]}',
    'null-item': '{"queries": [null]}',
    'secret-item': '{"queries": ["fixture-secret-must-not-be-logged", 42]}',
}


def _generated(case: str) -> object:
    value = CASES[case]
    if isinstance(value, Exception):
        raise value
    if isinstance(value, Response):
        return value
    return {'choices': [{'message': {'content': value}}]}


def _queries(case: str, path: str) -> list[str]:
    return {
        'valid': ['first', 'second'],
        'fenced': ['first', 'second'],
        'raw': ['raw query'],
        'truncated': ['question'] if path == 'web' else [''],
        'blank': ['question'] if path == 'web' else ['  '],
        'empty': [] if path == 'web' else ['question'],
        'missing': [] if path == 'web' else ['question'],
    }.get(case, ['question'])


@pytest.mark.asyncio
@pytest.mark.parametrize('path,cache_enabled', [('web', True), ('web', False), ('files', False)])
@pytest.mark.parametrize('case', CASES)
async def test_search_query_boundary(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, path: str, cache_enabled: bool, case: str
) -> None:
    app = FastAPI()
    app.state.EMBEDDING_FUNCTION = None
    app.state.RERANKING_FUNCTION = None
    request = Request({'type': 'http', 'app': app})
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', last_active_at=0, updated_at=0, created_at=0
    )
    events = AsyncMock()
    generate = AsyncMock(side_effect=lambda *args: _generated(case))
    web_search = AsyncMock(
        return_value={
            'collection_names': ['c1', 'c2'],
            'filenames': ['https://source.invalid'],
            'items': [{'title': 'source'}],
        }
    )
    sources = AsyncMock(return_value=[{'document': ['text'], 'metadata': [{'source': 'source-1'}]}])
    monkeypatch.setattr(middleware, 'ENABLE_QUERIES_CACHE', cache_enabled)
    monkeypatch.setattr(middleware, 'generate_queries', generate)
    monkeypatch.setattr(middleware, 'process_web_search', web_search)
    monkeypatch.setattr(middleware, 'get_sources_from_items', sources)
    monkeypatch.setattr(middleware.Config, 'get_many', AsyncMock(return_value={}))
    form = {'model': 'fixture-model', 'messages': [{'role': 'user', 'content': 'question'}]}
    original = copy.deepcopy(form)
    extra = {'__event_emitter__': events, '__chat_id__': 'fixture-chat'}
    if path == 'web':
        result = await middleware.chat_web_search_handler(request, form, extra, user)
        _assert_web_result(result, form, original, request, case, cache_enabled, web_search, events)
    else:
        form['metadata'] = {'chat_id': 'fixture-chat', 'files': [{'id': 'file-1', 'context': 'retrieval'}]}
        result, context = await middleware.chat_completion_files_handler(request, form, extra, user)
        assert result is form and context == {'sources': sources.return_value}
        assert sources.call_args.kwargs['queries'] == _queries(case, path)
        assert events.await_args_list[-1] == call(
            {'type': 'status', 'data': {'action': 'sources_retrieved', 'count': 1, 'done': True}}
        )
    assert generate.await_count == 1
    assert 'fixture-secret-must-not-be-logged' not in caplog.text


def _assert_web_result(
    result: object,
    form: dict[str, object],
    original: dict[str, object],
    request: Request,
    case: str,
    cache_enabled: bool,
    search: AsyncMock,
    events: AsyncMock,
) -> None:
    queries = _queries(case, 'web')
    assert result is form and form['messages'] == original['messages']
    expected_cache = {'blank': ['  '], 'truncated': ['']}.get(case, queries)
    if not cache_enabled or case in {
        'error-json',
        'error-body',
        'provider-error',
        'null',
        'number',
        'string',
        'bad-item',
        'null-item',
        'secret-item',
    }:
        assert not hasattr(request.state, 'cached_queries')
    else:
        assert request.state.cached_queries == expected_cache
    assert events.await_args_list[0] == call(
        {'type': 'status', 'data': {'action': 'web_search', 'description': 'Searching the web', 'done': False}}
    )
    if not queries:
        assert search.await_count == 0 and 'files' not in form
        assert events.await_args_list[-1] == call(
            {
                'type': 'status',
                'data': {'action': 'web_search', 'description': 'No search query generated', 'done': True},
            }
        )
        return
    assert search.call_args.args[1].model_dump() == {'queries': queries}
    assert form['files'] == [
        {
            'collection_name': name,
            'name': ', '.join(queries),
            'type': 'web_search',
            'urls': ['https://source.invalid'],
            'queries': queries,
        }
        for name in ['c1', 'c2']
    ]
    assert events.await_args_list[1] == call(
        {'type': 'status', 'data': {'action': 'web_search_queries_generated', 'queries': queries, 'done': False}}
    )
    assert events.await_args_list[-1] == call(
        {
            'type': 'status',
            'data': {
                'action': 'web_search',
                'description': 'Searched {{count}} sites',
                'urls': ['https://source.invalid'],
                'items': [{'title': 'source'}],
                'done': True,
            },
        }
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'result',
    [
        None,
        {},
        {'docs': ['doc'], 'filenames': ['url']},
        HTTPException(429, 'limited'),
        RuntimeError('local search failure'),
    ],
)
async def test_web_search_result_errors(monkeypatch: pytest.MonkeyPatch, result: object) -> None:
    request = Request({'type': 'http'})
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', last_active_at=0, updated_at=0, created_at=0
    )
    events = AsyncMock()
    search = AsyncMock(return_value=result, side_effect=result if isinstance(result, Exception) else None)
    monkeypatch.setattr(middleware, 'generate_queries', AsyncMock(return_value=_generated('valid')))
    monkeypatch.setattr(middleware, 'process_web_search', search)
    old_file = {'id': 'existing-file'}
    form = {'model': 'fixture-model', 'messages': [{'role': 'user', 'content': 'question'}], 'files': [old_file]}
    output = await middleware.chat_web_search_handler(request, form, {'__event_emitter__': events}, user)
    assert output is form and form['files'][0] is old_file
    expected = 'No search results found'
    if isinstance(result, Exception):
        expected = 'limited' if isinstance(result, HTTPException) else 'An error occurred while searching the web'
    if isinstance(result, dict) and result.get('docs'):
        expected = 'Searched {{count}} sites'
        assert form['files'][1]['docs'] == ['doc']
    assert events.await_args_list[-1].args[0]['data']['description'] == expected


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['generation', 'search'])
async def test_web_search_cancellation_propagates(monkeypatch: pytest.MonkeyPatch, stage: str) -> None:
    generate = AsyncMock(
        return_value=_generated('valid'), side_effect=asyncio.CancelledError() if stage == 'generation' else None
    )
    search = AsyncMock(side_effect=asyncio.CancelledError())
    events = AsyncMock()
    monkeypatch.setattr(middleware, 'generate_queries', generate)
    monkeypatch.setattr(middleware, 'process_web_search', search)
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', last_active_at=0, updated_at=0, created_at=0
    )
    form = {'model': 'fixture-model', 'messages': [{'role': 'user', 'content': 'question'}]}
    with pytest.raises(asyncio.CancelledError):
        await middleware.chat_web_search_handler(Request({'type': 'http'}), form, {'__event_emitter__': events}, user)
    assert generate.await_count == 1
    assert search.await_count == (1 if stage == 'search' else 0)
    assert events.await_count == (2 if stage == 'search' else 1)
    assert 'files' not in form
