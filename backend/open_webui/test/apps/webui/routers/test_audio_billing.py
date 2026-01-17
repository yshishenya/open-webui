import time
from decimal import Decimal
from typing import Optional

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class FakeResponse:
    status: int = 200

    def raise_for_status(self) -> None:
        return None

    async def read(self) -> bytes:
        return b"audio-bytes"

    async def json(self) -> dict[str, object]:
        return {}


class FakeSession:
    def __init__(self, *args: object, **kwargs: object) -> None:
        return None

    async def __aenter__(self) -> "FakeSession":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc: Optional[BaseException],
        tb: Optional[object],
    ) -> None:
        return None

    async def post(self, *args: object, **kwargs: object) -> FakeResponse:
        return FakeResponse()


class FakeFailSession(FakeSession):
    async def post(self, *args: object, **kwargs: object) -> FakeResponse:
        raise RuntimeError("boom")


class TestAudioBilling(AbstractPostgresTest):
    BASE_PATH = "/api/v1/audio"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards

        now = int(time.time())
        self.model_id = "test-tts-model"

        rate_card = PricingRateCardModel(
            id="rate_tts_1",
            model_id=self.model_id,
            model_tier=None,
            modality="tts",
            unit="tts_char",
            raw_cost_per_unit_kopeks=2,
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

    def test_tts_speech_billing(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import Session
        from open_webui.models.billing import LedgerEntry, RateCards, UsageEvent, Wallets
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.audio as audio_router
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(audio_router.aiohttp, "ClientSession", FakeSession)

        config = self.fast_api_client.app.state.config
        config.TTS_ENGINE = "openai"
        config.TTS_MODEL = self.model_id
        config.TTS_OPENAI_API_BASE_URL = "https://example.com"
        config.TTS_OPENAI_API_KEY = "test-key"
        config.TTS_OPENAI_PARAMS = None

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 5000})

        payload = {"input": "hello", "voice": "alloy", "model": self.model_id}

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/speech"), json=payload)

        assert response.status_code == 200

        rate_card = RateCards.get_rate_card_by_version(
            self.model_id, "tts", "tts_char", "2025-01"
        )
        assert rate_card is not None

        expected_units = Decimal(len("hello"))
        expected_charge = PricingService().calculate_cost_kopeks(
            expected_units, rate_card, 0
        )

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 5000 - expected_charge

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
        assert usage_event.modality == "tts"
        assert usage_event.cost_charged_kopeks == expected_charge

    def test_tts_speech_error_releases_hold(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.audio as audio_router
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(audio_router.aiohttp, "ClientSession", FakeFailSession)

        config = self.fast_api_client.app.state.config
        config.TTS_ENGINE = "openai"
        config.TTS_MODEL = self.model_id
        config.TTS_OPENAI_API_BASE_URL = "https://example.com"
        config.TTS_OPENAI_API_KEY = "test-key"
        config.TTS_OPENAI_PARAMS = None

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 5000})

        payload = {"input": "boom", "voice": "alloy", "model": self.model_id}

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/speech"), json=payload)

        assert response.status_code == 500

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 5000

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
