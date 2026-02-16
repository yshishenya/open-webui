from __future__ import annotations

from pathlib import Path

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class _StubResponse:
    def __init__(self, *, ok: bool, text: str = "") -> None:
        self.ok = ok
        self.text = text


class TestOllamaUploadAsync(AbstractPostgresTest):
    BASE_PATH = "/ollama"

    def test_upload_model_success_uses_async_helpers(
        self,
        monkeypatch: MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        import open_webui.routers.ollama as ollama_router

        config = self.fast_api_client.app.state.config
        config.OLLAMA_BASE_URLS = ["https://ollama.example"]

        captured: dict[str, object] = {}

        async def fake_persist_upload_file(
            source_file: object,
            destination_path: str,
            chunk_size: int,
        ) -> None:
            assert hasattr(source_file, "read")
            source_data = source_file.read()
            assert isinstance(source_data, bytes)
            with open(destination_path, "wb") as destination:
                destination.write(source_data)
            captured["persist_chunk_size"] = chunk_size
            captured["persist_path"] = destination_path

        async def fake_upload_blob(
            ollama_url: str,
            file_path: str,
            file_hash: str,
        ) -> _StubResponse:
            captured["blob_args"] = (ollama_url, file_path, file_hash)
            return _StubResponse(ok=True)

        async def fake_create_model(
            ollama_url: str,
            filename: str,
            file_hash: str,
        ) -> tuple[str, _StubResponse]:
            captured["create_args"] = (ollama_url, filename, file_hash)
            return "uploaded-model", _StubResponse(ok=True)

        monkeypatch.setattr(ollama_router, "UPLOAD_DIR", str(tmp_path))
        monkeypatch.setattr(
            ollama_router,
            "persist_upload_file",
            fake_persist_upload_file,
        )
        monkeypatch.setattr(ollama_router, "upload_blob", fake_upload_blob)
        monkeypatch.setattr(ollama_router, "create_model", fake_create_model)
        monkeypatch.setattr(
            ollama_router, "calculate_sha256", lambda _path, _chunk: "hash-1"
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/models/upload"),
                files={
                    "file": (
                        "uploaded-model.gguf",
                        b"model-bytes",
                        "application/octet-stream",
                    )
                },
            )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert '"done": true' in response.text
        assert '"model_created": "uploaded-model"' in response.text

        blob_args = captured["blob_args"]
        assert isinstance(blob_args, tuple)
        assert blob_args[0] == "https://ollama.example"
        assert str(blob_args[1]).endswith("uploaded-model.gguf")
        assert blob_args[2] == "hash-1"

        create_args = captured["create_args"]
        assert isinstance(create_args, tuple)
        assert create_args == (
            "https://ollama.example",
            "uploaded-model.gguf",
            "hash-1",
        )

    def test_upload_model_blob_failure_returns_error_event(
        self,
        monkeypatch: MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        import open_webui.routers.ollama as ollama_router

        config = self.fast_api_client.app.state.config
        config.OLLAMA_BASE_URLS = ["https://ollama.example"]

        captured: dict[str, object] = {"create_called": False}

        async def fake_persist_upload_file(
            source_file: object,
            destination_path: str,
            chunk_size: int,
        ) -> None:
            assert hasattr(source_file, "read")
            source_data = source_file.read()
            assert isinstance(source_data, bytes)
            with open(destination_path, "wb") as destination:
                destination.write(source_data)
            captured["persist_chunk_size"] = chunk_size

        async def fake_upload_blob(
            ollama_url: str,
            file_path: str,
            file_hash: str,
        ) -> _StubResponse:
            captured["blob_args"] = (ollama_url, file_path, file_hash)
            return _StubResponse(ok=False)

        async def fake_create_model(
            ollama_url: str,
            filename: str,
            file_hash: str,
        ) -> tuple[str, _StubResponse]:
            captured["create_called"] = True
            return "should-not-run", _StubResponse(ok=True)

        monkeypatch.setattr(ollama_router, "UPLOAD_DIR", str(tmp_path))
        monkeypatch.setattr(
            ollama_router,
            "persist_upload_file",
            fake_persist_upload_file,
        )
        monkeypatch.setattr(ollama_router, "upload_blob", fake_upload_blob)
        monkeypatch.setattr(ollama_router, "create_model", fake_create_model)
        monkeypatch.setattr(
            ollama_router, "calculate_sha256", lambda _path, _chunk: "hash-2"
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/models/upload"),
                files={
                    "file": (
                        "failed-model.gguf",
                        b"model-bytes",
                        "application/octet-stream",
                    )
                },
            )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert (
            '"error": "Ollama: Could not create blob, Please try again."'
            in response.text
        )
        assert captured["create_called"] is False
