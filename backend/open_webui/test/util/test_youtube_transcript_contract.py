import asyncio

import pytest
from open_webui.retrieval.loaders.youtube import YoutubeLoader, YoutubeTranscriptError
from requests import Response, Session
from youtube_transcript_api import TranscriptList, YouTubeRequestFailed, YouTubeTranscriptApi


def test_native_transcript_selection_and_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    video = 'abcdefghijk'
    source = f'https://youtu.be/{video}'
    requested: list[str] = []
    responses: dict[str, str] = {}
    status = 200

    def get(_session: Session, url: str) -> Response:
        requested.append(url)
        response = Response()
        response.status_code = status
        response.url = url
        response._content = responses[url].encode()
        response.encoding = 'utf-8'
        return response

    monkeypatch.setattr(Session, 'get', get)

    def tracks(entries: list[tuple[str, bool, str]]) -> TranscriptList:
        captions: list[dict[str, object]] = []
        responses.clear()
        requested.clear()
        for language, generated, text in entries:
            url = f'https://transcripts.invalid/{language}/{generated}'
            responses[url] = text
            captions.append(
                {
                    'baseUrl': url,
                    'languageCode': language,
                    'name': {'runs': [{'text': language}]},
                    'kind': 'asr' if generated else '',
                }
            )
        return TranscriptList.build(Session(), video, {'captionTracks': captions})

    def xml(text: str) -> str:
        return f'<transcript><text start="0" dur="1"> {text} </text></transcript>'

    available = tracks([])
    listed: list[str] = []

    def list_transcripts(_api: YouTubeTranscriptApi, video_id: str) -> TranscriptList:
        listed.append(video_id)
        return available

    monkeypatch.setattr(YouTubeTranscriptApi, 'list', list_transcripts)
    cases: list[tuple[list[str], list[tuple[str, bool, str]], str, list[str]]] = [
        (['ru'], [('ru', True, xml('auto')), ('ru', False, xml('manual'))], 'manual', ['ru/False']),
        (['ru'], [('ru', True, xml('auto')), ('en', False, xml('English'))], 'auto', ['ru/True']),
        (['fr', 'de'], [('de', False, xml('Deutsch'))], 'Deutsch', ['de/False']),
        (['ru'], [('en', False, xml('fallback'))], 'fallback', ['en/False']),
        (['ru'], [('ru', False, '<bad'), ('en', True, xml('fallback'))], 'fallback', ['ru/False', 'en/True']),
        (
            ['ru'],
            [('ru', False, '<transcript/>'), ('en', False, xml('fallback'))],
            'fallback',
            ['ru/False', 'en/False'],
        ),
        (
            ['ru'],
            [('ru', False, '<bad'), ('ru', True, xml('auto')), ('en', False, xml('fallback'))],
            'fallback',
            ['ru/False', 'en/False'],
        ),
        (['en', 'en'], [('en', False, xml('A &amp; B'))], 'A & B', ['en/False']),
    ]
    for languages, entries, expected, urls in cases:
        available = tracks(entries)
        loader = YoutubeLoader(source, language=languages)
        assert loader.language == languages + ([] if 'en' in languages else ['en'])
        docs = loader.load()
        assert len(docs) == 1
        assert docs[0].page_content == expected
        assert docs[0].metadata == {'source': source}
        assert requested == [f'https://transcripts.invalid/{url}' for url in urls]
        assert listed[-1] == video

    available = tracks([('de', False, xml('Deutsch'))])
    with pytest.raises(YoutubeTranscriptError) as missing:
        YoutubeLoader(source, language='ru').load()
    assert str(missing.value) == f'No transcript found for the YouTube video {video} in these languages: ru, en.'
    assert requested == []

    available = tracks([('ru', False, xml('manual')), ('en', False, xml('fallback'))])
    status = 403
    with pytest.raises(YoutubeTranscriptError) as failed:
        YoutubeLoader(source, language='ru').load()
    assert isinstance(failed.value.__cause__, YouTubeRequestFailed)
    assert requested == ['https://transcripts.invalid/ru/False']
    status = 200

    loader = YoutubeLoader(source, language='ru', proxy_url='http://proxy.invalid:8080')
    original_init = YouTubeTranscriptApi.__init__
    proxies: list[dict[str, str]] = []

    def init(api: YouTubeTranscriptApi, *, proxy_config: object = None) -> None:
        original_init(api, proxy_config=proxy_config)
        proxies.append(dict(api._fetcher._http_client.proxies))

    monkeypatch.setattr(YouTubeTranscriptApi, '__init__', init)
    assert asyncio.run(loader.aload())[0].page_content == 'manual'
    assert proxies == [{'http': 'http://proxy.invalid:8080', 'https': 'http://proxy.invalid:8080'}]

    def fail_list(_api: YouTubeTranscriptApi, _video_id: str) -> TranscriptList:
        raise RuntimeError('list unavailable')

    monkeypatch.setattr(YouTubeTranscriptApi, 'list', fail_list)
    with pytest.raises(YoutubeTranscriptError) as unavailable:
        loader.load()
    assert isinstance(unavailable.value.__cause__, RuntimeError)
    assert str(unavailable.value.__cause__) == 'list unavailable'
