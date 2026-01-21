import time
import uuid
from decimal import Decimal
from typing import Iterable

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class FakeStreamResponse:
    status_code: int = 200

    def raise_for_status(self) -> None:
        return None

    def iter_content(self, chunk_size: int = 8192) -> Iterable[bytes]:
        yield b"audio-bytes"

    def json(self) -> dict[str, object]:
        return {}


class TestOpenAISpeechBilling(AbstractPostgresTest):
    BASE_PATH = "/openai"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards

        now = int(time.time())
        self.model_id = "test-openai-tts"

        rate_card = PricingRateCardModel(
            id="rate_openai_tts_1",
            model_id=self.model_id,
            model_tier=None,
            modality="tts",
            unit="tts_char",
            raw_cost_per_unit_kopeks=2,
            version="2025-01",
            effective_from=now,
            effective_to=None,
            provider=None,
            is_default=True,
            is_active=True,
        )

        RateCards.create_rate_card(rate_card.model_dump())

    def test_openai_speech_billing(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, RateCards, UsageEvent, Wallets
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.openai as openai_router
        import open_webui.utils.billing_integration as billing_integration

        def fake_post(*args: object, **kwargs: object) -> FakeStreamResponse:
            return FakeStreamResponse()

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(openai_router.requests, "post", fake_post)

        config = self.fast_api_client.app.state.config
        config.OPENAI_API_BASE_URLS = ["https://api.openai.com/v1"]
        config.OPENAI_API_KEYS = ["test-key"]
        config.OPENAI_API_CONFIGS = {"0": {}}

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 5000})

        input_text = f"hello {uuid.uuid4()}"
        payload = {"model": self.model_id, "input": input_text, "voice": "alloy"}

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/audio/speech"),
                json=payload,
            )

        assert response.status_code == 200

        rate_card = RateCards.get_rate_card_by_version(
            self.model_id, "tts", "tts_char", "2025-01"
        )
        assert rate_card is not None

        expected_units = Decimal(len(input_text))
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

    def test_openai_speech_error_releases_hold(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service
        import open_webui.routers.openai as openai_router
        import open_webui.utils.billing_integration as billing_integration

        def fake_post(*args: object, **kwargs: object) -> FakeStreamResponse:
            raise RuntimeError("boom")

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(openai_router.requests, "post", fake_post)

        config = self.fast_api_client.app.state.config
        config.OPENAI_API_BASE_URLS = ["https://api.openai.com/v1"]
        config.OPENAI_API_KEYS = ["test-key"]
        config.OPENAI_API_CONFIGS = {"0": {}}

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 5000})

        input_text = f"boom {uuid.uuid4()}"
        payload = {"model": self.model_id, "input": input_text, "voice": "alloy"}

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/audio/speech"),
                json=payload,
            )

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
