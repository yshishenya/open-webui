from __future__ import annotations

import asyncio

from _pytest.monkeypatch import MonkeyPatch
from open_webui.constants import ERROR_MESSAGES
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class _FakeResponse:
    def __init__(self, *, error: Exception | None = None) -> None:
        self._error = error

    def raise_for_status(self) -> None:
        if self._error is not None:
            raise self._error


class _FakeRequestContext:
    def __init__(self, response: _FakeResponse) -> None:
        self.response = response

    async def __aenter__(self) -> _FakeResponse:
        return self.response

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: object | None,
    ) -> None:
        return None


class _FakeSession:
    calls: list[dict[str, object]]
    response_error: Exception | None

    def get(
        self,
        *,
        url: str,
        headers: dict[str, str] | None = None,
        ssl: object = None,
    ) -> _FakeRequestContext:
        self.calls.append({'url': url, 'headers': headers})
        return _FakeRequestContext(_FakeResponse(error=self.response_error))


class TestImagesVerifyUrlAsync(AbstractPostgresTest):
    BASE_PATH = '/api/v1/images'

    def setup_method(self) -> None:
        super().setup_method()
        self._calls: list[dict[str, object]] = []

    def _patch_client(
        self,
        monkeypatch: MonkeyPatch,
        *,
        error: Exception | None = None,
    ) -> None:
        import open_webui.routers.images as images_router

        fake_session_type = type(
            '_BoundFakeSession',
            (_FakeSession,),
            {'calls': self._calls, 'response_error': error},
        )
        session = fake_session_type()

        async def get_fake_session() -> _FakeSession:
            return session

        monkeypatch.setattr(images_router, 'get_session', get_fake_session)

    def test_verify_url_automatic1111_uses_async_client(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        self._patch_client(monkeypatch)

        from open_webui.models.config import Config

        asyncio.run(
            Config.upsert(
                {
                    'image_generation.engine': 'automatic1111',
                    'image_generation.automatic1111.base_url': 'https://auto1111.example',
                    'image_generation.automatic1111.api_auth': None,
                    'image_generation.enable': True,
                }
            )
        )

        with mock_webui_user(id='1'):
            response = self.fast_api_client.get(self.create_url('/config/url/verify'))

        assert response.status_code == 200
        assert response.json() is True
        assert asyncio.run(Config.get('image_generation.enable')) is True
        assert self._calls == [
            {
                'url': 'https://auto1111.example/sdapi/v1/options',
                'headers': {'authorization': ''},
            }
        ]

    def test_verify_url_automatic1111_reports_http_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        error = RuntimeError('upstream failure')
        self._patch_client(monkeypatch, error=error)

        from open_webui.models.config import Config

        asyncio.run(
            Config.upsert(
                {
                    'image_generation.engine': 'automatic1111',
                    'image_generation.automatic1111.base_url': 'https://auto1111.example',
                    'image_generation.automatic1111.api_auth': None,
                    'image_generation.enable': True,
                }
            )
        )

        with mock_webui_user(id='1'):
            response = self.fast_api_client.get(self.create_url('/config/url/verify'))

        assert response.status_code == 400
        assert response.json()['detail'] == ERROR_MESSAGES.INVALID_URL
        assert asyncio.run(Config.get('image_generation.enable')) is True

    def test_verify_url_comfyui_forwards_auth_header(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        self._patch_client(monkeypatch)

        from open_webui.models.config import Config

        asyncio.run(
            Config.upsert(
                {
                    'image_generation.engine': 'comfyui',
                    'image_generation.comfyui.base_url': 'https://comfyui.example',
                    'image_generation.comfyui.api_key': 'comfy-key',
                    'image_generation.enable': True,
                }
            )
        )

        with mock_webui_user(id='1'):
            response = self.fast_api_client.get(self.create_url('/config/url/verify'))

        assert response.status_code == 200
        assert response.json() is True
        assert self._calls == [
            {
                'url': 'https://comfyui.example/object_info',
                'headers': {'Authorization': 'Bearer comfy-key'},
            }
        ]
