from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch


class _FakeOpenAIResponse:
    status_code: int = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, str]:
        return {"text": "hello from test"}


def _build_openai_stt_request() -> SimpleNamespace:
    config = SimpleNamespace(
        STT_ENGINE="openai",
        STT_MODEL="whisper-1",
        STT_OPENAI_API_KEY="test-key",
        STT_OPENAI_API_BASE_URL="https://api.example.com/v1",
    )
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(config=config)))


def test_transcription_handler_closes_uploaded_file_handle(
    monkeypatch: MonkeyPatch, tmp_path: Path
) -> None:
    import open_webui.routers.audio as audio_router

    request = _build_openai_stt_request()
    source_audio = tmp_path / "sample.wav"
    source_audio.write_bytes(b"fake-audio-data")

    captured_file_handle: dict[str, object] = {}

    def fake_post(*args: object, **kwargs: object) -> _FakeOpenAIResponse:
        file_handle = kwargs["files"]["file"][1]
        captured_file_handle["value"] = file_handle
        return _FakeOpenAIResponse()

    monkeypatch.setattr(audio_router.requests, "post", fake_post)

    result = audio_router.transcription_handler(
        request,
        str(source_audio),
        metadata={"language": "en"},
        user=None,
    )

    assert result == {"text": "hello from test"}
    assert "value" in captured_file_handle
    assert getattr(captured_file_handle["value"], "closed", False) is True

    transcript_path = source_audio.with_suffix(".json")
    assert transcript_path.is_file()
    assert json.loads(transcript_path.read_text(encoding="utf-8")) == {
        "text": "hello from test"
    }
