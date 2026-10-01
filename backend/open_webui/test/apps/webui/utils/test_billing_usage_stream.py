"""Text SSE emitted by the Ollama adapter must reach shared accounting."""

from collections.abc import AsyncGenerator

import pytest
from _pytest.monkeypatch import MonkeyPatch


@pytest.mark.asyncio
async def test_text_stream_preserves_chunks_and_measured_usage(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.billing_integration as billing

    captured: list[dict[str, int]] = []

    async def record_usage(
        user_id: str,
        model_id: str,
        usage_data: dict[str, int],
        chat_id: str | None,
        message_id: str | None,
    ) -> None:
        captured.append(usage_data)

    monkeypatch.setattr(billing, 'track_model_usage', record_usage)
    chunks = [
        'data: {"usage": null}\n\n',
        'data: {"usage": {"input_tokens": 17, "output_tokens": 0}}\n\n',
        'data: [DONE]\n\n',
    ]

    async def stream() -> AsyncGenerator[str, None]:
        for chunk in chunks:
            yield chunk

    result = [chunk async for chunk in billing.track_streaming_response(stream(), 'test', 'test')]
    assert result == chunks
    assert captured == [{'prompt_tokens': 17, 'completion_tokens': 0, 'total_tokens': 17}]
    assert billing.extract_usage_from_response({'usage': None}) is None
    assert billing.extract_usage_from_response({'usage': {}}) is None
    assert (
        billing.extract_usage_from_response({'type': 'response.created', 'response': {'usage': {'input_tokens': 17}}})
        is None
    )
