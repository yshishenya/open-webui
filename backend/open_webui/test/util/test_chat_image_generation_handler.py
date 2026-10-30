from __future__ import annotations

from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException, status


@pytest.fixture(autouse=True)
def image_handler_dependencies(monkeypatch: MonkeyPatch) -> None:
    from unittest.mock import AsyncMock

    from open_webui.utils import middleware

    monkeypatch.setattr(
        middleware.Config,
        'get',
        AsyncMock(side_effect=lambda key: key == 'image_generation.enable'),
    )
    monkeypatch.setattr(middleware, 'upload_files_to_terminal', AsyncMock())


def _build_request() -> SimpleNamespace:
    config = SimpleNamespace(
        ENABLE_IMAGE_EDIT=False,
        ENABLE_IMAGE_PROMPT_GENERATION=False,
    )
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(config=config)))


def _build_extra_params() -> dict[str, object]:
    async def event_emitter(_: dict[str, object]) -> None:
        return None

    return {
        '__metadata__': {'chat_id': 'local:test-chat', 'message_id': 'message-1'},
        '__event_emitter__': event_emitter,
    }


@pytest.mark.asyncio
async def test_chat_image_generation_handler_reraises_billing_block(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.middleware as middleware

    async def fake_image_generations(*args: object, **kwargs: object) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                'error': 'insufficient_funds',
                'available_kopeks': 0,
                'required_kopeks': 16000,
                'currency': 'RUB',
            },
        )

    monkeypatch.setattr(middleware, 'image_generations', fake_image_generations)

    with pytest.raises(HTTPException) as exc_info:
        await middleware.chat_image_generation_handler(
            request=_build_request(),
            form_data={
                'model': 'gemini-3.1-flash-lite',
                'messages': [{'role': 'user', 'content': 'draw a cat'}],
            },
            extra_params=_build_extra_params(),
            user=SimpleNamespace(id='user-1'),
        )

    assert exc_info.value.status_code == status.HTTP_402_PAYMENT_REQUIRED
    assert isinstance(exc_info.value.detail, dict)
    assert exc_info.value.detail['error'] == 'insufficient_funds'


@pytest.mark.asyncio
async def test_chat_image_generation_handler_keeps_generic_fallback_for_non_billing_errors(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.middleware as middleware

    async def fake_image_generations(*args: object, **kwargs: object) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'image_provider_error', 'message': 'provider boom'},
        )

    monkeypatch.setattr(middleware, 'image_generations', fake_image_generations)

    result = await middleware.chat_image_generation_handler(
        request=_build_request(),
        form_data={
            'model': 'gemini-3.1-flash-lite',
            'messages': [{'role': 'user', 'content': 'draw a cat'}],
        },
        extra_params=_build_extra_params(),
        user=SimpleNamespace(id='user-1'),
    )

    system_messages = [message['content'] for message in result['messages'] if message.get('role') == 'system']
    assert len(system_messages) == 1
    assert 'Image generation was attempted but failed because of an error.' in system_messages[0]
    assert 'provider boom' in system_messages[0]


@pytest.mark.asyncio
async def test_builtin_generate_image_reraises_billing_block(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.tools.builtin as builtin_tools

    async def fake_image_generations(*args: object, **kwargs: object) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                'error': 'insufficient_funds',
                'available_kopeks': 0,
                'required_kopeks': 16000,
                'currency': 'RUB',
            },
        )

    monkeypatch.setattr(builtin_tools, 'image_generations', fake_image_generations)

    with pytest.raises(HTTPException) as exc_info:
        await builtin_tools.generate_image(
            prompt='draw a cat',
            __request__=object(),
            __user__=None,
        )

    assert exc_info.value.status_code == status.HTTP_402_PAYMENT_REQUIRED
    assert isinstance(exc_info.value.detail, dict)
    assert exc_info.value.detail['error'] == 'insufficient_funds'


