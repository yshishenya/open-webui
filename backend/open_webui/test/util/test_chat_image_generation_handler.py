from __future__ import annotations

from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException, status


def _build_request() -> SimpleNamespace:
    config = SimpleNamespace(
        ENABLE_IMAGE_EDIT=False,
        ENABLE_IMAGE_PROMPT_GENERATION=False,
    )
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(config=config)))


def _build_extra_params() -> dict[str, object]:
    async def event_emitter(_: dict[str, object]) -> None:
        return None

    return {
        "__metadata__": {"chat_id": "local:test-chat", "message_id": "message-1"},
        "__event_emitter__": event_emitter,
    }


@pytest.mark.asyncio
async def test_chat_image_generation_handler_reraises_billing_block(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.middleware as middleware

    async def fake_image_generations(
        *args: object, **kwargs: object
    ) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_funds",
                "available_kopeks": 0,
                "required_kopeks": 16000,
                "currency": "RUB",
            },
        )

    monkeypatch.setattr(middleware, "image_generations", fake_image_generations)

    with pytest.raises(HTTPException) as exc_info:
        await middleware.chat_image_generation_handler(
            request=_build_request(),
            form_data={
                "model": "gemini-3.1-flash-lite",
                "messages": [{"role": "user", "content": "draw a cat"}],
            },
            extra_params=_build_extra_params(),
            user=SimpleNamespace(id="user-1"),
        )

    assert exc_info.value.status_code == status.HTTP_402_PAYMENT_REQUIRED
    assert isinstance(exc_info.value.detail, dict)
    assert exc_info.value.detail["error"] == "insufficient_funds"


@pytest.mark.asyncio
async def test_chat_image_generation_handler_keeps_generic_fallback_for_non_billing_errors(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.utils.middleware as middleware

    async def fake_image_generations(
        *args: object, **kwargs: object
    ) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "image_provider_error", "message": "provider boom"},
        )

    monkeypatch.setattr(middleware, "image_generations", fake_image_generations)

    result = await middleware.chat_image_generation_handler(
        request=_build_request(),
        form_data={
            "model": "gemini-3.1-flash-lite",
            "messages": [{"role": "user", "content": "draw a cat"}],
        },
        extra_params=_build_extra_params(),
        user=SimpleNamespace(id="user-1"),
    )

    system_messages = [
        message["content"]
        for message in result["messages"]
        if message.get("role") == "system"
    ]
    assert len(system_messages) == 1
    assert (
        "Image generation was attempted but failed because of an error."
        in system_messages[0]
    )
    assert "provider boom" in system_messages[0]


@pytest.mark.asyncio
async def test_builtin_generate_image_reraises_billing_block(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.tools.builtin as builtin_tools

    async def fake_image_generations(
        *args: object, **kwargs: object
    ) -> list[dict[str, str]]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_funds",
                "available_kopeks": 0,
                "required_kopeks": 16000,
                "currency": "RUB",
            },
        )

    monkeypatch.setattr(builtin_tools, "image_generations", fake_image_generations)

    with pytest.raises(HTTPException) as exc_info:
        await builtin_tools.generate_image(
            prompt="draw a cat",
            __request__=object(),
            __user__=None,
        )

    assert exc_info.value.status_code == status.HTTP_402_PAYMENT_REQUIRED
    assert isinstance(exc_info.value.detail, dict)
    assert exc_info.value.detail["error"] == "insufficient_funds"
