import json
import time
import uuid
from decimal import Decimal
from typing import Protocol

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.billing_scenarios_matrix import assert_wallet_topup_balance, get_usage_event
from test.util.mock_user import mock_webui_user
from test.util.openai_provider_fakes import (
    FakeAiohttpResponse,
    FakeAiohttpSession,
    FakeAiohttpStream,
)


class _OpenAIState(Protocol):
    OPENAI_MODELS: dict[str, dict[str, object]]


class _AppWithState(Protocol):
    state: _OpenAIState


class _RequestWithApp(Protocol):
    app: _AppWithState


class TestOpenAIChatBillingStreaming(AbstractPostgresTest):
    BASE_PATH = "/openai"

    def setup_method(self) -> None:
        super().setup_method()

        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.model_id = "test-openai-chat-streaming"

        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.model_id,
                model_tier=None,
                modality="text",
                unit="token_in",
                raw_cost_per_unit_kopeks=100,
                version="2025-01",
                created_at=now,
                provider=None,
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.model_id,
                model_tier=None,
                modality="text",
                unit="token_out",
                raw_cost_per_unit_kopeks=200,
                version="2025-01",
                created_at=now,
                provider=None,
                is_default=True,
                is_active=True,
            ).model_dump()
        )

        Models.insert_new_model(
            ModelForm(
                id=self.model_id,
                name="Streaming billing model",
                base_model_id=None,
                meta=ModelMeta(lead_magnet=False),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            user_id="admin",
        )

        config = self.fast_api_client.app.state.config
        config.ENABLE_OPENAI_API = True
        config.OPENAI_API_BASE_URLS = ["https://example.com"]
        config.OPENAI_API_KEYS = ["test-key"]
        config.OPENAI_API_CONFIGS = {"0": {}}

    def _mock_models_and_provider(
        self,
        monkeypatch: MonkeyPatch,
        response: FakeAiohttpResponse,
    ) -> None:
        import open_webui.routers.openai as openai_router
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)

        async def fake_get_all_models(request: _RequestWithApp, user: object) -> dict[str, object]:
            request.app.state.OPENAI_MODELS = {
                self.model_id: {
                    "id": self.model_id,
                    "name": self.model_id,
                    "owned_by": "openai",
                    "openai": {"id": self.model_id},
                    "connection_type": "external",
                    "urlIdx": 0,
                }
            }
            return {"data": list(request.app.state.OPENAI_MODELS.values())}

        fake_session = FakeAiohttpSession(response)
        monkeypatch.setattr(openai_router, "get_all_models", fake_get_all_models)
        monkeypatch.setattr(openai_router.aiohttp, "ClientSession", lambda *_, **__: fake_session)

    def test_streaming_with_usage_settles_charge(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import RateCards, Wallets
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        request_id = f"req_{uuid.uuid4()}"

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        usage = {"prompt_tokens": 1000, "completion_tokens": 400, "total_tokens": 1400}
        chunks = [
            b"data: " + json.dumps({"choices": [{"delta": {"content": "hi"}}]}).encode() + b"\n\n",
            b"data: " + json.dumps({"usage": usage}).encode() + b"\n\n",
            b"data: [DONE]\n\n",
        ]

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "text/event-stream"},
            content=FakeAiohttpStream(chunks),
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 500,
            "stream": True,
            "metadata": {"request_id": request_id},
        }

        with mock_webui_user(id="1"):
            with self.fast_api_client.stream(
                "POST", self.create_url("/chat/completions"), json=payload
            ) as response:
                assert response.status_code == 200
                for _ in response.iter_bytes():
                    pass

        usage_event = get_usage_event(request_id)
        assert usage_event is not None

        rate_in = RateCards.get_rate_card_by_id(usage_event.pricing_rate_card_input_id)
        rate_out = RateCards.get_rate_card_by_id(usage_event.pricing_rate_card_output_id)
        assert rate_in is not None
        assert rate_out is not None

        expected_input = PricingService().calculate_cost_kopeks(
            Decimal(usage["prompt_tokens"]) / Decimal(1000), rate_in, 0
        )
        expected_output = PricingService().calculate_cost_kopeks(
            Decimal(usage["completion_tokens"]) / Decimal(1000), rate_out, 0
        )
        expected_charge = expected_input + expected_output

        assert usage_event.cost_charged_kopeks == expected_charge
        assert_wallet_topup_balance(wallet.id, 100000 - expected_charge)

    def test_streaming_without_usage_marks_estimated(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        request_id = f"req_{uuid.uuid4()}"

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        chunks = [
            b"data: " + json.dumps({"choices": [{"delta": {"content": "hi"}}]}).encode() + b"\n\n",
            b"data: [DONE]\n\n",
        ]

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "text/event-stream"},
            content=FakeAiohttpStream(chunks),
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
            "stream": True,
            "metadata": {"request_id": request_id},
        }

        with mock_webui_user(id="1"):
            with self.fast_api_client.stream(
                "POST", self.create_url("/chat/completions"), json=payload
            ) as response:
                assert response.status_code == 200
                for _ in response.iter_bytes():
                    pass

        usage_event = get_usage_event(request_id)
        assert usage_event is not None
        assert usage_event.is_estimated is True
        assert usage_event.estimate_reason == "usage_missing"
        assert usage_event.cost_charged_kopeks > 0

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 100000 - usage_event.cost_charged_kopeks
