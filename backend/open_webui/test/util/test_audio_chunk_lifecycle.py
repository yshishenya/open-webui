import asyncio
import threading
from pathlib import Path
from types import SimpleNamespace

import aiofiles
import pytest
from fastapi import HTTPException, Request


@pytest.mark.asyncio
async def test_audio_chunks_close_before_cleanup(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from open_webui.routers import audio

    source = tmp_path / 'source.wav'
    chunks = [tmp_path / 'first.wav', tmp_path / 'second.wav']
    source.write_bytes(b'original-fixture')
    request = Request({'type': 'http'})
    metadata = {'language': 'ru'}
    monkeypatch.setattr(audio, 'BYPASS_PYDUB_PREPROCESSING', False)
    monkeypatch.setattr(audio, 'is_audio_conversion_required', lambda _path: False)
    monkeypatch.setattr(audio, 'compress_audio', lambda path: path)
    monkeypatch.setattr(audio, 'split_audio', lambda *_: [str(path) for path in chunks])

    def reset() -> None:
        for chunk in chunks:
            chunk.write_bytes(b'chunk-fixture')

    for failure in [HTTPException(429, 'provider refused'), RuntimeError('provider unavailable')]:
        reset()
        started = asyncio.Event()
        closed = asyncio.Event()
        owned: list[asyncio.Task[dict[str, str]]] = []
        existed_on_close: list[bool] = []

        async def failing_handler(
            received_request: Request, path: str, received_metadata: dict[str, str], _user: None
        ) -> dict[str, str]:
            assert received_request is request and received_metadata is metadata
            current = asyncio.current_task()
            assert current is not None
            owned.append(current)
            if path == str(chunks[0]):
                await started.wait()
                raise failure
            try:
                async with aiofiles.open(path, 'rb') as stream:
                    assert await stream.read() == b'chunk-fixture'
                    started.set()
                    await asyncio.Event().wait()
            finally:
                existed_on_close.append(Path(path).exists())
                closed.set()
            return {'text': 'unused'}

        monkeypatch.setattr(audio, 'transcription_handler', failing_handler)
        try:
            with pytest.raises(HTTPException) as error:
                await asyncio.wait_for(audio.transcribe(request, str(source), metadata), timeout=5)
            if isinstance(failure, HTTPException):
                assert error.value is failure
            else:
                assert error.value.status_code == 500
                assert error.value.detail == 'Error transcribing chunk: provider unavailable'
            assert closed.is_set(), 'Sibling handler outlives cleanup'
            assert existed_on_close == [True], 'Input was deleted before the reader closed'
            assert all(task.done() for task in owned)
            assert source.read_bytes() == b'original-fixture'
            assert not any(chunk.exists() for chunk in chunks)
        finally:
            for task in owned:
                task.cancel()
            await asyncio.gather(*owned, return_exceptions=True)

    reset()
    second_finished = asyncio.Event()

    async def ordered_handler(_request: Request, path: str, _metadata: dict[str, str], _user: None) -> dict[str, str]:
        if path == str(chunks[0]):
            await second_finished.wait()
            return {'text': 'first'}
        second_finished.set()
        return {'text': 'second'}

    monkeypatch.setattr(audio, 'transcription_handler', ordered_handler)
    assert await audio.transcribe(request, str(source), metadata) == {'text': 'first second'}
    assert source.exists() and not any(chunk.exists() for chunk in chunks)


@pytest.mark.asyncio
async def test_whisper_worker_finishes_before_chunk_cleanup(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from open_webui.routers import audio

    source = tmp_path / 'source.wav'
    chunks = [tmp_path / 'first.wav']
    source.write_bytes(b'original-fixture')
    chunks[0].write_bytes(b'chunk-fixture')
    metadata = {'language': 'ru'}
    monkeypatch.setattr(audio, 'BYPASS_PYDUB_PREPROCESSING', False)
    monkeypatch.setattr(audio, 'is_audio_conversion_required', lambda _path: False)
    monkeypatch.setattr(audio, 'compress_audio', lambda path: path)
    loop = asyncio.get_running_loop()
    worker_started = asyncio.Event()
    release_worker = threading.Event()
    worker_finished = threading.Event()
    worker_reads: list[bytes] = []

    def model_transcribe(path: str, **_kwargs: object) -> tuple[list[SimpleNamespace], SimpleNamespace]:
        loop.call_soon_threadsafe(worker_started.set)
        try:
            assert release_worker.wait(timeout=5)
            worker_reads.append(Path(path).read_bytes())
            return [SimpleNamespace(text='local')], SimpleNamespace(language='ru', language_probability=1.0)
        finally:
            worker_finished.set()

    whisper_request = Request(
        {
            'type': 'http',
            'app': SimpleNamespace(
                state=SimpleNamespace(faster_whisper_model=SimpleNamespace(transcribe=model_transcribe))
            ),
        }
    )
    monkeypatch.setattr(audio, 'split_audio', lambda *_: [str(chunks[0])])

    async def local_handler(_request: Request, path: str, _metadata: dict[str, str], _user: None) -> dict[str, str]:
        return await audio._transcribe_whisper(whisper_request, path, ['ru'], str(tmp_path), 'local')

    monkeypatch.setattr(audio, 'transcription_handler', local_handler)
    task = asyncio.create_task(audio.transcribe(whisper_request, str(source), metadata))
    try:
        await asyncio.wait_for(worker_started.wait(), timeout=5)
        task.cancel()
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(task), timeout=0.05)
        task.cancel('repeat cancellation during cleanup')
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(task), timeout=0.05)
        assert chunks[0].exists(), 'Cancelled request deleted input of a running native thread'
    finally:
        release_worker.set()
        assert await asyncio.to_thread(worker_finished.wait, timeout=5)
        await asyncio.gather(task, return_exceptions=True)
    assert task.cancelled() and worker_finished.is_set()
    assert worker_reads == [b'chunk-fixture']
    assert source.exists() and not chunks[0].exists()
    assert not (tmp_path / 'local.json').exists()
