from __future__ import annotations

import asyncio
from typing import Optional

import httpx
import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException


class _StubAsyncClient:
    def __init__(self, outcome: httpx.Response | httpx.RequestError) -> None:
        self._outcome = outcome

    async def __aenter__(self) -> "_StubAsyncClient":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc: Optional[BaseException],
        tb: Optional[object],
    ) -> None:
        return None

    async def get(self, _url: str) -> httpx.Response:
        if isinstance(self._outcome, httpx.RequestError):
            raise self._outcome
        return self._outcome


def _client_factory(
    outcome: httpx.Response | httpx.RequestError,
) -> type[_StubAsyncClient]:
    class _Factory(_StubAsyncClient):
        def __init__(self, *args: object, **kwargs: object) -> None:
            super().__init__(outcome)

    return _Factory


def test_fetch_external_manifest_returns_payload(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.airis.manifest as manifest_utils

    url = "https://example.com/manifest.json"
    response = httpx.Response(
        status_code=200,
        request=httpx.Request("GET", url),
        json={"name": "Airis"},
    )
    monkeypatch.setattr(
        manifest_utils.httpx,
        "AsyncClient",
        _client_factory(response),
    )

    payload = asyncio.run(manifest_utils.fetch_external_manifest(url))
    assert payload == {"name": "Airis"}


def test_fetch_external_manifest_maps_upstream_status_error(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.airis.manifest as manifest_utils

    url = "https://example.com/manifest.json"
    response = httpx.Response(
        status_code=503,
        request=httpx.Request("GET", url),
        json={"error": "upstream unavailable"},
    )
    monkeypatch.setattr(
        manifest_utils.httpx,
        "AsyncClient",
        _client_factory(response),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(manifest_utils.fetch_external_manifest(url))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to fetch external manifest"


def test_fetch_external_manifest_rejects_non_object_payload(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.airis.manifest as manifest_utils

    url = "https://example.com/manifest.json"
    response = httpx.Response(
        status_code=200,
        request=httpx.Request("GET", url),
        json=["invalid", "manifest"],
    )
    monkeypatch.setattr(
        manifest_utils.httpx,
        "AsyncClient",
        _client_factory(response),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(manifest_utils.fetch_external_manifest(url))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "External manifest payload is invalid"


def test_fetch_external_manifest_maps_request_error(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.airis.manifest as manifest_utils

    url = "https://example.com/manifest.json"
    request_error = httpx.RequestError("network issue", request=httpx.Request("GET", url))
    monkeypatch.setattr(
        manifest_utils.httpx,
        "AsyncClient",
        _client_factory(request_error),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(manifest_utils.fetch_external_manifest(url))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to fetch external manifest"
