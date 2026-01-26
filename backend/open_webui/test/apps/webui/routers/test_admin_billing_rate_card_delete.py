import time
import uuid

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestAdminBillingRateCardDelete(AbstractPostgresTest):
    BASE_PATH = "/api/v1/admin/billing"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards

        now = int(time.time())
        self.model_a = "rate-card-model-a"
        self.model_b = "rate-card-model-b"
        self.rate_cards_by_model = {self.model_a: [], self.model_b: []}

        for unit in ["token_in", "token_out"]:
            rate_card_id = str(uuid.uuid4())
            RateCards.create_rate_card(
                PricingRateCardModel(
                    id=rate_card_id,
                    model_id=self.model_a,
                    model_tier=None,
                    modality="text",
                    unit=unit,
                    raw_cost_per_unit_kopeks=100,
                    version="2025-01",
                    created_at=now,
                    provider="Test",
                    is_default=True,
                    is_active=True,
                ).model_dump()
            )
            self.rate_cards_by_model[self.model_a].append(rate_card_id)

        model_b_rate_card_id = str(uuid.uuid4())
        RateCards.create_rate_card(
            PricingRateCardModel(
                id=model_b_rate_card_id,
                model_id=self.model_b,
                model_tier=None,
                modality="image",
                unit="image_1024",
                raw_cost_per_unit_kopeks=250,
                version="2025-01",
                created_at=now,
                provider="Test",
                is_default=True,
                is_active=True,
            ).model_dump()
        )
        self.rate_cards_by_model[self.model_b].append(model_b_rate_card_id)
        self.all_rate_card_ids = (
            self.rate_cards_by_model[self.model_a] + self.rate_cards_by_model[self.model_b]
        )

    def test_delete_rate_card(self, monkeypatch) -> None:
        from open_webui.models.billing import RateCards
        from open_webui.routers import admin_billing_rate_card

        monkeypatch.setattr(admin_billing_rate_card, "ENABLE_BILLING_WALLET", True)

        target_id = self.all_rate_card_ids[0]
        with mock_webui_user(role="admin"):
            response = self.fast_api_client.delete(
                self.create_url(f"/rate-card/{target_id}")
            )

        assert response.status_code == 200
        assert response.json() is True
        assert RateCards.get_rate_card_by_id(target_id) is None

    def test_bulk_delete_rate_cards(self, monkeypatch) -> None:
        from open_webui.models.billing import RateCards
        from open_webui.routers import admin_billing_rate_card

        monkeypatch.setattr(admin_billing_rate_card, "ENABLE_BILLING_WALLET", True)

        target_ids = self.all_rate_card_ids[1:]
        with mock_webui_user(role="admin"):
            response = self.fast_api_client.post(
                self.create_url("/rate-card/bulk-delete"),
                json={"rate_card_ids": target_ids},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["deleted"] == len(target_ids)
        for rate_card_id in target_ids:
            assert RateCards.get_rate_card_by_id(rate_card_id) is None

    def test_delete_rate_cards_by_model(self, monkeypatch) -> None:
        from open_webui.models.billing import RateCards
        from open_webui.routers import admin_billing_rate_card

        monkeypatch.setattr(admin_billing_rate_card, "ENABLE_BILLING_WALLET", True)

        target_model_ids = [self.model_b]
        with mock_webui_user(role="admin"):
            response = self.fast_api_client.post(
                self.create_url("/rate-card/delete-models"),
                json={"model_ids": target_model_ids},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["deleted"] == len(self.rate_cards_by_model[self.model_b])
        for rate_card_id in self.rate_cards_by_model[self.model_b]:
            assert RateCards.get_rate_card_by_id(rate_card_id) is None
