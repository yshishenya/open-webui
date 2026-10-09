from __future__ import annotations

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.testclient import TestClient
from open_webui.models.config import Config
from open_webui.models.users import UserModel
from open_webui.routers import configs, tasks
from open_webui.utils.auth import get_admin_user, get_verified_user


@pytest.mark.parametrize('path', ['/title/completions', '/follow_up/completions', '/image_prompt/completions'])
@pytest.mark.parametrize('error_response', [False, True])
def test_task_responses_preserve_provider_payload_and_http_response(
    monkeypatch: MonkeyPatch, path: str, error_response: bool
) -> None:
    payload = {'choices': [], 'provider_extension': {'text': 'Привет', 'nullable': None}}
    provided: dict[str, object] | Response = (
        JSONResponse(payload, status_code=429, headers={'Retry-After': '7'}) if error_response else payload
    )

    async def user() -> UserModel:
        return UserModel(
            id='fixture', email='fixture@example.invalid', name='Fixture', last_active_at=0, updated_at=0, created_at=0
        )

    async def config(key: str, default: object = None) -> object:
        return True if key.endswith('.enable') else 'fixture'

    async def render(*args: object, **kwargs: object) -> str:
        return 'fixture'

    async def pipeline(
        request: Request, form_data: dict[str, object], user: UserModel, models: dict[str, object]
    ) -> dict[str, object]:
        return form_data

    async def completion(
        request: Request, form_data: dict[str, object], user: UserModel
    ) -> dict[str, object] | Response:
        return provided

    monkeypatch.setattr(Config, 'get', config)
    for name in ['title_generation_template', 'follow_up_generation_template', 'image_prompt_generation_template']:
        monkeypatch.setattr(tasks, name, render)
    monkeypatch.setattr(tasks, 'process_pipeline_inlet_filter', pipeline)
    monkeypatch.setattr(tasks, 'generate_chat_completion', completion)
    app = FastAPI()
    app.state.MODELS = {'fixture': {'id': 'fixture'}}
    app.dependency_overrides[get_verified_user] = user
    app.include_router(tasks.router)
    with TestClient(app) as client:
        response = client.post(path, json={'model': 'fixture', 'messages': []})
    assert response.status_code == (429 if error_response else 200)
    assert response.json() == payload
    if error_response:
        assert response.headers['Retry-After'] == '7'


@pytest.mark.parametrize('payload', [{'openapi': '3.1.0', 'extension': None}, ['scalar', None]])
def test_tool_verification_preserves_parsed_payload(monkeypatch: MonkeyPatch, payload: object) -> None:
    async def user() -> UserModel:
        return UserModel(
            id='fixture',
            email='fixture@example.invalid',
            name='Fixture',
            role='admin',
            last_active_at=0,
            updated_at=0,
            created_at=0,
        )

    async def tool_data(url: str, headers: dict[str, str] | None) -> object:
        return payload

    monkeypatch.setattr(configs, 'get_tool_server_data', tool_data)
    app = FastAPI()
    app.dependency_overrides[get_admin_user] = user
    app.include_router(configs.router)
    with TestClient(app) as client:
        response = client.post(
            '/tool_servers/verify',
            json={
                'url': 'https://fixture.invalid',
                'path': '/openapi.json',
                'auth_type': None,
                'key': None,
                'config': None,
            },
        )
    assert response.status_code == 200
    assert response.json() == payload
