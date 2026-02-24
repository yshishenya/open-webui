from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from open_webui.utils.airis.ollama_upload import (
    create_model,
    persist_upload_file,
    upload_blob,
)


@pytest.mark.asyncio
async def test_persist_upload_file_writes_chunks(tmp_path: Path) -> None:
    source_file = BytesIO(b"0123456789")
    destination_path = tmp_path / "uploaded-model.gguf"

    await persist_upload_file(source_file, str(destination_path), chunk_size=3)

    assert destination_path.read_bytes() == b"0123456789"


@pytest.mark.asyncio
async def test_upload_blob_posts_expected_url_and_file(tmp_path: Path) -> None:
    upload_path = tmp_path / "model.gguf"
    upload_path.write_bytes(b"model-bytes")
    mock_response = Mock(name="blob_response")

    with patch(
        "open_webui.utils.airis.ollama_upload.requests.post",
        return_value=mock_response,
    ) as mock_post:
        response = await upload_blob(
            "http://ollama.local",
            str(upload_path),
            "deadbeef",
        )

    assert response is mock_response
    mock_post.assert_called_once()
    assert mock_post.call_args.args[0] == "http://ollama.local/api/blobs/sha256:deadbeef"
    assert mock_post.call_args.kwargs["data"].name == str(upload_path)


@pytest.mark.asyncio
async def test_create_model_posts_expected_payload() -> None:
    mock_response = Mock(name="create_response")

    with patch(
        "open_webui.utils.airis.ollama_upload.requests.post",
        return_value=mock_response,
    ) as mock_post:
        model_name, response = await create_model(
            "http://ollama.local",
            "my-model.gguf",
            "cafebabe",
        )

    assert model_name == "my-model"
    assert response is mock_response
    mock_post.assert_called_once()
    assert mock_post.call_args.kwargs["url"] == "http://ollama.local/api/create"
    assert mock_post.call_args.kwargs["headers"] == {"Content-Type": "application/json"}
    assert json.loads(mock_post.call_args.kwargs["data"]) == {
        "model": "my-model",
        "files": {"my-model.gguf": "sha256:cafebabe"},
    }
