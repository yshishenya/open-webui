import json
from pathlib import Path
from typing import BinaryIO

import pytest
import requests
from fastapi import HTTPException
from open_webui.retrieval.loaders.mineru import MinerULoader


def test_mineru_local_preserves_multipart_first_document_and_http_errors(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    source = tmp_path / 'résumé.pdf'
    source.write_bytes(b'local parser fixture')
    body = json.dumps({'results': {'first': {'md_content': '  First\n'}, 'second': {'md_content': 'Second'}}}).encode()
    response_status = 200
    error: Exception | None = None
    calls: list[tuple[str, dict[str, object], str, bytes, str, int | None]] = []

    def post(
        url: str,
        *,
        data: dict[str, object],
        files: dict[str, tuple[str, BinaryIO, str]],
        timeout: int | None,
    ) -> requests.Response:
        filename, stream, mime = files['files']
        calls.append((url, data.copy(), filename, stream.read(), mime, timeout))
        if error is not None:
            raise error
        response = requests.Response()
        response.status_code = response_status
        response.url = url
        response._content = body
        return response

    monkeypatch.setattr(requests, 'post', post)
    params: dict[str, object] = {'page_ranges': '1-3', 'language': 'ru', 'enable_ocr': True, 'return_md': False}
    loader = MinerULoader(file_path=str(source), api_url='https://parser.example///', params=params, timeout=None)
    documents = loader.load()
    assert documents[0].page_content == '  First\n'
    assert documents[0].metadata == {
        'source': source.name,
        'api_mode': 'local',
        'backend': 'unknown',
        'version': 'unknown',
    }
    assert calls[-1] == (
        'https://parser.example/file_parse',
        {'language': 'ru', 'enable_ocr': True, 'return_md': 'true'},
        source.name,
        source.read_bytes(),
        'application/octet-stream',
        None,
    )
    assert 'page_ranges' not in params
    for body, response_status, expected_code, detail in (
        (b'{}', 200, 502, "missing 'results'"),
        (b'{"results":{}}', 200, 400, 'empty results'),
        (b'{"results":{"first":{"md_content":""}}}', 200, 400, 'empty markdown'),
        (b'not-json', 200, 502, 'Invalid JSON response'),
        (b'{"msg":"failure"}', 503, 400, "{'msg': 'failure'}"),
        (b'<html>failure</html>', 503, 400, '<html>failure</html>'),
    ):
        with pytest.raises(HTTPException) as caught:
            loader.load()
        assert caught.value.status_code == expected_code
        assert detail in caught.value.detail
    for error, expected_code, detail in (
        (requests.Timeout('fixture'), 504, 'request timed out'),
        (requests.HTTPError('fixture'), 400, 'request failed: fixture'),
        (RuntimeError('fixture'), 500, 'Error calling MinerU Local API: fixture'),
    ):
        with pytest.raises(HTTPException) as caught:
            loader.load()
        assert caught.value.status_code == expected_code
        assert detail in caught.value.detail
    error = None
    loader.file_path = str(tmp_path / 'missing.pdf')
    count = len(calls)
    with pytest.raises(HTTPException) as caught:
        loader.load()
    assert caught.value.status_code == 404
    assert len(calls) == count
