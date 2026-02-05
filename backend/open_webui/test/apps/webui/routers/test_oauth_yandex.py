from __future__ import annotations

from typing import Optional

from _pytest.monkeypatch import MonkeyPatch
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from test.util.abstract_integration_test import AbstractPostgresTest


class TestYandexOAuthRouter(AbstractPostgresTest):
    def test_login_delegates_to_oauth_manager(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.main as main

        captured_provider: dict[str, str] = {}

        async def fake_handle_login(request: Request, provider: str) -> Response:
            captured_provider["value"] = provider
            return PlainTextResponse("ok")

        monkeypatch.setattr(
            main.app.state.oauth_manager, "handle_login", fake_handle_login, raising=True
        )

        response = self.fast_api_client.get("/api/v1/oauth/yandex/login")

        assert response.status_code == 200
        assert response.text == "ok"
        assert captured_provider["value"] == "yandex"

    def test_callback_delegates_to_oauth_manager(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.main as main

        captured: dict[str, object] = {}

        async def fake_handle_callback(
            request: Request,
            provider: str,
            response: Response,
            db: Optional[Session] = None,
        ) -> Response:
            captured["provider"] = provider
            captured["db_present"] = db is not None
            return PlainTextResponse("cb")

        monkeypatch.setattr(
            main.app.state.oauth_manager,
            "handle_callback",
            fake_handle_callback,
            raising=True,
        )

        response = self.fast_api_client.get("/api/v1/oauth/yandex/callback?code=1&state=2")

        assert response.status_code == 200
        assert response.text == "cb"
        assert captured["provider"] == "yandex"
        assert captured["db_present"] is True
