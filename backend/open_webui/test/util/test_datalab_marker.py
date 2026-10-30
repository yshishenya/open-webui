import json
from pathlib import Path

import pytest
import requests
from fastapi import HTTPException
from open_webui.retrieval.loaders import datalab_marker as marker


def _response(body: object, code: int = 200) -> requests.Response:
    response = requests.Response()
    response.status_code = code
    response.url = 'https://marker.invalid/result'
    response._content = body.encode() if isinstance(body, str) else json.dumps(body).encode()
    return response


@pytest.mark.parametrize(
    'scenario,output_format,initial,polls,expected',
    [
        ('direct', 'markdown', {'success': True, 'output': '  hello  '}, [], 'hello'),
        ('direct', 'HTML', {'success': True, 'output': ' <p>x</p> '}, [], '<p>x</p>'),
        ('direct', 'json', {'success': True, 'output': {'x': [1]}}, [], '{\n  "x": [\n    1\n  ]\n}'),
        ('blank-config', 'markdown', {'success': True, 'output': 0}, [], '0'),
        ('null-output', 'markdown', {'success': True, 'output': None}, [], 'None'),
        ('null-json', 'json', {'success': True, 'output': None}, [], 'null'),
        (
            'metadata',
            'markdown',
            {
                'success': True,
                'output': 'x',
                'page_count': [2],
                'output_format': {'format': 'md'},
                'images': {'a.png': 'data', 'b.png': 'data'},
            },
            [],
            'x',
        ),
        (
            'null-metadata',
            'markdown',
            {'success': True, 'output': 'x', 'page_count': None, 'output_format': None},
            [],
            'x',
        ),
        ('write-failure', 'markdown', {'success': True, 'output': 'x'}, [], 'x'),
        ('mkdir-failure', 'markdown', {'success': True, 'output': 'x'}, [], FileExistsError),
        ('missing-file', 'markdown', {'success': True, 'output': 'x'}, [], (404, 'File not found:')),
        ('post-http', 'markdown', _response({}, 503), [], (400, 'Datalab Marker request failed:')),
        ('post-json', 'markdown', _response('not-json'), [], (502, 'Invalid JSON response:')),
        ('post-network', 'markdown', requests.ConnectionError('offline'), [], (500, 'offline')),
        (
            'post-failure',
            'markdown',
            {'success': False, 'error': 'rejected'},
            [],
            (400, 'Datalab Marker request failed: rejected'),
        ),
        ('missing-success', 'markdown', {'output': 'x'}, [], (400, 'Datalab Marker request failed: Unknown error')),
        (
            'missing-output',
            'markdown',
            {'success': True},
            [],
            (
                502,
                "Custom Marker endpoint returned success but no 'output' field found. "
                "Available fields: ['success']. Expected either 'request_check_url' for polling "
                "or 'output' field for direct response.",
            ),
        ),
        ('unsupported', 'text', {'success': True, 'output': 'x'}, [], (400, 'Unsupported output format: text')),
        ('empty', 'markdown', {'success': True, 'output': '  '}, [], (400, 'Marker returned empty content')),
        (
            'poll',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check', 'request_id': 'request-1'},
            [{'status': 'processing'}, {'status': 'complete', 'success': True, 'markdown': ' done ', 'page_count': 3}],
            'done',
        ),
        (
            'last-poll',
            'html',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'processing'}] * 299 + [{'status': 'complete', 'success': True, 'html': '<p>x</p>'}],
            '<p>x</p>',
        ),
        (
            'poll-failure',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'failed', 'error': 'failed'}],
            (400, 'Marker processing failed: failed'),
        ),
        (
            'poll-success-false',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'processing', 'success': False}],
            (400, 'Marker processing failed: Marker returned failure without error message'),
        ),
        (
            'final-failure',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'complete', 'success': False, 'error': 'final'}],
            (400, 'Final processing failed: final'),
        ),
        (
            'final-missing-success',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'complete'}],
            (400, 'Final processing failed: Unknown processing error'),
        ),
        (
            'poll-http',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [_response({}, 502)],
            (502, 'Polling failed:'),
        ),
        (
            'poll-json',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [_response('not-json')],
            (502, 'Polling failed:'),
        ),
        (
            'timeout',
            'markdown',
            {'success': True, 'request_check_url': 'https://marker.invalid/check'},
            [{'status': 'processing'}] * 300,
            (504, 'Marker processing timed out'),
        ),
    ],
)
def test_datalab_marker_contract(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    scenario: str,
    output_format: str,
    initial: object,
    polls: list[object],
    expected: object,
) -> None:
    loader, events, output = _prepare_loader(monkeypatch, tmp_path, scenario, output_format, initial, polls)
    if isinstance(expected, tuple):
        with pytest.raises(HTTPException) as caught:
            loader.load()
        assert caught.value.status_code == expected[0]
        assert caught.value.detail.startswith(expected[1])
    elif isinstance(expected, type):
        with pytest.raises(expected):
            loader.load()
    else:
        docs = loader.load()
        assert len(docs) == 1 and docs[0].page_content == expected
        metadata = {
            'source': 'sample.PDF',
            'output_format': output_format,
            'page_count': 0,
            'processed_with_llm': True,
            'request_id': '',
        }
        if scenario == 'poll':
            metadata.update(page_count=3, request_id='request-1')
        if scenario == 'metadata':
            metadata.update(
                page_count='[2]', output_format='{"format":"md"}', image_count=2, images='["a.png","b.png"]'
            )
        if scenario == 'null-metadata':
            metadata.update(page_count='', output_format='')
        assert docs[0].metadata == metadata
        if scenario != 'write-failure':
            extension = {'markdown': 'md', 'html': 'html', 'json': 'json'}[output_format.lower()]
            assert (output / f'sample.{extension}').read_text() == expected
    assert events == ([] if scenario == 'missing-file' else ['post'] + ['sleep', 'get'] * len(polls))


