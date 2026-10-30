import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI, HTTPException, Request
from open_webui.models.skills import SkillModel, Skills
from open_webui.models.users import UserModel
from open_webui.utils import middleware


@pytest.fixture
def payload(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    model = {'id': 'fixture', 'owned_by': 'openai', 'info': {'meta': {}}}
    app = FastAPI()
    app.state.MODELS = {'fixture': model}
    app.state.redis = None
    request = Request({'type': 'http', 'app': app})
    user = UserModel(
        id='fixture-user',
        email='fixture@example.invalid',
        name='Fixture',
        role='user',
        created_at=0,
        updated_at=0,
        last_active_at=0,
    )
    form = {'model': 'fixture', 'messages': [{'role': 'user', 'content': 'question'}]}
    metadata = {'chat_id': 'local:fixture', 'message_id': 'answer', 'params': {'function_calling': 'native'}}
    config = {'web.search.enable': True}
    mocks = {}
    for name, value in [
        ('get_event_emitter', AsyncMock()),
        ('get_event_call', None),
        ('get_system_oauth_token', None),
        ('load_messages_from_db', None),
        ('get_filter_functions', []),
        ('has_permission', True),
        ('get_tools', {}),
        ('get_terminal_tools', {}),
        ('get_builtin_tools', {}),
        ('connect_mcp_server', None),
        ('resolve_system_prompt', None),
        ('has_folder_access', True),
        ('get_owner_accessible_folder_files', []),
    ]:
        mocks[name] = AsyncMock(return_value=value)
        monkeypatch.setattr(middleware, name, mocks[name])
    for name in [
        'process_pipeline_inlet_filter',
        'convert_url_images_to_base64',
        'chat_web_search_handler',
        'chat_image_generation_handler',
        'add_memory_context',
    ]:
        mocks[name] = AsyncMock(
            side_effect=lambda request_or_form, form=None, *args, **kwargs: request_or_form if form is None else form
        )
        monkeypatch.setattr(middleware, name, mocks[name])
    mocks['apply_system_prompt_to_body'] = AsyncMock(side_effect=lambda content, body, *args, **kwargs: body)
    mocks['process_filter_functions'] = AsyncMock(side_effect=lambda **kwargs: (kwargs['form_data'], {}))
    mocks['chat_completion_files_handler'] = AsyncMock(side_effect=lambda request, body, *args: (body, {'sources': []}))
    mocks['chat_completion_tools_handler'] = AsyncMock(side_effect=lambda request, body, *args: (body, {'sources': []}))
    mocks['compact_messages_for_request'] = AsyncMock(
        side_effect=lambda request, user, messages, *args: (messages, None, 0)
    )
    mocks['apply_source_context_to_messages'] = AsyncMock(side_effect=lambda request, messages, *args: messages)
    mocks['add_file_context'] = Mock(side_effect=lambda messages, *args: messages)
    for name in [
        'apply_system_prompt_to_body',
        'process_filter_functions',
        'chat_completion_files_handler',
        'chat_completion_tools_handler',
        'compact_messages_for_request',
        'apply_source_context_to_messages',
        'add_file_context',
    ]:
        monkeypatch.setattr(middleware, name, mocks[name])
    for obj, name, value in [
        (middleware.Chats, 'get_chat_folder_id', None),
        (middleware.Chats, 'get_chat_by_id', None),
        (middleware.Chats, 'get_message_by_id_and_message_id', None),
        (middleware.Folders, 'get_folder_by_id', None),
        (middleware.Notes, 'get_note_by_id', None),
        (middleware.AccessGrants, 'has_access', False),
        (Skills, 'get_skills', []),
    ]:
        mocks[name] = AsyncMock(return_value=value)
        monkeypatch.setattr(obj, name, mocks[name])
    monkeypatch.setattr(
        middleware.Config, 'get', AsyncMock(side_effect=lambda key, default=None: config.get(key, default))
    )
    monkeypatch.setattr(
        middleware.Config, 'get_many', AsyncMock(side_effect=lambda *keys: {key: config.get(key) for key in keys})
    )
    monkeypatch.setattr(middleware, 'ENABLE_FUNCTIONS', False)
    monkeypatch.setattr(middleware, 'ENABLE_TOOL_SERVERS', True)
    import open_webui.utils.terminals as terminals

    monkeypatch.setattr(terminals, 'get_terminal_agents_md', AsyncMock(return_value=None))
    monkeypatch.setattr(terminals, 'get_terminal_json', AsyncMock(return_value=None))
    return {
        'request': request,
        'form_data': form,
        'user': user,
        'metadata': metadata,
        'model': model,
        'mocks': mocks,
        'config': config,
        'monkeypatch': monkeypatch,
    }


async def _run(
    payload: dict[str, object],
) -> tuple[dict[str, object], dict[str, object], list[dict[str, object]], bool]:
    return await middleware.process_chat_payload(
        **{key: payload[key] for key in ['request', 'form_data', 'user', 'metadata', 'model']}
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'case', ['basic', 'missing-chat-id', 'direct', 'arena', 'arena-exclude', 'arena-empty', 'regenerate']
)
async def test_payload_entry(payload: dict[str, object], case: str) -> None:
    form, metadata, request = payload['form_data'], payload['metadata'], payload['request']
    if case == 'missing-chat-id':
        metadata['chat_id'] = None
    if case == 'direct':
        request.state.direct = True
        request.state.model = payload['model']
    if case.startswith('arena'):
        payload['model'] = {
            'id': 'arena',
            'owned_by': 'arena',
            'info': {
                'meta': {
                    'model_ids': ['skip'] if case == 'arena-exclude' else ['fixture'] if case == 'arena' else [],
                    'filter_mode': 'exclude' if case == 'arena-exclude' else 'include',
                }
            },
        }
        form['model'] = 'arena'
    if case == 'regenerate':
        form['regeneration_prompt'] = 'try again'
    result, meta, events, _ = await _run(payload)
    assert result is form and meta is metadata and events == []
    assert form['model'] == 'fixture' and 'features' not in form and 'params' not in form
    assert meta['chat_id'] == ('' if case == 'missing-chat-id' else 'local:fixture')
    assert 'selected_model_id' in meta if case.startswith('arena') else 'selected_model_id' not in meta
    assert meta['base_user_prompt'] == ('try again' if case == 'regenerate' else 'question')


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['history', 'continue', 'images', 'compaction-error', 'summary', 'cancel'])
async def test_payload_history(payload: dict[str, object], case: str) -> None:
    meta, mocks = payload['metadata'], payload['mocks']
    meta.update(chat_id='saved-fixture', user_message_id='user')
    history = [{'id': 'user', 'role': 'user', 'content': 'stored question'}]
    if case == 'images':
        history[0]['files'] = [{'type': 'image', 'url': 'data:image/png;base64,eA=='}]
    if case == 'continue':
        meta['assistant_message_id'] = 'answer'
        mocks['get_message_by_id_and_message_id'].return_value = {
            'id': 'answer',
            'role': 'assistant',
            'content': 'partial',
            'private_field': 'omit',
        }
    if case == 'summary':
        mocks['compact_messages_for_request'].side_effect = lambda request, user, messages, *args: (
            messages,
            'summary',
            0,
        )
    if case in {'compaction-error', 'cancel'}:
        mocks['compact_messages_for_request'].side_effect = (
            asyncio.CancelledError() if case == 'cancel' else RuntimeError('local failure')
        )
    mocks['load_messages_from_db'].return_value = history
    if case == 'cancel':
        with pytest.raises(asyncio.CancelledError):
            await _run(payload)
        return
    result, _, _, _ = await _run(payload)
    assert mocks['load_messages_from_db'].await_args.args == ('saved-fixture', 'user')
    assert mocks['compact_messages_for_request'].await_count == 1
    assert 'stored question' in str(result['messages'])
    assert 'private_field' not in str(result['messages']) and 'files' not in result['messages'][-1]
    assert ('partial' in str(result['messages'])) == (case == 'continue')
    assert ('[CONVERSATION SUMMARY]' in str(result['messages'])) == (case == 'summary')
    assert ('image_url' in str(result['messages'])) == (case == 'images')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'feature,mode,allowed',
    [
        ('web_search', 'legacy', True),
        ('web_search', 'legacy', False),
        ('web_search', 'native', True),
        ('image_generation', 'legacy', True),
        ('image_generation', 'legacy', False),
        ('image_generation', 'native', True),
    ],
)
async def test_payload_feature_permissions(payload: dict[str, object], feature: str, mode: str, allowed: bool) -> None:
    payload['form_data']['features'] = {feature: True}
    payload['metadata']['params']['function_calling'] = mode
    payload['mocks']['has_permission'].return_value = allowed
    result, meta, _, _ = await _run(payload)
    name = 'chat_web_search_handler' if feature == 'web_search' else 'chat_image_generation_handler'
    assert payload['mocks'][name].await_count == (1 if mode == 'legacy' and allowed else 0)
    assert payload['mocks']['has_permission'].await_args.args[1] == 'features.' + feature
    assert meta['features'] == {feature: True} and 'features' not in result


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'mode,engine', [('legacy', 'pyodide'), ('native', 'pyodide'), ('legacy', 'jupyter'), ('native', 'jupyter')]
)
async def test_payload_code_context(payload: dict[str, object], mode: str, engine: str) -> None:
    payload['form_data']['features'] = {'code_interpreter': True, 'voice': True, 'memory': True}
    payload['metadata']['params']['function_calling'] = mode
    payload['config'].update(
        {
            'code_interpreter.engine': engine,
            'code_interpreter.prompt_template': '',
            'task.voice.prompt.enable': True,
            'task.voice.prompt_template': 'voice prompt',
            'memories.system_context.enable': True,
            'memories.enable': True,
        }
    )
    result, _, _, _ = await _run(payload)
    assert payload['mocks']['add_memory_context'].await_count == 1
    assert 'voice prompt' in str(result['messages'])
    assert (
        middleware.CODE_INTERPRETER_PYODIDE_PROMPT in '\n'.join(message['content'] for message in result['messages'])
    ) == (engine != 'jupyter')
    if mode == 'legacy':
        assert middleware.DEFAULT_CODE_INTERPRETER_PROMPT in result['messages'][-1]['content']


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'case',
    ['folder-legacy', 'folder-native', 'folder-denied', 'knowledge-legacy', 'knowledge-native', 'null-meta', 'sources'],
)
async def test_payload_context(payload: dict[str, object], case: str) -> None:
    form, meta, model, mocks = payload['form_data'], payload['metadata'], payload['model'], payload['mocks']
    if case.startswith('folder'):
        meta['folder_id'] = 'folder'
        mocks['get_folder_by_id'].return_value = SimpleNamespace(
            id='folder', data={'system_prompt': 'folder prompt', 'files': [{'id': 'attached'}]}
        )
        mocks['get_owner_accessible_folder_files'].return_value = [{'id': 'owner-file'}]
        mocks['has_folder_access'].return_value = case != 'folder-denied'
    if case.startswith('knowledge'):
        model['info']['meta']['knowledge'] = [{'collection_name': 'collection', 'name': 'Knowledge'}]
    if case.endswith('legacy'):
        meta['params']['function_calling'] = 'legacy'
    if case == 'null-meta':
        model['info'] = None
    if case == 'sources':
        source = {'source': {'id': 'source-1'}, 'document': ['text']}
        mocks['chat_completion_files_handler'].side_effect = lambda request, body, *args: (
            body,
            {'sources': [source, {'document': ['ignored']}]},
        )
    result, _, events, _ = await _run(payload)
    assert result is form
    assert mocks['apply_system_prompt_to_body'].await_count == (1 if case in {'folder-legacy', 'folder-native'} else 0)
    assert meta.get('folder_knowledge') == ([{'id': 'owner-file'}] if case == 'folder-native' else None)
    assert bool(meta['files']) == (case in {'folder-legacy', 'knowledge-legacy'})
    assert len(events) == (1 if case == 'sources' else 0)
    assert mocks['apply_source_context_to_messages'].await_count == (1 if case == 'sources' else 0)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'case',
    [
        'db',
        'mcp',
        'mcp-denied',
        'mcp-error',
        'terminal',
        'terminal-prompt',
        'terminal-error',
        'direct',
        'builtin',
        'collision',
    ],
)
async def test_payload_tools(payload: dict[str, object], case: str) -> None:
    form, meta, mocks = payload['form_data'], payload['metadata'], payload['mocks']
    spec = {'name': 'fixture_tool', 'description': 'Fixture', 'parameters': {'type': 'object', 'properties': {}}}
    tool = {'spec': spec, 'callable': AsyncMock(), 'direct': False}
    client = SimpleNamespace(call_tool=AsyncMock(return_value='tool result'), instructions=None)
    if case in {'db', 'collision'}:
        form['tool_ids'] = ['db-tool']
        payload['monkeypatch'].setattr(middleware, 'ENABLE_FUNCTIONS', True)
        mocks['get_tools'].return_value = {'fixture_tool': tool}
    if case.startswith('mcp'):
        form['tool_ids'] = ['server:mcp:server']
        mocks['connect_mcp_server'].return_value = None if case == 'mcp-denied' else (client, [spec])
        mocks['connect_mcp_server'].side_effect = RuntimeError('local failure') if case == 'mcp-error' else None
    if case.startswith('terminal'):
        form['terminal_id'] = 'terminal'
        payload['config']['terminal_server.connections'] = [{'id': 'terminal'}]
        mocks['get_terminal_tools'].return_value = (
            ({'fixture_tool': tool}, 'terminal context') if case == 'terminal-prompt' else {'fixture_tool': tool}
        )
        mocks['get_terminal_tools'].side_effect = RuntimeError('local failure') if case == 'terminal-error' else None
    if case == 'direct':
        meta['tool_servers'] = [{'url': 'https://tool.invalid', 'system_prompt': 'direct context', 'specs': [spec]}]
    if case in {'builtin', 'collision'}:
        meta['session_id'] = 'fixture-session'
        mocks['get_builtin_tools'].return_value = {'fixture_tool': {**tool, 'direct': True}}
    if case == 'terminal-error':
        with pytest.raises(HTTPException) as exc:
            await _run(payload)
        assert exc.value.status_code == 503
        return
    result, _, _, _ = await _run(payload)
    assert 'tool_ids' not in result and 'terminal_id' not in result
    assert bool(meta.get('tools')) == (case not in {'explicit-empty', 'explicit-tool', 'mcp-denied', 'mcp-error'})
    if case == 'mcp':
        assert meta['mcp_clients'] == {'server': client}
        assert await meta['tools']['server_fixture_tool']['callable'](value=1) == 'tool result'
        client.call_tool.assert_awaited_once_with('fixture_tool', function_args={'value': 1})
    if case == 'collision':
        assert meta['tools']['fixture_tool'] is tool


