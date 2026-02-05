import json
import time
import uuid
from decimal import Decimal
from typing import Protocol

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.billing_scenarios_matrix import (
    assert_wallet_topup_balance,
    get_ledger_entry,
    get_usage_event,
)
from test.util.mock_user import mock_webui_user
from test.util.openai_provider_fakes import FakeAiohttpResponse, FakeAiohttpSession


class _OpenAIState(Protocol):
    OPENAI_MODELS: dict[str, dict[str, object]]


class _AppWithState(Protocol):
    state: _OpenAIState


class _RequestWithApp(Protocol):
    app: _AppWithState


class TestOpenAIChatBilling(AbstractPostgresTest):
    BASE_PATH = "/openai"

    def setup_method(self) -> None:
        super().setup_method()

        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.model_id = "test-openai-chat-billing"
        self.request_id = f"req_{uuid.uuid4()}"

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
                name="Test Billing Chat Model",
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

    def test_payg_success_creates_hold_charge_usage_event(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import LedgerEntryType, Wallets
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={
                "id": "chatcmpl_1",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}}],
                "usage": {"prompt_tokens": 1000, "completion_tokens": 400, "total_tokens": 1400},
            },
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 500,
            "metadata": {"request_id": self.request_id},
        }

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/chat/completions"), json=payload)

        assert response.status_code == 200

        hold_entry = get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.HOLD)
        assert hold_entry is not None

        charge_entry = get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.CHARGE)
        assert charge_entry is not None

        usage_event = get_usage_event(self.request_id)
        assert usage_event is not None
        from open_webui.models.billing import RateCards

        rate_in = RateCards.get_rate_card_by_id(usage_event.pricing_rate_card_input_id)
        rate_out = RateCards.get_rate_card_by_id(usage_event.pricing_rate_card_output_id)
        assert rate_in is not None
        assert rate_out is not None

        pricing = PricingService()
        expected_input = pricing.calculate_cost_kopeks(
            Decimal(1000) / Decimal(1000), rate_in, 0
        )
        expected_output = pricing.calculate_cost_kopeks(
            Decimal(400) / Decimal(1000), rate_out, 0
        )
        expected_charge = expected_input + expected_output

        assert usage_event.cost_charged_kopeks == expected_charge
        assert_wallet_topup_balance(wallet.id, 100000 - expected_charge)

    def test_payg_insufficient_funds_returns_402(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import LedgerEntryType, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0, "balance_included_kopeks": 0})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={"usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}},
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
            "metadata": {"request_id": self.request_id},
        }

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/chat/completions"), json=payload)

        assert response.status_code == 402
        detail = response.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("error") == "insufficient_funds"

        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.HOLD) is None
        assert get_usage_event(self.request_id) is None

    def test_payg_limits_max_reply_and_daily_cap(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={"usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}},
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        with mock_webui_user(id="1"):
            too_low_max_reply = self.fast_api_client.post(
                self.create_url("/chat/completions"),
                json={
                    "model": self.model_id,
                    "messages": [{"role": "user", "content": "a" * 4000}],
                    "max_tokens": 500,
                    "metadata": {"request_id": f"req_{uuid.uuid4()}", "max_reply_cost_kopeks": 1},
                },
            )
        assert too_low_max_reply.status_code == 402
        detail = too_low_max_reply.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("error") == "max_reply_cost_exceeded"

        now = int(time.time())
        Wallets.update_wallet(
            wallet.id,
            {
                "daily_cap_kopeks": 100,
                "daily_spent_kopeks": 90,
                "daily_reset_at": now + 3600,
            },
        )

        with mock_webui_user(id="1"):
            daily_cap = self.fast_api_client.post(
                self.create_url("/chat/completions"),
                json={
                    "model": self.model_id,
                    "messages": [{"role": "user", "content": "a" * 4000}],
                    "max_tokens": 500,
                    "metadata": {"request_id": f"req_{uuid.uuid4()}"},
                },
            )
        assert daily_cap.status_code == 429
        detail = daily_cap.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("error") == "daily_cap_exceeded"

    def test_provider_error_releases_hold_and_restores_balance(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import LedgerEntryType, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

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

        class FailSession:
            async def request(self, *args: object, **kwargs: object) -> FakeAiohttpResponse:
                raise RuntimeError("boom")

            async def close(self) -> None:
                return None

        monkeypatch.setattr(openai_router, "get_all_models", fake_get_all_models)
        monkeypatch.setattr(openai_router.aiohttp, "ClientSession", lambda *_, **__: FailSession())

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
            "metadata": {"request_id": self.request_id},
        }

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/chat/completions"), json=payload)

        assert response.status_code == 500

        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.HOLD) is not None
        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.RELEASE) is not None
        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.CHARGE) is None
        assert_wallet_topup_balance(wallet.id, 100000)

    def test_balance_depleted_then_topup_then_success(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0, "balance_included_kopeks": 0})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={
                "id": "chatcmpl_2",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
            },
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 50,
            "metadata": {"request_id": f"req_{uuid.uuid4()}"},
        }

        with mock_webui_user(id="1"):
            insufficient = self.fast_api_client.post(self.create_url("/chat/completions"), json=payload)
        assert insufficient.status_code == 402

        wallet_service.apply_topup(wallet.id, 100000, reference_id="topup_1", reference_type="test_topup")

        payload["metadata"]["request_id"] = f"req_{uuid.uuid4()}"
        with mock_webui_user(id="1"):
            ok = self.fast_api_client.post(self.create_url("/chat/completions"), json=payload)
        assert ok.status_code == 200
