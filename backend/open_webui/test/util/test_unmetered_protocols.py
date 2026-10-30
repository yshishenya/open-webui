"""Unmetered upstream protocols must never reach a paid provider with wallet enabled."""

import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_direct_protocols_reject_before_provider_io(monkeypatch: pytest.MonkeyPatch) -> None:
    main = importlib.import_module('open_webui.main')
    from open_webui.routers import openai
    from open_webui.routers.audio import realtime

    monkeypatch.setattr(main, 'ENABLE_BILLING_WALLET', True)
    monkeypatch.setattr(openai, 'ENABLE_BILLING_WALLET', True)
    monkeypatch.setattr(openai, 'ENABLE_OPENAI_API_PASSTHROUGH', True)
    for call in (
        lambda: main.passthrough_anthropic_messages(None, {}, None),
        lambda: openai.responses(None, None, None),
        lambda: openai.proxy('responses', None, None),
    ):
        with pytest.raises(HTTPException) as denied:
            await call()
        assert denied.value.status_code == 503
        assert denied.value.detail == {'error': 'billing_protocol_unavailable'}

    monkeypatch.setattr(realtime, 'ENABLE_BILLING_WALLET', True)
    monkeypatch.setattr(realtime, 'get_verified_user_by_token', AsyncMock(return_value=SimpleNamespace(id='user')))
    provider_settings = AsyncMock(side_effect=AssertionError('Provider settings must not be read'))
    monkeypatch.setattr(realtime.Config, 'get_many', provider_settings)
    ws = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace()),
        accept=AsyncMock(),
        receive_text=AsyncMock(return_value='{"type":"auth","token":"test"}'),
        send_json=AsyncMock(),
        close=AsyncMock(),
    )
    await realtime.realtime_call(ws)
    provider_settings.assert_not_awaited()
    assert ws.send_json.await_args.args[0]['type'] == 'bridge.error'
    ws.close.assert_awaited_once()
