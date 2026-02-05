import time
import uuid

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingPublicPricing(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.text_model_id = "pricing-public-text"
        self.audio_model_id = "pricing-public-audio"
        self.hidden_model_id = "pricing-hidden"
        self.private_model_id = "pricing-private"
        self.provider_only_model_id = "pricing-provider-only"

        Models.insert_new_model(
            ModelForm(
                id=self.text_model_id,
                name="Pricing Text",
                base_model_id=None,
                meta=ModelMeta(),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            user_id="admin",
        )

        Models.insert_new_model(
            ModelForm(
                id=self.audio_model_id,
                name="Pricing Audio",
                base_model_id=None,
                meta=ModelMeta(),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            user_id="admin",
        )

        Models.insert_new_model(
            ModelForm(
                id=self.hidden_model_id,
                name="Pricing Hidden",
                base_model_id=None,
                meta=ModelMeta(hidden=True),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            user_id="admin",
        )

        Models.insert_new_model(
            ModelForm(
                id=self.private_model_id,
                name="Pricing Private",
                base_model_id=None,
                meta=ModelMeta(),
                params=ModelParams(),
                access_control={},
                is_active=True,
            ),
            user_id="admin",
        )

        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.text_model_id,
                model_tier=None,
                modality="text",
                unit="token_in",
                raw_cost_per_unit_kopeks=100,
                version="2025-01",
                created_at=now,
                provider="Test",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.text_model_id,
                model_tier=None,
                modality="text",
                unit="token_out",
                raw_cost_per_unit_kopeks=200,
                version="2025-01",
                created_at=now,
                provider="Test",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.text_model_id,
                model_tier=None,
                modality="image",
                unit="image_1024",
                raw_cost_per_unit_kopeks=500,
                version="2025-01",
                created_at=now,
                provider="Test",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.provider_only_model_id,
                model_tier=None,
                modality="text",
                unit="token_in",
                raw_cost_per_unit_kopeks=300,
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
                model_id=self.audio_model_id,
                model_tier=None,
                modality="tts",
                unit="tts_char",
                raw_cost_per_unit_kopeks=2,
                version="2025-01",
                created_at=now,
                provider="Voice",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.audio_model_id,
                model_tier=None,
                modality="stt",
                unit="stt_second",
                raw_cost_per_unit_kopeks=3,
                version="2025-01",
                created_at=now,
                provider="Voice",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.hidden_model_id,
                model_tier=None,
                modality="text",
                unit="token_in",
                raw_cost_per_unit_kopeks=100,
                version="2025-01",
                created_at=now,
                provider="Hidden",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=str(uuid.uuid4()),
                model_id=self.private_model_id,
                model_tier=None,
                modality="text",
                unit="token_in",
                raw_cost_per_unit_kopeks=100,
                version="2025-01",
                created_at=now,
                provider="Private",
                is_default=True,
                is_active=True,
            ).model_dump()
        )

    def test_public_rate_cards_payload(self) -> None:
        response = self.fast_api_client.get(self.create_url("/public/rate-cards"))
        assert response.status_code == 200

        payload = response.json()
        assert payload["currency"] == "RUB"
        assert payload["updated_at"]
        assert payload["models"]

        model_ids = {model["id"] for model in payload["models"]}
        assert self.text_model_id in model_ids
        assert self.audio_model_id in model_ids
        assert self.hidden_model_id not in model_ids
        assert self.private_model_id not in model_ids

        text_model = next(
            model for model in payload["models"] if model["id"] == self.text_model_id
        )
        assert text_model["rates"]["text_in_1000_tokens"] is not None
        assert text_model["rates"]["text_out_1000_tokens"] is not None
        assert text_model["rates"]["image_1024"] is not None

    def test_public_pricing_config(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.config import LEAD_MAGNET_QUOTAS

        monkeypatch.setattr(billing_router, "BILLING_TOPUP_PACKAGES_KOPEKS", [100000, 150000])
        monkeypatch.setattr(billing_router, "PUBLIC_PRICING_POPULAR_MODELS", [self.text_model_id])
        monkeypatch.setattr(
            billing_router, "PUBLIC_PRICING_RECOMMENDED_TEXT_MODEL", self.text_model_id
        )
        monkeypatch.setattr(LEAD_MAGNET_QUOTAS, "value", {
            "tokens_input": 1000,
            "tokens_output": 2000,
            "images": 10,
            "tts_seconds": 120,
            "stt_seconds": 180
        })

        response = self.fast_api_client.get(self.create_url("/public/pricing-config"))
        assert response.status_code == 200

        payload = response.json()
        assert payload["topup_amounts_rub"] == [1000, 1500]
        assert payload["free_limits"]["text_in"] == 1000
        assert payload["free_limits"]["text_out"] == 2000
        assert payload["free_limits"]["images"] == 10
        assert payload["free_limits"]["tts_minutes"] == 2
        assert payload["free_limits"]["stt_minutes"] == 3
        assert payload["popular_model_ids"] == [self.text_model_id]
        assert payload["recommended_model_ids"]["text"] == self.text_model_id

    def test_list_rate_cards_by_model_ids(self) -> None:
        from open_webui.models.billing import RateCards

        entries = RateCards.list_rate_cards_by_model_ids([self.text_model_id])
        assert entries
        assert all(entry.model_id == self.text_model_id for entry in entries)
        assert not any(entry.model_id == self.audio_model_id for entry in entries)

    def test_public_rate_cards_provider_only_model(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        async def _mock_get_all_base_models(request):  # noqa: ARG001
            return [
                {
                    "id": self.provider_only_model_id,
                    "name": "Provider Only",
                    "owned_by": "openai",
                }
            ]

        monkeypatch.setattr(billing_router, "get_all_base_models", _mock_get_all_base_models)

        response = self.fast_api_client.get(self.create_url("/public/rate-cards"))
        assert response.status_code == 200

        payload = response.json()
        provider_only = next(
            model
            for model in payload["models"]
            if model["id"] == self.provider_only_model_id
        )
        assert provider_only["provider"] == "openai"
        assert provider_only["rates"]["text_in_1000_tokens"] is not None
