"""Keep private provider and transport failures out of task JSON and model SSE."""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, Mock

import httpx
import pytest
from fastapi import FastAPI


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['queries', 'emoji', 'moa', 'upload-connect', 'upload-create'])
async def test_generation_errors_keep_private_details_server_side(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, case: str
) -> None:
    from open_webui.constants import ERROR_MESSAGES
    from open_webui.routers import ollama, tasks

    secret = 'private-provider-response-and-internal-path-fixture'
    user = SimpleNamespace(id='test-user', email='test@example.invalid', role='admin')
    app = FastAPI()
    if case.startswith('upload-'):
        module = ollama
        app.include_router(ollama.router, prefix='/ollama')
        app.dependency_overrides[ollama.get_admin_user] = lambda: user
        monkeypatch.setattr(ollama, 'UPLOAD_DIR', str(tmp_path))
        monkeypatch.setattr(ollama, 'get_ollama_connection', AsyncMock(return_value=('http://ollama.invalid', {}, '')))
        monkeypatch.setattr(ollama, 'get_headers_and_cookies', AsyncMock(return_value=({}, {})))
        session = MagicMock()
        session.post.return_value.__aenter__.side_effect = [
            SimpleNamespace(ok=True),
            SimpleNamespace(ok=False, text=AsyncMock(return_value=secret)),
        ]
        failure = (
            AsyncMock(side_effect=RuntimeError(secret)) if case == 'upload-connect' else AsyncMock(return_value=session)
        )
        monkeypatch.setattr(ollama, 'get_session', failure)
    else:
        module = tasks
        app.include_router(tasks.router, prefix='/tasks')
        app.dependency_overrides[tasks.get_verified_user] = lambda: user
        monkeypatch.setattr(tasks.Config, 'get', AsyncMock(return_value=''))
        monkeypatch.setattr(tasks, 'get_task_model_generation_config', AsyncMock(return_value=('model', {})))
        monkeypatch.setattr(tasks, 'query_generation_template', AsyncMock(return_value='query prompt'))
        monkeypatch.setattr(tasks, 'emoji_generation_template', AsyncMock(return_value='emoji prompt'))
        monkeypatch.setattr(tasks, 'moa_response_generation_template', Mock(return_value='moa prompt'))
        monkeypatch.setattr(
            tasks,
            'process_pipeline_inlet_filter',
            AsyncMock(side_effect=lambda request, payload, user, models: payload),
        )
        failure = AsyncMock(side_effect=RuntimeError(secret))
        monkeypatch.setattr(tasks, 'generate_chat_completion', failure)
        app.state.MODELS = {'model': {'id': 'model'}}

    logged = Mock()
    monkeypatch.setattr(module.log, 'exception', logged)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        if case.startswith('upload-'):
            response = await client.post('/ollama/models/upload', files={'file': ('model.gguf', b'model weights')})
            assert response.status_code == 200
            assert response.headers['content-type'].startswith('text/event-stream')
            events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
            assert events[0]['progress'] == 100.0
            assert events[-1] == {'error': ERROR_MESSAGES.DEFAULT()}
        else:
            response = await client.post(
                f'/tasks/{case}/completions',
                json={'model': 'model', 'prompt': 'prompt', 'messages': [], 'responses': []},
            )
            assert response.status_code == 400
            assert response.json() == {'detail': ERROR_MESSAGES.DEFAULT()}
        assert secret not in response.text
        failure.assert_awaited_once()
        logged.assert_called_once()