def _prepare_loader(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    scenario: str,
    output_format: str,
    initial: object,
    polls: list[object],
) -> tuple[marker.DatalabMarkerLoader, list[str], Path]:
    source = tmp_path / 'sample.PDF'
    source.write_bytes(b'local document')
    output = tmp_path / 'marker_output'
    output.mkdir()
    if scenario == 'missing-file':
        source.unlink()
    if scenario == 'write-failure':
        (output / 'sample.md').mkdir()
    if scenario == 'mkdir-failure':
        output.rmdir()
        output.write_text('file instead of directory')
    events: list[str] = []
    responses = iter(polls)

    def post(url: str, **kwargs: object) -> requests.Response:
        events.append('post')
        assert url == 'https://marker.invalid/api'
        assert kwargs['headers'] == {'X-Api-Key': 'local-test-only'}
        filename, reader, mime = kwargs['files']['file']
        assert (filename, mime, reader.read()) == ('sample.PDF', 'application/pdf', b'local document')
        assert kwargs['data'] == {
            'use_llm': 'true',
            'skip_cache': 'false',
            'force_ocr': 'true',
            'paginate': 'false',
            'strip_existing_ocr': 'true',
            'disable_image_extraction': 'false',
            'format_lines': 'true',
            'output_format': output_format,
            **({} if scenario == 'blank-config' else {'additional_config': ' {"test": 1} '}),
        }
        if isinstance(initial, Exception):
            raise initial
        return initial if isinstance(initial, requests.Response) else _response(initial)

    def get(url: str, **kwargs: object) -> requests.Response:
        events.append('get')
        assert url == 'https://marker.invalid/check'
        assert kwargs == {'headers': {'X-Api-Key': 'local-test-only'}}
        body = next(responses)
        return body if isinstance(body, requests.Response) else _response(body)

    def sleep(seconds: int) -> None:
        assert seconds == 2
        events.append('sleep')

    monkeypatch.setattr(marker, 'UPLOAD_DIR', str(tmp_path))
    monkeypatch.setattr(marker.requests, 'post', post)
    monkeypatch.setattr(marker.requests, 'get', get)
    monkeypatch.setattr(marker.time, 'sleep', sleep)
    loader = marker.DatalabMarkerLoader(
        str(source),
        'local-test-only',
        'https://marker.invalid/api',
        additional_config=' ' if scenario == 'blank-config' else ' {"test": 1} ',
        use_llm=True,
        force_ocr=True,
        strip_existing_ocr=True,
        format_lines=True,
        output_format=output_format,
    )
    return loader, events, output
