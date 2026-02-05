from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Optional


class FakeAiohttpStream:
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    def __aiter__(self) -> AsyncIterator[bytes]:
        async def _gen() -> AsyncIterator[bytes]:
            for chunk in self._chunks:
                yield chunk

        return _gen()

    async def iter_chunks(self) -> AsyncIterator[tuple[bytes, bool]]:
        for chunk in self._chunks:
            yield chunk, False


@dataclass
class FakeAiohttpResponse:
    status: int
    headers: dict[str, str]
    json_payload: Optional[dict[str, object]] = None
    text_payload: Optional[str] = None
    content: Optional[FakeAiohttpStream] = None

    async def json(self) -> dict[str, object]:
        if self.json_payload is None:
            raise ValueError("No JSON payload configured")
        return self.json_payload

    async def text(self) -> str:
        if self.text_payload is not None:
            return self.text_payload
        if self.json_payload is not None:
            return str(self.json_payload)
        return ""

    def close(self) -> None:
        return None


class FakeAiohttpSession:
    def __init__(self, response: FakeAiohttpResponse) -> None:
        self._response = response
        self.last_request_url: Optional[str] = None
        self.last_request_data: Optional[str] = None

    async def request(
        self,
        method: str,
        url: str,
        data: Optional[str] = None,
        **_: object,
    ) -> FakeAiohttpResponse:
        assert method == "POST"
        self.last_request_url = url
        self.last_request_data = data
        return self._response

    async def close(self) -> None:
        return None
