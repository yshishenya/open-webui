from __future__ import annotations

from typing import Optional

import httpx
from _pytest.monkeypatch import MonkeyPatch

from open_webui.constants import ERROR_MESSAGES
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class _FakeResponse:
    def __init__(self, *, error: Optional[httpx.HTTPError] = None) -> None:
        self._error = error

    def raise_for_status(self) -> None:
        if self._error is not None:
            raise self._error


class _FakeAsyncClient:
    calls: list[dict[str, object]]
    response_error: Optional[httpx.HTTPError]

    def __init__(self, *args: object, **kwargs: object) -> None:
        return None

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc: Optional[BaseException],
        tb: Optional[object],
    ) -> None:
        return None

    async def get(
        self, *, url: str, headers: Optional[dict[str, str]] = None
    ) -> _FakeResponse:
        self.calls.append({"url": url, "headers": headers})
        return _FakeResponse(error=self.response_error)


class TestImagesVerifyUrlAsync(AbstractPostgresTest):
    BASE_PATH = "/api/v1/images"

    def setup_method(self) -> None:
        super().setup_method()
        self._calls: list[dict[str, object]] = []

    def _patch_client(
        self,
        monkeypatch: MonkeyPatch,
        *,
        error: Optional[httpx.HTTPError] = None,
    ) -> None:
        import open_webui.routers.images as images_router

        fake_client_type = type(
            "_BoundFakeAsyncClient",
            (_FakeAsyncClient,),
            {"calls": self._calls, "response_error": error},
        )
        monkeypatch.setattr(images_router.httpx, "AsyncClient", fake_client_type)

    def test_verify_url_automatic1111_uses_async_client(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        self._patch_client(monkeypatch)

        config = self.fast_api_client.app.state.config
        config.IMAGE_GENERATION_ENGINE = "automatic1111"
        config.AUTOMATIC1111_BASE_URL = "https://auto1111.example"
        config.AUTOMATIC1111_API_AUTH = None
        config.ENABLE_IMAGE_GENERATION = True

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/config/url/verify"))

        assert response.status_code == 200
        assert response.json() is True
        assert config.ENABLE_IMAGE_GENERATION is True
        assert self._calls == [
            {
                "url": "https://auto1111.example/sdapi/v1/options",
                "headers": {"authorization": ""},
            }
        ]

    def test_verify_url_automatic1111_disables_generation_on_http_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        request = httpx.Request("GET", "https://auto1111.example/sdapi/v1/options")
        error = httpx.HTTPStatusError(
            "upstream failure",
            request=request,
            response=httpx.Response(status_code=503, request=request),
        )
        self._patch_client(monkeypatch, error=error)

        config = self.fast_api_client.app.state.config
        config.IMAGE_GENERATION_ENGINE = "automatic1111"
        config.AUTOMATIC1111_BASE_URL = "https://auto1111.example"
        config.AUTOMATIC1111_API_AUTH = None
        config.ENABLE_IMAGE_GENERATION = True

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/config/url/verify"))

        assert response.status_code == 400
        assert response.json()["detail"] == ERROR_MESSAGES.INVALID_URL
        assert config.ENABLE_IMAGE_GENERATION is False

    def test_verify_url_comfyui_forwards_auth_header(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        self._patch_client(monkeypatch)

        config = self.fast_api_client.app.state.config
        config.IMAGE_GENERATION_ENGINE = "comfyui"
        config.COMFYUI_BASE_URL = "https://comfyui.example"
        config.COMFYUI_API_KEY = "comfy-key"
        config.ENABLE_IMAGE_GENERATION = True

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/config/url/verify"))

        assert response.status_code == 200
        assert response.json() is True
        assert self._calls == [
            {
                "url": "https://comfyui.example/object_info",
                "headers": {"Authorization": "Bearer comfy-key"},
            }
        ]
