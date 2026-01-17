import time
import uuid

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingLeadMagnetRoutes(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.model_id = "lead-magnet-route-model"

        rate_in = PricingRateCardModel(
            id=str(uuid.uuid4()),
            model_id=self.model_id,
            model_tier=None,
            modality="text",
            unit="token_in",
            raw_cost_per_unit_kopeks=100,
            platform_factor=1.0,
            fixed_fee_kopeks=0,
            min_charge_kopeks=0,
            rounding_rules_json=None,
            version="2025-01",
            effective_from=now,
            effective_to=None,
            provider=None,
            is_default=True,
            is_active=True,
        )
        rate_out = PricingRateCardModel(
            id=str(uuid.uuid4()),
            model_id=self.model_id,
            model_tier=None,
            modality="text",
            unit="token_out",
            raw_cost_per_unit_kopeks=200,
            platform_factor=1.0,
            fixed_fee_kopeks=0,
            min_charge_kopeks=0,
            rounding_rules_json=None,
            version="2025-01",
            effective_from=now,
            effective_to=None,
            provider=None,
            is_default=True,
            is_active=True,
        )

        RateCards.create_rate_card(rate_in.model_dump())
        RateCards.create_rate_card(rate_out.model_dump())

        model_form = ModelForm(
            id=self.model_id,
            name="Lead Magnet Route",
            base_model_id=None,
            meta=ModelMeta(lead_magnet=True),
            params=ModelParams(),
            access_control=None,
            is_active=True,
        )
        Models.insert_new_model(model_form, user_id="admin")

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

    def test_lead_magnet_info_includes_cycle(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.utils.lead_magnet import evaluate_lead_magnet

        quotas = {
            "tokens_input": 500,
            "tokens_output": 500,
            "images": 0,
            "tts_seconds": 0,
            "stt_seconds": 0,
        }
        self._configure_lead_magnet(
            monkeypatch,
            enabled=True,
            quotas=quotas,
            config_version=3,
        )

        decision = evaluate_lead_magnet(
            user_id="1",
            model_id=self.model_id,
            requirements={"tokens_input": 1, "tokens_output": 1},
        )
        assert decision.allowed is True

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/lead-magnet"))

        assert response.status_code == 200
        payload = response.json()
        assert payload["enabled"] is True
        assert payload["cycle_start"] is not None
        assert payload["cycle_end"] is not None
        assert payload["usage"]["tokens_input"] == 0
        assert payload["usage"]["tokens_output"] == 0
        assert payload["remaining"]["tokens_input"] == quotas["tokens_input"]
        assert payload["remaining"]["tokens_output"] == quotas["tokens_output"]
        assert payload["config_version"] == 3

    def test_estimate_uses_lead_magnet(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import BillingSource
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        self._configure_lead_magnet(
            monkeypatch,
            enabled=True,
            quotas={
                "tokens_input": 10000,
                "tokens_output": 10000,
                "images": 0,
                "tts_seconds": 0,
                "stt_seconds": 0,
            },
            config_version=2,
        )

        payload = {
            "model_id": self.model_id,
            "modality": "text",
            "payload": {
                "messages": [{"role": "user", "content": "hello"}],
                "max_tokens": 10,
            },
        }

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/estimate"), json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["billing_source"] == BillingSource.LEAD_MAGNET.value
        assert data["is_allowed"] is True
        assert data["min_kopeks"] == 0
        assert data["max_kopeks"] == 0

    def test_usage_events_filters_lead_magnet(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import BillingSource, UsageEventModel, UsageEvents
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        now = int(time.time())

        lead_event = UsageEventModel(
            id=str(uuid.uuid4()),
            user_id="1",
            wallet_id=wallet.id,
            plan_id=None,
            subscription_id=None,
            chat_id=None,
            message_id=None,
            request_id="req_lm_1",
            model_id=self.model_id,
            modality="text",
            provider=None,
            measured_units_json={"prompt_tokens": 5, "completion_tokens": 7},
            prompt_tokens=5,
            completion_tokens=7,
            cost_raw_kopeks=0,
            cost_raw_input_kopeks=0,
            cost_raw_output_kopeks=0,
            cost_charged_kopeks=0,
            cost_charged_input_kopeks=0,
            cost_charged_output_kopeks=0,
            billing_source=BillingSource.LEAD_MAGNET.value,
            is_estimated=False,
            estimate_reason=None,
            pricing_version=None,
            pricing_rate_card_id=None,
            pricing_rate_card_input_id=None,
            pricing_rate_card_output_id=None,
            wallet_snapshot_json=None,
            created_at=now,
        )

        payg_event = UsageEventModel(
            id=str(uuid.uuid4()),
            user_id="1",
            wallet_id=wallet.id,
            plan_id=None,
            subscription_id=None,
            chat_id=None,
            message_id=None,
            request_id="req_payg_1",
            model_id=self.model_id,
            modality="text",
            provider=None,
            measured_units_json={"prompt_tokens": 3, "completion_tokens": 4},
            prompt_tokens=3,
            completion_tokens=4,
            cost_raw_kopeks=10,
            cost_raw_input_kopeks=5,
            cost_raw_output_kopeks=5,
            cost_charged_kopeks=10,
            cost_charged_input_kopeks=5,
            cost_charged_output_kopeks=5,
            billing_source=BillingSource.PAYG.value,
            is_estimated=False,
            estimate_reason=None,
            pricing_version=None,
            pricing_rate_card_id=None,
            pricing_rate_card_input_id=None,
            pricing_rate_card_output_id=None,
            wallet_snapshot_json=None,
            created_at=now,
        )

        UsageEvents.create_usage_event(lead_event)
        UsageEvents.create_usage_event(payg_event)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(
                self.create_url("/usage-events?billing_source=lead_magnet")
            )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["request_id"] == "req_lm_1"
        assert payload[0]["billing_source"] == BillingSource.LEAD_MAGNET.value
