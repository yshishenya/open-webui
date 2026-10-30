"""Protect chat payloads and terminal errors; classify TTS origins exactly."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, Mock

import aiohttp
import pytest
from fastapi import Request


@pytest.mark.asyncio
async def test_static_oauth_metadata_stays_out_of_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.utils import oauth

    private_url = 'https://provider.example/metadata?access_token=private-fixture'
    info = Mock()
    log = Mock()
    monkeypatch.setattr(oauth, 'log', log)
    monkeypatch.setattr(oauth.Config, 'get', AsyncMock(return_value='https://airis.example'))
    monkeypatch.setattr(
        oauth,
        'get_protected_resource_metadata',
        AsyncMock(return_value=SimpleNamespace(resource='https://provider.example', scopes_supported=[])),
    )
    monkeypatch.setattr(
        oauth,
        '_get_oauth_server_metadata',
        AsyncMock(return_value=(SimpleNamespace(token_endpoint_auth_methods_supported=None), private_url)),
    )
    monkeypatch.setattr(oauth, 'OAuthClientInformationFull', info)
    result = await oauth.get_oauth_client_info_with_static_credentials(
        Request({'type': 'http'}),
        'connection',
        'https://provider.example',
        'client-fixture',
        'secret-fixture',
    )
    assert result is info.return_value
    assert info.call_args.kwargs['client_secret'] == 'secret-fixture'
    assert info.call_args.kwargs['issuer'] == private_url
    assert private_url not in repr(log.mock_calls)
    assert 'client-fixture' not in repr(log.mock_calls)
    assert 'secret-fixture' not in repr(log.mock_calls)


@pytest.mark.asyncio
async def test_chat_payload_does_not_enter_debug_log(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.utils import chat

    debug = Mock()
    monkeypatch.setattr(chat.log, 'debug', debug)
    secret = 'private-chat-content-fixture'
    request = Request({'type': 'http', 'app': SimpleNamespace(state=SimpleNamespace(MODELS={}))})
    with pytest.raises(Exception, match='Model not found'):
        await chat.generate_chat_completion(
            request,
            {'model': 'missing', 'messages': [{'role': 'user', 'content': secret}]},
            SimpleNamespace(id='user', role='user'),
        )
    assert secret not in repr(debug.call_args_list)


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', [aiohttp.ClientConnectionError, RuntimeError])
async def test_terminal_error_keeps_private_details_out_of_response(
    monkeypatch: pytest.MonkeyPatch, failure: type[Exception]
) -> None:
    from open_webui.routers import terminals

    secret = 'private-upstream-details-fixture'
    session = SimpleNamespace(request=AsyncMock(side_effect=failure(secret)), close=AsyncMock())
    monkeypatch.setattr(terminals, 'ENABLE_TOOL_SERVERS', True)
    monkeypatch.setattr(
        terminals.Config,
        'get',
        AsyncMock(return_value=[{'id': 'test', 'url': 'https://terminal.example', 'auth_type': 'none'}]),
    )
    monkeypatch.setattr(terminals.Groups, 'get_groups_by_member_id', AsyncMock(return_value=[]))
    monkeypatch.setattr(terminals, 'has_connection_access', AsyncMock(return_value=True))
    monkeypatch.setattr(terminals.aiohttp, 'ClientSession', Mock(return_value=session))
    request = Request(
        {'type': 'http', 'method': 'GET', 'path': '/', 'headers': [], 'query_string': b'', 'path_params': {}},
        receive=AsyncMock(return_value={'type': 'http.request', 'body': b'', 'more_body': False}),
    )
    response = await terminals.proxy_terminal('test', 'files', request, SimpleNamespace(id='user', role='admin'))
    assert response.status_code == 502
    assert response.body == b'{"error":"Terminal proxy error"}'
    assert secret.encode() not in response.body
    session.request.assert_awaited_once()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('base_url', 'official'),
    [
        ('https://api.openai.com/v1', True),
        ('https://API.OPENAI.COM:443/v1', True),
        ('https://api.openai.com.attacker.invalid/v1', False),
        ('https://api.openai.com@attacker.invalid/v1', False),
        ('https://api.openai.com:8443/v1', False),
        ('http://api.openai.com/v1', False),
        ('https://custom-provider.invalid/v1', False),
    ],
)
async def test_tts_model_and_voice_discovery_use_the_parsed_origin(
    monkeypatch: pytest.MonkeyPatch, base_url: str, official: bool
) -> None:
    from open_webui.routers import audio

    async def config_get(key: str) -> str:
        return 'openai' if key == 'audio.tts.engine' else base_url

    response = SimpleNamespace(
        raise_for_status=Mock(),
        json=AsyncMock(return_value={'models': [{'id': 'custom'}], 'voices': [{'id': 'custom', 'name': 'Custom'}]}),
    )
    session = MagicMock()
    session.get.return_value.__aenter__.return_value = response
    get_session = AsyncMock(return_value=session)
    monkeypatch.setattr(audio.Config, 'get', config_get)
    monkeypatch.setattr(audio, 'get_session', get_session)
    request = Request({'type': 'http'})
    models = await audio.get_available_models(request)
    voices = await audio.get_available_voices(request)
    if official:
        assert models == [{'id': 'tts-1'}, {'id': 'tts-1-hd'}]
        assert voices == audio._OPENAI_DEFAULT_VOICES
        get_session.assert_not_awaited()
    else:
        assert models == [{'id': 'custom'}]
        assert voices == {'custom': 'Custom'}
        assert get_session.await_count == 2
        assert [call.args[0] for call in session.get.call_args_list] == [
            f'{base_url}/audio/models',
            f'{base_url}/audio/voices',
        ]
