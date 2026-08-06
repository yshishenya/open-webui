from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch


class _FakeOpenAIResponse:
    status: int = 200

    def raise_for_status(self) -> None:
        return None

    async def json(self) -> dict[str, str]:
        return {'text': 'hello from test'}


class _FakeSession:
    def __init__(self) -> None:
        self.uploaded = b''

    async def post(self, **kwargs: object) -> _FakeOpenAIResponse:
        form_data = kwargs['data']
        for type_options, _, value in form_data._fields:
            if type_options.get('name') == 'file':
                self.uploaded = b''.join([chunk async for chunk in value])
        return _FakeOpenAIResponse()


@pytest.mark.asyncio
async def test_transcription_handler_streams_and_closes_uploaded_file(
    monkeypatch: MonkeyPatch, tmp_path: Path
) -> None:
    import open_webui.routers.audio as audio_router

    request = SimpleNamespace()
    source_audio = tmp_path / 'sample.wav'
    source_audio.write_bytes(b'fake-audio-data')

    config = {
        'audio.stt.engine': 'openai',
        'audio.stt.model': 'whisper-1',
        'audio.stt.openai.api_key': 'test-key',
        'audio.stt.openai.api_base_url': 'https://api.example.com/v1',
        'audio.stt.openai.api_request_format': 'multipart',
    }

    async def get_config(key: str, default: object = None) -> object:
        return config.get(key, default)

    session = _FakeSession()

    async def get_fake_session() -> _FakeSession:
        return session

    monkeypatch.setattr(audio_router.Config, 'get', get_config)
    monkeypatch.setattr(audio_router, 'get_session', get_fake_session)

    result = await audio_router.transcription_handler(
        request,
        str(source_audio),
        metadata={'language': 'en'},
        user=None,
    )

    assert result == {'text': 'hello from test'}
    assert session.uploaded == b'fake-audio-data'

    transcript_path = source_audio.with_suffix('.json')
    assert transcript_path.is_file()
    assert json.loads(transcript_path.read_text(encoding='utf-8')) == {
        'text': 'hello from test'
    }
