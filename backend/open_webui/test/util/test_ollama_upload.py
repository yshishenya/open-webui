from __future__ import annotations

import asyncio
import io
import json
from pathlib import Path
from typing import Optional

from _pytest.monkeypatch import MonkeyPatch


class _StubResponse:
    def __init__(self, *, ok: bool = True, text: str = "") -> None:
        self.ok = ok
        self.text = text


def test_persist_upload_file_writes_source_data(tmp_path: Path) -> None:
    import open_webui.utils.airis.ollama_upload as ollama_upload

    source = io.BytesIO(b"model-binary-data")
    destination_path = tmp_path / "model.gguf"

    asyncio.run(
        ollama_upload.persist_upload_file(
            source,
            str(destination_path),
            4,
        )
    )

    assert destination_path.read_bytes() == b"model-binary-data"


def test_upload_blob_posts_file_and_closes_handle(
    monkeypatch: MonkeyPatch,
    tmp_path: Path,
) -> None:
    import open_webui.utils.airis.ollama_upload as ollama_upload

    file_path = tmp_path / "model.gguf"
    file_path.write_bytes(b"blob-content")

    captured: dict[str, object] = {}

    def fake_post(
        url: str,
        data: Optional[io.BufferedReader] = None,
    ) -> _StubResponse:
        assert data is not None
        captured["url"] = url
        captured["was_closed_during_call"] = data.closed
        captured["payload"] = data.read()
        captured["file_obj"] = data
        return _StubResponse(ok=True)

    monkeypatch.setattr(ollama_upload.requests, "post", fake_post)

    response = asyncio.run(
        ollama_upload.upload_blob(
            "https://ollama.example",
            str(file_path),
            "hash-123",
        )
    )

    assert response.ok is True
    assert captured["url"] == "https://ollama.example/api/blobs/sha256:hash-123"
    assert captured["payload"] == b"blob-content"
    assert captured["was_closed_during_call"] is False
    file_obj = captured["file_obj"]
    assert isinstance(file_obj, io.BufferedReader)
    assert file_obj.closed is True


def test_create_model_posts_expected_payload(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.airis.ollama_upload as ollama_upload

    captured: dict[str, object] = {}

    def fake_post(
        *,
        url: str,
        headers: dict[str, str],
        data: str,
    ) -> _StubResponse:
        captured["url"] = url
        captured["headers"] = headers
        captured["payload"] = data
        return _StubResponse(ok=True)

    monkeypatch.setattr(ollama_upload.requests, "post", fake_post)

    model_name, response = asyncio.run(
        ollama_upload.create_model(
            "https://ollama.example",
            "my-model.gguf",
            "hash-456",
        )
    )

    assert model_name == "my-model"
    assert response.ok is True
    assert captured["url"] == "https://ollama.example/api/create"
    assert captured["headers"] == {"Content-Type": "application/json"}
    assert json.loads(str(captured["payload"])) == {
        "model": "my-model",
        "files": {"my-model.gguf": "sha256:hash-456"},
    }