@pytest.mark.asyncio
@pytest.mark.parametrize('tools', [[], [{'type': 'function', 'function': {'name': 'fixture'}}]])
async def test_payload_explicit_tools(payload: dict[str, object], tools: list[dict[str, object]]) -> None:
    payload['form_data']['tools'] = tools
    result, meta, _, _ = await _run(payload)
    assert result['tools'] is tools
    assert 'tools' not in meta
    assert payload['mocks']['get_builtin_tools'].await_count == payload['mocks']['get_tools'].await_count == 0


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['mentioned', 'selected', 'legacy', 'inactive', 'note-owner', 'note-denied'])
async def test_payload_skills_and_notes(payload: dict[str, object], case: str) -> None:
    form, meta, mocks = payload['form_data'], payload['metadata'], payload['mocks']
    if case.startswith('note'):
        meta['chat_id'] = 'saved-fixture'
        mocks['get_chat_by_id'].return_value = SimpleNamespace(
            user_id='fixture-user', meta={'internal': True, 'type': 'note', 'note_id': 'note'}
        )
        mocks['get_note_by_id'].return_value = SimpleNamespace(
            id='note',
            user_id='fixture-user' if case == 'note-owner' else 'other',
            data={'files': [{'id': 'note-file', 'type': 'file'}]},
        )
    else:
        form['skill_ids'] = ['skill']
        payload['config']['skills.lazy_loading.enable'] = case == 'selected'
        meta['session_id'] = 'session'
        form['messages'][0]['content'] = '<$skill|>' if case == 'mentioned' else 'question'
        meta['params']['function_calling'] = 'legacy' if case == 'legacy' else 'native'
        mocks['get_skills'].return_value = [
            SkillModel(
                id='skill',
                user_id='fixture-user',
                name='Skill',
                content='skill body',
                data={'files': [{'path': 'SKILL.md', 'content': 'skill body'}]},
                meta={},
                is_active=case != 'inactive',
                created_at=0,
                updated_at=0,
            )
        ]
    result, _, _, _ = await _run(payload)
    assert bool(meta['files']) == (case == 'note-owner')
    assert ('skill body' in str(result['messages'])) == (case in {'mentioned', 'legacy'})
    assert ('<available_skills>' in str(result['messages'])) == (case == 'selected')
    assert meta['base_user_prompt'] == ('Skill' if case == 'mentioned' else 'question')
