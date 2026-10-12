import json
from pathlib import Path
from urllib.parse import quote

import pytest
import requests
from open_webui.models.users import UserModel
from open_webui.retrieval.loaders.external_document import ExternalDocumentLoader
from open_webui.utils import headers as user_headers


def test_external_loader_preserves_request_documents_and_errors(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    source = tmp_path / 'résumé test.pdf'
    source.write_bytes(b'local document fixture')
    payload: object = None
    response_status = 200
    calls: list[tuple[str, bytes, dict[str, str]]] = []

    def put(url: str, *, data: bytes, headers: dict[str, str]) -> requests.Response:
        calls.append((url, data, headers.copy()))
        response = requests.Response()
        response.status_code = response_status
        response._content = json.dumps(payload).encode()
        return response

    monkeypatch.setattr(requests, 'put', put)
    monkeypatch.setattr(user_headers, 'FORWARD_USER_INFO_HEADER_JWT_SECRET', '')
    user = UserModel(
        id='owner',
        name=' Owner ',
        email='owner@example.test',
        role='user',
        last_active_at=0,
        updated_at=0,
        created_at=0,
    )
    loader = ExternalDocumentLoader(
        file_path=str(source),
        url='https://parser.example/',
        api_key='local-fixture-only',
        mime_type='application/pdf',
        user=user,
        headers={'X-File': '{{FILE_ID}}', 'X-Owner': '{{USER_ID}}'},
        metadata={'file_id': 'file'},
    )
    first = {'page_content': 'First', 'metadata': {'page': 1}}
    second = {'page_content': '', 'metadata': {'page': 2}}
    for url in ('https://parser.example', 'https://parser.example/', 'https://parser.example///'):
        loader.url = url
        for payload in (first, [first, second]):
            documents = loader.load()
            expected = [first] if isinstance(payload, dict) else [first, second]
            assert [
                {'page_content': document.page_content, 'metadata': document.metadata} for document in documents
            ] == expected
            expected_url = (url[:-1] if url.endswith('/') else url) + '/process'
            assert calls[-1][0] == expected_url
            assert calls[-1][1] == source.read_bytes()
            assert calls[-1][2] == {
                'Content-Type': 'application/pdf',
                'Authorization': 'Bearer local-fixture-only',
                'X-Filename': quote(source.name),
                'X-File': 'file',
                'X-Owner': 'owner',
                user_headers.FORWARD_USER_INFO_HEADER_USER_NAME: 'Owner',
                user_headers.FORWARD_USER_INFO_HEADER_USER_ID: 'owner',
                user_headers.FORWARD_USER_INFO_HEADER_USER_EMAIL: 'owner@example.test',
                user_headers.FORWARD_USER_INFO_HEADER_USER_ROLE: 'user',
            }
    for payload in (None, {}, [], False, 0):
        with pytest.raises(Exception, match='No content returned'):
            loader.load()
    payload = 'unsupported'
    with pytest.raises(Exception, match='Unable to parse content'):
        loader.load()
    response_status = 503
    with pytest.raises(Exception, match='Error loading document: 503'):
        loader.load()
    loader.file_path = str(tmp_path / 'missing.pdf')
    with pytest.raises(FileNotFoundError):
        loader.load()
