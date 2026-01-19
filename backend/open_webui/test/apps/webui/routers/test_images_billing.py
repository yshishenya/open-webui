import base64
import time
from decimal import Decimal

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestImagesBilling(AbstractPostgresTest):
    BASE_PATH = "/api/v1/images"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards

        now = int(time.time())
        self.model_id = "test-image-model"

        rate_card = PricingRateCardModel(
            id="rate_image_1",
            model_id=self.model_id,
            model_tier=None,
            modality="image",
            unit="image_1024",
            raw_cost_per_unit_kopeks=500,
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

        RateCards.create_rate_card(rate_card.model_dump())

        config = self.fast_api_client.app.state.config
        config.ENABLE_IMAGE_GENERATION = True
        config.USER_PERMISSIONS["features"]["image_generation"] = True

    def test_image_generation_billing(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, RateCards, UsageEvent, Wallets
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.images as images_router
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)

        image_payload = base64.b64encode(b"fake-image").decode("utf-8")

        async def fake_comfyui_create_image(
            *args: object, **kwargs: object
        ) -> dict[str, list[dict[str, str]]]:
            return {
                "data": [
                    {"url": f"data:image/png;base64,{image_payload}"},
                    {"url": f"data:image/png;base64,{image_payload}"},
                ]
            }

        monkeypatch.setattr(
            images_router, "comfyui_create_image", fake_comfyui_create_image
        )

        config = self.fast_api_client.app.state.config
        config.IMAGE_GENERATION_ENGINE = "comfyui"
        config.IMAGE_GENERATION_MODEL = self.model_id
        config.COMFYUI_WORKFLOW = "{}"
        config.COMFYUI_WORKFLOW_NODES = []
        config.IMAGE_SIZE = "512x512"
        config.COMFYUI_BASE_URL = "http://localhost"
        config.COMFYUI_API_KEY = ""

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 20000})

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/generations"),
                json={"prompt": "test image", "n": 2},
            )

        assert response.status_code == 200
        assert len(response.json()) == 2

        rate_card = RateCards.get_rate_card_by_version(
            self.model_id, "image", "image_1024", "2025-01"
        )
        assert rate_card is not None

        expected_units = (
            Decimal(2) * Decimal(512 * 512) / Decimal(1024 * 1024)
        )
        expected_charge = PricingService().calculate_cost_kopeks(
            expected_units, rate_card, 0
        )

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 20000 - expected_charge

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.user_id == "1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        charge_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.user_id == "1",
                LedgerEntry.type == "charge",
            )
            .first()
        )
        assert charge_entry is not None

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.user_id == "1")
            .first()
        )
        assert usage_event is not None
        assert usage_event.modality == "image"
        assert usage_event.cost_charged_kopeks == expected_charge

    def test_image_generation_error_releases_hold(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.images as images_router
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)

        async def fake_comfyui_create_image(
            *args: object, **kwargs: object
        ) -> dict[str, list[dict[str, str]]]:
            raise RuntimeError("boom")

        monkeypatch.setattr(
            images_router, "comfyui_create_image", fake_comfyui_create_image
        )

        config = self.fast_api_client.app.state.config
        config.IMAGE_GENERATION_ENGINE = "comfyui"
        config.IMAGE_GENERATION_MODEL = self.model_id
        config.COMFYUI_WORKFLOW = "{}"
        config.COMFYUI_WORKFLOW_NODES = []
        config.IMAGE_SIZE = "512x512"
        config.COMFYUI_BASE_URL = "http://localhost"
        config.COMFYUI_API_KEY = ""

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 20000})

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/generations"),
                json={"prompt": "fail image", "n": 1},
            )

        assert response.status_code == 400

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 20000

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.user_id == "1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        release_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.user_id == "1",
                LedgerEntry.type == "release",
            )
            .first()
        )
        assert release_entry is not None
