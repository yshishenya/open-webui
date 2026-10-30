from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, call

import aiohttp
import httpx
import pytest
from aiohttp import web
from fastapi import FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from open_webui.models.users import UserModel
from open_webui.routers import configs
from open_webui.utils.auth import get_admin_user, get_current_user


@asynccontextmanager
async def _peer(scenario: str) -> AsyncIterator[tuple[str, list[dict[str, str]]]]:
    calls: list[dict[str, str]] = []

    async def respond(request: web.Request) -> web.Response:
        calls.append({'path': request.path, **dict(request.headers)})
        if request.path == '/openapi.json':
            return web.json_response(
                {'openapi': '3.1.0', 'extension': None}, status=503 if scenario == 'server-error' else 200
            )
        if scenario == 'invalid-json':
            return web.Response(text='{bad', content_type='application/json')
        if scenario == 'invalid-schema':
            return web.json_response({'issuer': 'not-a-url'})
        if scenario == 'all-missing' or request.path == '/first':
            return web.Response(status=404)
        return web.json_response(
            {
                'issuer': 'https://issuer.invalid',
                'authorization_endpoint': 'https://issuer.invalid/auth',
                'token_endpoint': 'https://issuer.invalid/token',
                'response_types_supported': ['code'],
            }
        )

    app = web.Application()
    app.router.add_get('/{name}', respond)
    runner = web.AppRunner(app)
    await runner.setup()
    try:
        await web.TCPSite(runner, '127.0.0.1', 0).start()
        host, port = runner.addresses[0]
        yield f'http://{host}:{port}', calls
    finally:
        await runner.cleanup()


def _app(scenario: str, oauth_calls: list[tuple[str, str]]) -> FastAPI:
    app = FastAPI()
    user = UserModel(
        id='fixture',
        email='fixture@example.invalid',
        name='Fixture ',
        role='admin',
        last_active_at=0,
        updated_at=0,
        created_at=0,
    )

    async def admin(request: Request) -> UserModel:
        if scenario != 'missing-session':
            request.state.token = HTTPAuthorizationCredentials(scheme='Bearer', credentials='session-fixture')
        return user

    async def oauth_token(user_id: str, session_id: str) -> dict[str, str] | None:
        oauth_calls.append((user_id, session_id))
        if scenario == 'oauth-error':
            raise RuntimeError('local OAuth failure')
        return None if scenario == 'oauth-no-token' else {'access_token': 'oauth-fixture'}

    app.state.oauth_manager = SimpleNamespace(get_oauth_token=oauth_token)
    app.dependency_overrides[get_admin_user] = admin
    app.include_router(configs.router)
    return app


