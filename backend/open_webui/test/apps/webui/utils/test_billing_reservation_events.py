from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from open_webui.models.billing import PricingRateCardModel
from open_webui.utils.airis.billing_events import emit_billing_reservation
from open_webui.utils.billing_integration import BillingHoldContext
from open_webui.utils.lead_magnet import LeadMagnetReservation


def context() -> BillingHoldContext:
    rate = PricingRateCardModel(
        id='rate',
        model_id='model',
        modality='text',
        unit='token_in',
        raw_cost_per_unit_kopeks=1,
        version='test',
        created_at=1,
    )
    return BillingHoldContext(
        request_id='operation',
        user_id='owner',
        model_id='model',
        modality='text',
        billing_source='payg',
        wallet_id='wallet',
        plan_id=None,
        subscription_id=None,
        discount_percent=0,
        rate_in=rate,
        rate_out=rate,
        estimate_min_kopeks=1,
        estimate_max_kopeks=10,
        estimated_prompt_tokens=1,
        estimated_min_output_tokens=1,
        estimated_max_output_tokens=10,
        hold_amount_kopeks=10,
        hold_expires_at=100,
        lead_magnet_decision=LeadMagnetReservation(None, 'free_quota_insufficient', 200),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'metadata',
    [
        {},
        {'chat_id': 'chat'},
        {'chat_id': 'chat', 'message_id': 12},
        {'chat_id': 'chat', 'message_id': 'reply', 'internal': True},
        {'chat_id': 'channel:test', 'message_id': 'reply'},
    ],
)
async def test_noninteractive_calls_do_not_emit(monkeypatch: pytest.MonkeyPatch, metadata: dict[str, object]) -> None:
    import open_webui.socket.main as socket_main

    factory = AsyncMock()
    monkeypatch.setattr(socket_main, 'get_event_emitter', factory)
    await emit_billing_reservation(context(), metadata)
    await emit_billing_reservation(None, metadata)
    await emit_billing_reservation(replace(context(), lead_magnet_decision=None), metadata)
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_emitter_uses_authoritative_user_and_does_not_fail_a_hold(monkeypatch: pytest.MonkeyPatch) -> None:
    import open_webui.socket.main as socket_main

    emitter = AsyncMock(side_effect=RuntimeError('socket unavailable'))
    factory = AsyncMock(return_value=emitter)
    monkeypatch.setattr(socket_main, 'get_event_emitter', factory)
    await emit_billing_reservation(context(), {'user_id': 'untrusted', 'chat_id': 'chat', 'message_id': 'reply'})
    factory.assert_awaited_once_with({'user_id': 'owner', 'chat_id': 'chat', 'message_id': 'reply'}, update_db=False)
    emitter.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'decision',
    [
        LeadMagnetReservation('free-reservation', 'free_quota'),
        LeadMagnetReservation(None, 'free_quota_insufficient', 200),
        LeadMagnetReservation(None, 'free_quota_exhausted', 200),
        LeadMagnetReservation(None, 'paid_model'),
    ],
)
async def test_ollama_forwards_reservation_without_another_consent_or_event(
    monkeypatch: pytest.MonkeyPatch, decision: LeadMagnetReservation
) -> None:
    import open_webui.socket.main as socket_main
    import open_webui.utils.chat as chat
    from fastapi import Request

    hold = replace(
        context(), billing_source='lead_magnet' if decision.reservation_id else 'payg', lead_magnet_decision=decision
    )
    request = Request(
        {
            'type': 'http',
            'app': SimpleNamespace(
                state=SimpleNamespace(
                    MODELS={
                        'model': {'id': 'model', 'owned_by': 'ollama'},
                    }
                )
            ),
        }
    )
    emitter = AsyncMock()
    factory = AsyncMock(return_value=emitter)
    provider = AsyncMock(return_value={'message': {'content': 'hello'}})
    settle = AsyncMock(return_value={'choices': [{'message': {'content': 'hello'}}]})
    monkeypatch.setattr(socket_main, 'get_event_emitter', factory)
    monkeypatch.setattr(chat, 'check_and_enforce_quota', AsyncMock())
    monkeypatch.setattr(chat, 'preflight_estimate_hold', AsyncMock(return_value=hold))
    monkeypatch.setattr(chat, 'generate_ollama_chat_completion', provider)
    monkeypatch.setattr(chat, 'track_non_streaming_response', settle)
    await chat.generate_chat_completion(
        request,
        {
            'model': 'model',
            'messages': [{'role': 'user', 'content': 'hello'}],
            'metadata': {'chat_id': 'chat', 'message_id': 'reply'},
        },
        user=SimpleNamespace(id='owner', role='admin'),
    )
    emitter.assert_awaited_once()
    assert emitter.call_args.args[0]['data']['reason'] == decision.reason
    provider.assert_awaited_once()
    settle.assert_awaited_once()