@pytest.mark.asyncio
@pytest.mark.parametrize('edit', [False, True])
@pytest.mark.parametrize(
    'outcome',
    [
        'ok',
        'http-string',
        'http-dict',
        'http-empty',
        'generic',
        'insufficient_funds',
        'daily_cap_exceeded',
        'max_reply_cost_exceeded',
        'cancel',
    ],
)
async def test_chat_image_events_and_errors(monkeypatch: MonkeyPatch, edit: bool, outcome: str) -> None:
    import asyncio
    from unittest.mock import AsyncMock, call

    from fastapi import Request
    from open_webui.models.users import UserModel
    from open_webui.utils import middleware

    billing = outcome in {'insufficient_funds', 'daily_cap_exceeded', 'max_reply_cost_exceeded'}
    errors = {
        'http-string': HTTPException(400, 'provider boom'),
        'http-dict': HTTPException(400, {'message': 'provider boom'}),
        'http-empty': HTTPException(400, None),
        'generic': RuntimeError('local failure'),
        'cancel': asyncio.CancelledError(),
    }
    error = HTTPException(402, {'error': outcome}) if billing else errors.get(outcome)
    provider = AsyncMock(return_value=[{'url': 'image-1'}, {'url': 'image-2'}], side_effect=error)
    unused = AsyncMock()
    events = AsyncMock()
    monkeypatch.setattr(middleware, 'image_edits', provider if edit else unused)
    monkeypatch.setattr(middleware, 'image_generations', unused if edit else provider)
    monkeypatch.setattr(
        middleware.Config,
        'get',
        AsyncMock(side_effect=lambda key: key == 'image_generation.enable' or (key == 'images.edit.enable' and edit)),
    )
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', created_at=0, updated_at=0, last_active_at=0
    )
    form = {
        'model': 'fixture',
        'messages': [
            {'role': 'user', 'content': 'old', 'files': [{'type': 'image', 'url': 'old-image'}]},
            {'role': 'user', 'content': 'middle', 'files': [{'content_type': 'image/png', 'url': 'middle-image'}]},
            {'role': 'user', 'content': 'draw a cat', 'files': [{'type': 'image', 'url': 'new-image'}]},
        ],
    }
    request = Request({'type': 'http'})
    extra = {'__metadata__': {'chat_id': 'local:fixture', 'message_id': 'message-1'}, '__event_emitter__': events}
    if billing or outcome == 'cancel':
        with pytest.raises(type(error)) as exc:
            await middleware.chat_image_generation_handler(request, form, extra, user)
        assert exc.value is error
        assert events.await_count == 0
        assert not any(m['role'] == 'system' for m in form['messages'])
    else:
        result = await middleware.chat_image_generation_handler(request, form, extra, user)
        assert result is form
        context = next(m['content'] for m in form['messages'] if m['role'] == 'system')
        if outcome == 'ok':
            assert events.await_args_list == [
                call({'type': 'status', 'data': {'description': 'Image created', 'done': True}}),
                call(
                    {
                        'type': 'files',
                        'data': {'files': [{'type': 'image', 'url': 'image-1'}, {'type': 'image', 'url': 'image-2'}]},
                    }
                ),
            ]
            assert (
                'The edited images are shown in chat.' if edit else 'The generated images are shown in chat.'
            ) in context
            assert 'image-1' in context and 'image-2' in context
        else:
            assert events.await_args_list == [
                call(
                    {
                        'type': 'status',
                        'data': {'description': 'An error occurred while generating an image', 'done': True},
                    }
                )
            ]
            prefix = (
                'Image generation was attempted but failed.'
                if edit
                else 'Image generation was attempted but failed because of an error.'
            )
            assert prefix in context
            if outcome in {'http-string', 'http-dict'}:
                assert 'provider boom' in context
    assert unused.await_count == 0 and provider.await_count == 1
    args = provider.call_args.kwargs
    assert args['request'] is request and args['user'] is user
    assert args['metadata'] == {'chat_id': 'local:fixture', 'message_id': 'message-1'}
    assert args['form_data'].prompt == 'draw a cat'
    if edit:
        assert args['form_data'].image == ['new-image', 'middle-image']


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'response,expected',
    [
        ('{"prompt": "enhanced"}', 'enhanced'),
        ('```json\n{"prompt": "enhanced"}\n```', 'enhanced'),
        ('raw text', 'draw a cat'),
        ('{not-json', 'draw a cat'),
        ({'detail': 'unavailable'}, 'draw a cat'),
        (RuntimeError('local failure'), 'draw a cat'),
        ('{}', None),
        ('{"prompt": null}', None),
        ('{"prompt": 42}', None),
    ],
)
async def test_chat_image_prompt_contract(monkeypatch: MonkeyPatch, response: object, expected: str | None) -> None:
    from unittest.mock import AsyncMock

    from fastapi import Request
    from fastapi.responses import JSONResponse
    from open_webui.models.users import UserModel
    from open_webui.utils import middleware

    value = (
        JSONResponse(response, status_code=503)
        if isinstance(response, dict)
        else {'choices': [{'message': {'content': response}}]}
    )
    generate = AsyncMock(return_value=value, side_effect=response if isinstance(response, Exception) else None)
    provider = AsyncMock(return_value=[])
    events = AsyncMock()
    monkeypatch.setattr(middleware, 'generate_image_prompt', generate)
    monkeypatch.setattr(middleware, 'image_generations', provider)
    monkeypatch.setattr(
        middleware.Config,
        'get',
        AsyncMock(side_effect=lambda key: key in {'image_generation.enable', 'image_generation.prompt.enable'}),
    )
    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', created_at=0, updated_at=0, last_active_at=0
    )
    form = {'model': 'fixture', 'messages': [{'role': 'user', 'content': 'draw a cat'}]}
    extra = {'__metadata__': {'chat_id': 'local:fixture'}, '__event_emitter__': events}
    result = await middleware.chat_image_generation_handler(Request({'type': 'http'}), form, extra, user)
    assert result is form and generate.await_count == 1
    assert generate.call_args.args[1] == {
        'model': 'fixture',
        'messages': form['messages'],
        'chat_id': 'local:fixture',
    }
    if expected is None:
        assert provider.await_count == 0
        assert (
            events.await_args_list[-1].args[0]['data']['description'] == 'An error occurred while generating an image'
        )
    else:
        assert provider.await_count == 1 and provider.call_args.kwargs['form_data'].prompt == expected