HEADER_CASES = {
    'none': (None, None, None, None),
    'bearer': ('bearer', ' raw-key ', None, {'Authorization': 'Bearer  raw-key '}),
    'empty-bearer': ('bearer', '', None, None),
    'session': ('session', None, None, {'Authorization': 'Bearer session-fixture'}),
    'missing-session': ('session', None, None, None),
    'oauth': ('system_oauth', None, None, {'Authorization': 'Bearer oauth-fixture'}),
    'oauth-no-cookie': ('system_oauth', None, None, None),
    'oauth-no-token': ('system_oauth', None, None, None),
    'oauth-error': ('system_oauth', None, None, None),
    'custom': (None, None, {'X-Name': '{{USER_NAME}}'}, {'X-Name': 'Fixture'}),
    'custom-auth': (
        'bearer',
        'original',
        {'Authorization': 'override', 'X-User': '{{USER_ID}}'},
        {'Authorization': 'override', 'X-User': 'fixture'},
    ),
    'custom-string': (None, None, '{ignored}', None),
}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'protocol,scenario',
    [(protocol, scenario) for protocol in ['mcp', 'openapi'] for scenario in HEADER_CASES]
    + [('mcp', s) for s in ['factory-error', 'connect-error', 'list-error', 'disconnect-error']]
    + [('openapi', 'server-error'), ('openapi', 'http-error')],
)
async def test_tool_verification_http_auth_and_lifecycle(
    monkeypatch: pytest.MonkeyPatch, protocol: str, scenario: str
) -> None:
    oauth_calls: list[tuple[str, str]] = []
    sent_headers: list[dict[str, str] | None] = []
    auth_type, key, custom_headers, expected_headers = HEADER_CASES.get(scenario, HEADER_CASES['none'])
    app = _app(scenario, oauth_calls)
    native_tool_data = configs.get_tool_server_data

    mcp_client = Mock()
    mcp_client.connect = AsyncMock(
        side_effect=HTTPException(403, 'local connection failure') if scenario == 'connect-error' else None
    )
    mcp_client.list_tool_specs = AsyncMock(
        return_value=[{'name': 'fixture'}],
        side_effect=RuntimeError('local list failure') if scenario == 'list-error' else None,
    )
    mcp_client.disconnect = AsyncMock(
        side_effect=RuntimeError('local disconnect failure') if scenario == 'disconnect-error' else None
    )
    factory = Mock(
        return_value=mcp_client,
        side_effect=RuntimeError('local constructor failure') if scenario == 'factory-error' else None,
    )
    trace = Mock()
    trace.attach_mock(factory, 'create')
    trace.attach_mock(mcp_client.connect, 'connect')
    trace.attach_mock(mcp_client.list_tool_specs, 'list')
    trace.attach_mock(mcp_client.disconnect, 'disconnect')

    async def tool_data(url: str, headers: dict[str, str] | None) -> object:
        assert url == base_url + '/openapi.json'
        sent_headers.append(headers)
        if scenario == 'http-error':
            raise HTTPException(429, 'limited')
        return await native_tool_data(url, headers)

    monkeypatch.setattr(configs, 'MCPClient', factory)
    monkeypatch.setattr(configs, 'get_tool_server_data', tool_data)
    async with _peer(scenario) as (base_url, peer_calls):
        form = {
            'url': base_url,
            'path': 'openapi.json',
            'type': protocol,
            'auth_type': auth_type,
            'key': key,
            'headers': custom_headers,
            'config': None,
        }
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://app.invalid') as client:
            response = await client.post(
                '/tool_servers/verify',
                json=form,
                headers={} if scenario == 'oauth-no-cookie' else {'Cookie': 'oauth_session_id=local-session'},
            )
        errors = {
            'missing-session': (
                'Failed to create MCP client' if protocol == 'mcp' else 'Failed to connect to the tool server'
            ),
            'factory-error': 'Failed to connect to the tool server',
            'connect-error': 'Failed to create MCP client',
            'list-error': 'Failed to create MCP client',
            'disconnect-error': 'Failed to connect to the tool server',
            'server-error': 'Failed to connect to the tool server',
            'http-error': 'limited',
        }
        expected_status = 400 if scenario in errors else 200
        assert response.status_code == {'http-error': 429}.get(scenario, expected_status)
        assert response.json() == (
            {'detail': errors[scenario]}
            if scenario in errors
            else (
                {'status': True, 'specs': [{'name': 'fixture'}]}
                if protocol == 'mcp'
                else {'openapi': '3.1.0', 'extension': None}
            )
        )
        if protocol == 'mcp':
            assert mcp_client.connect.call_args_list == (
                [] if scenario in {'factory-error', 'missing-session'} else [call(base_url, headers=expected_headers)]
            )
        else:
            assert sent_headers == ([] if scenario == 'missing-session' else [expected_headers])
        assert oauth_calls == (
            [('fixture', 'local-session')] if scenario in {'oauth', 'oauth-no-token', 'oauth-error'} else []
        )
        expected_lifecycle = {
            'factory-error': ['create'],
            'missing-session': ['create', 'disconnect'],
            'connect-error': ['create', 'connect', 'disconnect'],
            'list-error': ['create', 'connect', 'list', 'disconnect'],
        }.get(scenario, ['create', 'connect', 'list', 'disconnect'])
        assert [item[0] for item in trace.mock_calls] == (expected_lifecycle if protocol == 'mcp' else [])
        assert [c['path'] for c in peer_calls] == (
            ['/openapi.json'] if protocol == 'openapi' and scenario not in {'missing-session', 'http-error'} else []
        )
        assert all('Cookie' not in c for c in peer_calls)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'scenario', ['valid', 'invalid-json', 'invalid-schema', 'all-missing', 'no-urls', 'discovery-error']
)
async def test_tool_verification_native_oauth_discovery(monkeypatch: pytest.MonkeyPatch, scenario: str) -> None:
    app = _app(scenario, [])
    session_options: list[dict[str, object]] = []
    native_session = aiohttp.ClientSession

    def session(**kwargs: object) -> aiohttp.ClientSession:
        session_options.append(kwargs)
        return native_session(**kwargs)

    async with _peer(scenario) as (base_url, peer_calls):
        urls = [] if scenario == 'no-urls' else [base_url + '/first', base_url + '/second']

        async def discovery(server_url: str) -> list[str]:
            assert server_url == 'https://oauth.invalid/issuer'
            if scenario == 'discovery-error':
                raise RuntimeError('local discovery failure')
            return urls

        monkeypatch.setattr(configs, 'get_discovery_urls', discovery)
        monkeypatch.setattr(configs.aiohttp, 'ClientSession', session)
        form = {
            'url': base_url,
            'path': '',
            'type': 'mcp',
            'auth_type': 'oauth_2.1_static',
            'key': None,
            'config': None,
            'info': {'oauth_server_url': 'https://oauth.invalid/issuer'},
        }
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://app.invalid') as client:
            response = await client.post('/tool_servers/verify', json=form)
        assert response.status_code == (200 if scenario == 'valid' else 400)
        if scenario == 'valid':
            assert response.json()['status'] is True
            metadata = response.json()['oauth_server_metadata']
            # Issuer identifiers are preserved exactly, including a meaningful trailing slash.
            assert metadata['issuer'] == 'https://issuer.invalid'
            assert metadata['response_types_supported'] == ['code']
        else:
            expected = {
                'invalid-json': f'Failed to parse OAuth 2.1 discovery document from {next(iter(urls), "")}',
                'invalid-schema': f'Failed to parse OAuth 2.1 discovery document from {next(iter(urls), "")}',
                'all-missing': f'Failed to fetch OAuth 2.1 discovery document from {urls}',
                'no-urls': 'Failed to fetch OAuth 2.1 discovery document from []',
                'discovery-error': 'Failed to connect to the tool server',
            }
            assert response.json() == {'detail': expected[scenario]}
        paths = {
            'valid': ['/first', '/second'],
            'all-missing': ['/first', '/second'],
            'invalid-json': ['/first'],
            'invalid-schema': ['/first'],
        }.get(scenario, [])
        assert [c['path'] for c in peer_calls] == paths
        for options in session_options:
            assert options['trust_env'] is True
            assert options['timeout'].total == configs.AIOHTTP_CLIENT_TIMEOUT

        app.dependency_overrides.clear()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://app.invalid') as client:
            denied = await client.post('/tool_servers/verify', json=form)
        assert denied.status_code == 401 and denied.json() == {'detail': 'Not authenticated'}

        async def nonadmin() -> UserModel:
            return UserModel(
                id='fixture',
                email='fixture@example.invalid',
                name='Fixture',
                role='user',
                last_active_at=0,
                updated_at=0,
                created_at=0,
            )

        app.dependency_overrides[get_current_user] = nonadmin
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://app.invalid') as client:
            denied = await client.post('/tool_servers/verify', json=form)
        assert denied.status_code == 401
        assert [c['path'] for c in peer_calls] == paths
