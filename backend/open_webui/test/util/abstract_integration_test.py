"""Shared base class for integration-style API tests."""

from __future__ import annotations

import importlib
import pkgutil
from typing import Mapping, Optional
from urllib.parse import urlencode

QueryParams = Mapping[str, str | list[str]]

from fastapi.testclient import TestClient

from open_webui.internal.db import Base, engine
from open_webui.main import app


def _import_all_models() -> None:
    """Ensure all SQLAlchemy models are imported before creating tables."""
    import open_webui.models

    for module in pkgutil.iter_modules(
        open_webui.models.__path__, f"{open_webui.models.__name__}."
    ):
        importlib.import_module(module.name)


class AbstractPostgresTest:
    """Base class with test client + database reset helpers."""

    BASE_PATH: str = ""
    fast_api_client: TestClient

    @classmethod
    def setup_class(cls) -> None:
        cls.fast_api_client = TestClient(app)

    def setup_method(self) -> None:
        self._reset_database()

    def _reset_database(self) -> None:
        _import_all_models()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def create_url(
        self, path: str, query_params: Optional[QueryParams] = None
    ) -> str:
        base = self.BASE_PATH.rstrip("/")
        tail = path.lstrip("/")

        if base and tail:
            url = f"{base}/{tail}"
        elif base:
            url = base
        elif tail:
            url = f"/{tail}"
        else:
            url = ""

        if query_params:
            url = f"{url}?{urlencode(query_params, doseq=True)}"

        return url
