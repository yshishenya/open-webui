import time
import uuid
from decimal import Decimal

import pytest

from test.util.abstract_integration_test import AbstractPostgresTest


class TestLeadMagnetBilling(AbstractPostgresTest):
    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models

        now = int(time.time())
        self.model_id = "lead-magnet-model"

        rate_in = PricingRateCardModel(
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
        )
        rate_out = PricingRateCardModel(
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
        )
        tts_rate = PricingRateCardModel(
            id=str(uuid.uuid4()),
            model_id=self.model_id,
            model_tier=None,
            modality="tts",
            unit="tts_char",
            raw_cost_per_unit_kopeks=2,
            version="2025-01",
            created_at=now,
            provider=None,
            is_default=True,
            is_active=True,
        )

        RateCards.create_rate_card(rate_in.model_dump())
        RateCards.create_rate_card(rate_out.model_dump())
        RateCards.create_rate_card(tts_rate.model_dump())

        model_form = ModelForm(
            id=self.model_id,
            name="Lead Magnet",
            base_model_id=None,
            meta=ModelMeta(lead_magnet=True),
            params=ModelParams(),
            access_control=None,
            is_active=True,
        )
        Models.insert_new_model(model_form, user_id="admin")

    def _configure_lead_magnet(self, monkeypatch, quotas):
        from open_webui.config import (
            LEAD_MAGNET_CONFIG_VERSION,
            LEAD_MAGNET_CYCLE_DAYS,
            LEAD_MAGNET_ENABLED,
            LEAD_MAGNET_QUOTAS,
        )

        monkeypatch.setattr(LEAD_MAGNET_ENABLED, "value", True)
        monkeypatch.setattr(LEAD_MAGNET_CYCLE_DAYS, "value", 30)
        monkeypatch.setattr(LEAD_MAGNET_QUOTAS, "value", quotas)
        monkeypatch.setattr(LEAD_MAGNET_CONFIG_VERSION, "value", 1)

    @pytest.mark.asyncio
    async def test_lead_magnet_text_skips_wallet_hold(self, monkeypatch):
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import BillingSource, LeadMagnetStates, UsageEvent
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.billing_integration import (
            preflight_estimate_hold,
            settle_billing_usage,
        )
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        self._configure_lead_magnet(
            monkeypatch,
            {
                "tokens_input": 10000,
                "tokens_output": 10000,
                "images": 0,
                "tts_seconds": 0,
                "stt_seconds": 0,
            },
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 10,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_lead_text",
        )

        assert billing_context is not None
        assert billing_context.billing_source == BillingSource.LEAD_MAGNET.value
        assert billing_context.hold_amount_kopeks == 0

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "req_lead_text",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is None

        usage_data = {
            "prompt_tokens": 25,
            "completion_tokens": 12,
            "total_tokens": 37,
        }

        await settle_billing_usage(
            billing_context=billing_context,
            usage_data=usage_data,
            chat_id="chat_1",
            message_id="msg_1",
        )

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "req_lead_text")
            .first()
        )
        assert usage_event is not None
        assert usage_event.billing_source == BillingSource.LEAD_MAGNET.value
        assert usage_event.cost_charged_kopeks == 0

        state = LeadMagnetStates.get_state_by_user("1")
        assert state is not None
        assert state.tokens_input_used == 25
        assert state.tokens_output_used == 12

    @pytest.mark.asyncio
    async def test_lead_magnet_falls_back_to_payg(self, monkeypatch):
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import BillingSource, LedgerEntry, Wallets
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        self._configure_lead_magnet(
            monkeypatch,
            {
                "tokens_input": 1,
                "tokens_output": 1,
                "images": 0,
                "tts_seconds": 0,
                "stt_seconds": 0,
            },
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 10,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_payg_fallback",
        )

        assert billing_context is not None
        assert billing_context.billing_source == BillingSource.PAYG.value
        assert billing_context.hold_amount_kopeks > 0

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "req_payg_fallback",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

    @pytest.mark.asyncio
    async def test_lead_magnet_tts_consumes_quota(self, monkeypatch):
        from open_webui.models.billing import BillingSource, LeadMagnetStates, Wallets
        from open_webui.utils.billing_integration import (
            preflight_single_rate_hold,
            settle_single_rate_usage,
        )
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing_integration as billing_integration

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        self._configure_lead_magnet(
            monkeypatch,
            {
                "tokens_input": 0,
                "tokens_output": 0,
                "images": 0,
                "tts_seconds": 60,
                "stt_seconds": 0,
            },
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 5000})

        units = Decimal("120")
        billing_context = await preflight_single_rate_hold(
            user_id="1",
            model_id=self.model_id,
            modality="tts",
            unit="tts_char",
            units=units,
            request_id="req_lead_tts",
            lead_magnet_requirements={"tts_seconds": 8},
        )

        assert billing_context is not None
        assert billing_context.billing_source == BillingSource.LEAD_MAGNET.value
        assert billing_context.hold_amount_kopeks == 0

        measured_units = {
            "char_count": 120,
            "unit": "tts_char",
            "units": float(units),
            "tts_seconds": 8,
        }

        await settle_single_rate_usage(
            billing_context=billing_context,
            measured_units=measured_units,
            units=units,
        )

        state = LeadMagnetStates.get_state_by_user("1")
        assert state is not None
        assert state.tts_seconds_used == 8