@pytest.mark.asyncio
@pytest.mark.parametrize('chat_id', [None, '', 42, 'local:fixture'])
async def test_chat_image_missing_context(monkeypatch: MonkeyPatch, chat_id: object) -> None:
    from unittest.mock import AsyncMock

    from open_webui.utils import middleware

    provider = AsyncMock()
    monkeypatch.setattr(middleware, 'image_generations', provider)
    extra = {
        '__metadata__': {'chat_id': chat_id},
        '__event_emitter__': None if chat_id == 'local:fixture' else AsyncMock(),
    }
    form = {'messages': []}
    result = await middleware.chat_image_generation_handler(
        _build_request(), form, extra, SimpleNamespace(id='fixture')
    )
    assert result is form and provider.await_count == 0


@pytest.mark.asyncio
async def test_chat_image_saved_history(monkeypatch: MonkeyPatch) -> None:
    from unittest.mock import AsyncMock, call

    from fastapi import Request
    from open_webui.models.users import UserModel
    from open_webui.utils import middleware

    user = UserModel(
        id='fixture', email='fixture@example.invalid', name='Fixture', created_at=0, updated_at=0, last_active_at=0
    )
    chat = SimpleNamespace(
        chat={
            'history': {
                'currentId': 'last',
                'messages': {'last': {'id': 'last', 'parentId': None, 'role': 'user', 'content': 'saved prompt'}},
            }
        }
    )
    get_chat = AsyncMock(return_value=chat)
    provider = AsyncMock(return_value=[])
    events = AsyncMock()
    monkeypatch.setattr(middleware.Chats, 'get_accessible_chat_by_id', get_chat)
    monkeypatch.setattr(middleware, 'image_generations', provider)
    monkeypatch.setattr(middleware.Config, 'get', AsyncMock(side_effect=lambda key: key == 'image_generation.enable'))
    form = {'model': 'fixture', 'messages': [{'role': 'user', 'content': 'payload prompt'}]}
    extra = {'__metadata__': {'chat_id': 'saved-fixture'}, '__event_emitter__': events}
    result = await middleware.chat_image_generation_handler(Request({'type': 'http'}), form, extra, user)
    assert result is form
    get_chat.assert_awaited_once_with('saved-fixture', user, permission='write')
    assert provider.call_args.kwargs['form_data'].prompt == 'saved prompt'
    assert events.await_args_list[0] == call(
        {'type': 'status', 'data': {'description': 'Creating image', 'done': False}}
    )
