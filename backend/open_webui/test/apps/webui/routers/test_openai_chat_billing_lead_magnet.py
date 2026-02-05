import time
import uuid
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


class TestOpenAIChatBillingLeadMagnet(AbstractPostgresTest):
    BASE_PATH = "/openai"

    def setup_method(self) -> None:
        super().setup_method()

        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.model_id = "test-openai-chat-lead-magnet"
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
                name="Lead magnet billing model",
                base_model_id=None,
                meta=ModelMeta(lead_magnet=True),
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

    def _configure_lead_magnet(
        self,
        monkeypatch: MonkeyPatch,
        enabled: bool,
        quotas: dict[str, int],
        cycle_days: int = 30,
        config_version: int = 1,
    ) -> None:
        from open_webui.config import (
            LEAD_MAGNET_CONFIG_VERSION,
            LEAD_MAGNET_CYCLE_DAYS,
            LEAD_MAGNET_ENABLED,
            LEAD_MAGNET_QUOTAS,
        )

        monkeypatch.setattr(LEAD_MAGNET_ENABLED, "value", enabled)
        monkeypatch.setattr(LEAD_MAGNET_CYCLE_DAYS, "value", cycle_days)
        monkeypatch.setattr(LEAD_MAGNET_QUOTAS, "value", quotas)
        monkeypatch.setattr(LEAD_MAGNET_CONFIG_VERSION, "value", config_version)

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

    def test_lead_magnet_allowed_does_not_charge_wallet(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import LeadMagnetStates, LedgerEntryType, Wallets
        from open_webui.utils.wallet import wallet_service

        quotas = {
            "tokens_input": 5000,
            "tokens_output": 5000,
            "images": 0,
            "tts_seconds": 0,
            "stt_seconds": 0,
        }
        self._configure_lead_magnet(monkeypatch, enabled=True, quotas=quotas, config_version=7)

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0, "balance_included_kopeks": 0})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={
                "id": "chatcmpl_lm_1",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}}],
                "usage": {"prompt_tokens": 1200, "completion_tokens": 800, "total_tokens": 2000},
            },
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/chat/completions"),
                json={
                    "model": self.model_id,
                    "messages": [{"role": "user", "content": "hello"}],
                    "max_tokens": 500,
                    "metadata": {"request_id": self.request_id},
                },
            )

        assert response.status_code == 200

        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.HOLD) is None
        assert get_ledger_entry(self.request_id, "chat_completion", LedgerEntryType.CHARGE) is None

        usage_event = get_usage_event(self.request_id)
        assert usage_event is not None
        assert usage_event.billing_source == "lead_magnet"
        assert usage_event.cost_charged_kopeks == 0

        assert_wallet_topup_balance(wallet.id, 0)

        state = LeadMagnetStates.get_state_by_user("1")
        assert state is not None
        assert state.tokens_input_used == 1200
        assert state.tokens_output_used == 800
        assert state.config_version == 7

    def test_lead_magnet_exhausted_falls_back_to_payg_and_blocks_when_wallet_empty(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        quotas = {
            "tokens_input": 0,
            "tokens_output": 0,
            "images": 0,
            "tts_seconds": 0,
            "stt_seconds": 0,
        }
        self._configure_lead_magnet(monkeypatch, enabled=True, quotas=quotas, config_version=2)

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0, "balance_included_kopeks": 0})

        provider_response = FakeAiohttpResponse(
            status=200,
            headers={"Content-Type": "application/json"},
            json_payload={"usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}},
        )
        self._mock_models_and_provider(monkeypatch, provider_response)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/chat/completions"),
                json={
                    "model": self.model_id,
                    "messages": [{"role": "user", "content": "a" * 4000}],
                    "max_tokens": 500,
                    "metadata": {"request_id": f"req_{uuid.uuid4()}"},
                },
            )

        assert response.status_code == 402
        detail = response.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("error") == "insufficient_funds"
