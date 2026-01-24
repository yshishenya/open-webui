import time
import uuid
from decimal import Decimal

import pytest

from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingIntegration(AbstractPostgresTest):
    def setup_method(self):
        super().setup_method()
        from open_webui.models.billing import PricingRateCardModel, RateCards

        now = int(time.time())
        self.model_id = "test-model"

        rate_in = PricingRateCardModel(
            id=str(uuid.uuid4()),
            model_id=self.model_id,
            model_tier=None,
            modality="text",
            unit="token_in",
            raw_cost_per_unit_kopeks=100,
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
            version="2025-01",
            effective_from=now,
            effective_to=None,
            provider=None,
            is_default=True,
            is_active=True,
        )
        image_rate = PricingRateCardModel(
            id=str(uuid.uuid4()),
            model_id=self.model_id,
            model_tier=None,
            modality="image",
            unit="image_1024",
            raw_cost_per_unit_kopeks=500,
            version="2025-01",
            effective_from=now,
            effective_to=None,
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
            effective_from=now,
            effective_to=None,
            provider=None,
            is_default=True,
            is_active=True,
        )

        RateCards.create_rate_card(rate_in.model_dump())
        RateCards.create_rate_card(rate_out.model_dump())
        RateCards.create_rate_card(image_rate.model_dump())
        RateCards.create_rate_card(tts_rate.model_dump())

    @pytest.mark.asyncio
    async def test_hold_and_settle_creates_usage_event(self, monkeypatch):
        from open_webui.models.billing import LedgerEntry, UsageEvent, Wallets
        from open_webui.utils.billing_integration import (
            preflight_estimate_hold,
            settle_billing_usage,
        )
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_1",
        )

        assert billing_context is not None

        from open_webui.internal.db import ScopedSession as Session

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "req_1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        usage_data = {
            "prompt_tokens": 1000,
            "completion_tokens": 400,
            "total_tokens": 1400,
        }

        await settle_billing_usage(
            billing_context=billing_context,
            usage_data=usage_data,
            chat_id="chat_1",
            message_id="msg_1",
        )

        pricing_service = PricingService()
        expected_input_charge = pricing_service.calculate_cost_kopeks(
            Decimal(1000) / Decimal(1000),
            billing_context.rate_in,
            0,
        )
        expected_output_charge = pricing_service.calculate_cost_kopeks(
            Decimal(400) / Decimal(1000),
            billing_context.rate_out,
            0,
        )
        expected_charge = expected_input_charge + expected_output_charge

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 10000 - expected_charge
        assert updated_wallet.daily_spent_kopeks == expected_charge

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "req_1")
            .first()
        )
        assert usage_event is not None
        assert usage_event.cost_charged_kopeks == expected_charge
        assert usage_event.cost_charged_input_kopeks == expected_input_charge
        assert usage_event.cost_charged_output_kopeks == expected_output_charge
        assert usage_event.prompt_tokens == 1000
        assert usage_event.completion_tokens == 400
        assert usage_event.pricing_rate_card_input_id == billing_context.rate_in.id
        assert usage_event.pricing_rate_card_output_id == billing_context.rate_out.id

    @pytest.mark.asyncio
    async def test_settle_billing_usage_marks_estimated(self, monkeypatch):
        from open_webui.models.billing import UsageEvent, Wallets
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.utils.billing_integration import (
            preflight_estimate_hold,
            settle_billing_usage,
        )
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_estimated",
        )

        assert billing_context is not None

        await settle_billing_usage(
            billing_context=billing_context,
            usage_data=None,
            chat_id="chat_1",
            message_id="msg_1",
        )

        pricing_service = PricingService()
        expected_input_charge = pricing_service.calculate_cost_kopeks(
            Decimal(billing_context.estimated_prompt_tokens) / Decimal(1000),
            billing_context.rate_in,
            0,
        )
        expected_output_charge = pricing_service.calculate_cost_kopeks(
            Decimal(billing_context.estimated_max_output_tokens) / Decimal(1000),
            billing_context.rate_out,
            0,
        )
        expected_charge = expected_input_charge + expected_output_charge

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "req_estimated")
            .first()
        )
        assert usage_event is not None
        assert usage_event.is_estimated is True
        assert usage_event.estimate_reason == "usage_missing"
        assert usage_event.cost_charged_kopeks == expected_charge
        assert usage_event.cost_charged_input_kopeks == expected_input_charge
        assert usage_event.cost_charged_output_kopeks == expected_output_charge

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 10000 - expected_charge

    @pytest.mark.asyncio
    async def test_text_preflight_missing_rate_card(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        from open_webui.models.billing import Wallets

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 10,
        }

        with pytest.raises(HTTPException) as exc:
            await preflight_estimate_hold(
                user_id="1",
                model_id="missing-text-model",
                payload=payload,
            )

        assert exc.value.status_code == 422
        assert exc.value.detail == {"error": "modality_disabled"}
 
    @pytest.mark.asyncio
    async def test_text_preflight_insufficient_funds(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        from open_webui.models.billing import Wallets

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0})

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        with pytest.raises(HTTPException) as exc:
            await preflight_estimate_hold(
                user_id="1",
                model_id=self.model_id,
                payload=payload,
            )

        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_text_preflight_insufficient_funds_includes_auto_topup(
        self, monkeypatch
    ):
        from fastapi import HTTPException
        from open_webui.models.billing import Wallets
        from open_webui.utils.billing import AutoTopupResult
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing_integration as billing_integration

        async def fake_auto_topup(
            user_id: str,
            wallet_id: str,
            available_kopeks: int,
            required_kopeks: int,
            reason: str,
        ) -> AutoTopupResult:
            return AutoTopupResult(
                attempted=True,
                status="created",
                payment_id="pay_auto",
            )

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(
            billing_integration.billing_service,
            "maybe_trigger_auto_topup",
            fake_auto_topup,
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "balance_topup_kopeks": 0,
                "balance_included_kopeks": 0,
                "auto_topup_enabled": True,
            },
        )

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        with pytest.raises(HTTPException) as exc:
            await preflight_estimate_hold(
                user_id="1",
                model_id=self.model_id,
                payload=payload,
            )

        assert exc.value.status_code == 402
        assert exc.value.detail["error"] == "insufficient_funds"
        assert exc.value.detail["auto_topup_status"] == "created"
        assert exc.value.detail["auto_topup_payment_id"] == "pay_auto"

    @pytest.mark.asyncio
    async def test_text_preflight_daily_cap_exceeded(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        from open_webui.models.billing import Wallets

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        now = int(time.time())
        Wallets.update_wallet(
            wallet.id,
            {
                "balance_topup_kopeks": 10000,
                "daily_cap_kopeks": 100,
                "daily_spent_kopeks": 90,
                "daily_reset_at": now + 3600,
            },
        )

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        with pytest.raises(HTTPException) as exc:
            await preflight_estimate_hold(
                user_id="1",
                model_id=self.model_id,
                payload=payload,
            )

        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_text_preflight_max_reply_cost_exceeded(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_estimate_hold
        from open_webui.utils.wallet import wallet_service
        from open_webui.models.billing import Wallets

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_topup_kopeks": 10000, "max_reply_cost_kopeks": 10},
        )

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        with pytest.raises(HTTPException) as exc:
            await preflight_estimate_hold(
                user_id="1",
                model_id=self.model_id,
                payload=payload,
            )

        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_release_billing_hold_restores_balance(self, monkeypatch):
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.billing_integration import (
            preflight_estimate_hold,
            release_billing_hold,
        )
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 10000})

        payload = {
            "messages": [{"role": "user", "content": "a" * 4000}],
            "max_tokens": 500,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_release",
        )

        assert billing_context is not None

        await release_billing_hold(billing_context)

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "req_release",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        release_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "req_release",
                LedgerEntry.type == "release",
            )
            .first()
        )
        assert release_entry is not None

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 10000

    @pytest.mark.asyncio
    async def test_single_rate_image_hold_and_settle(self, monkeypatch):
        from open_webui.models.billing import LedgerEntry, UsageEvent, Wallets
        from open_webui.utils.billing_integration import (
            preflight_single_rate_hold,
            settle_single_rate_usage,
        )
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 20000})

        units = Decimal("2.0")
        billing_context = await preflight_single_rate_hold(
            user_id="1",
            model_id=self.model_id,
            modality="image",
            unit="image_1024",
            units=units,
            request_id="img_req_1",
        )

        assert billing_context is not None

        from open_webui.internal.db import ScopedSession as Session

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "img_req_1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        measured_units = {
            "count": 2,
            "unit": "image_1024",
            "units": float(units),
        }

        await settle_single_rate_usage(
            billing_context=billing_context,
            measured_units=measured_units,
            units=units,
        )

        pricing_service = PricingService()
        expected_charge = pricing_service.calculate_cost_kopeks(
            units, billing_context.rate_card, 0
        )

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 20000 - expected_charge
        assert updated_wallet.daily_spent_kopeks == expected_charge

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "img_req_1")
            .first()
        )
        assert usage_event is not None
        assert usage_event.cost_charged_kopeks == expected_charge
        assert usage_event.modality == "image"

    @pytest.mark.asyncio
    async def test_single_rate_tts_hold_and_settle(self, monkeypatch):
        from open_webui.models.billing import LedgerEntry, UsageEvent, Wallets
        from open_webui.utils.billing_integration import (
            preflight_single_rate_hold,
            settle_single_rate_usage,
        )
        from open_webui.utils.pricing import PricingService
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
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
            request_id="tts_req_1",
        )

        assert billing_context is not None

        from open_webui.internal.db import ScopedSession as Session

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "tts_req_1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        measured_units = {
            "char_count": 120,
            "unit": "tts_char",
            "units": float(units),
        }

        await settle_single_rate_usage(
            billing_context=billing_context,
            measured_units=measured_units,
            units=units,
        )

        pricing_service = PricingService()
        expected_charge = pricing_service.calculate_cost_kopeks(
            units, billing_context.rate_card, 0
        )

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 5000 - expected_charge
        assert updated_wallet.daily_spent_kopeks == expected_charge

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "tts_req_1")
            .first()
        )
        assert usage_event is not None
        assert usage_event.cost_charged_kopeks == expected_charge
        assert usage_event.modality == "tts"

    @pytest.mark.asyncio
    async def test_text_settle_charge_exceeds_hold_marks_estimated(self, monkeypatch):
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import UsageEvent, Wallets
        from open_webui.utils.billing_integration import (
            preflight_estimate_hold,
            settle_billing_usage,
        )
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        payload = {
            "messages": [{"role": "user", "content": "a" * 100}],
            "max_tokens": 10,
        }

        billing_context = await preflight_estimate_hold(
            user_id="1",
            model_id=self.model_id,
            payload=payload,
            request_id="req_exceed_hold",
        )

        assert billing_context is not None
        assert billing_context.hold_amount_kopeks > 0

        usage_data = {
            "prompt_tokens": 10000,
            "completion_tokens": 10000,
            "total_tokens": 20000,
        }

        await settle_billing_usage(
            billing_context=billing_context,
            usage_data=usage_data,
            chat_id="chat_1",
            message_id="msg_1",
        )

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "req_exceed_hold")
            .first()
        )
        assert usage_event is not None
        assert usage_event.is_estimated is True
        assert usage_event.estimate_reason == "charge_exceeds_hold"
        assert usage_event.cost_charged_kopeks == billing_context.hold_amount_kopeks
        assert (
            (usage_event.cost_charged_input_kopeks or 0)
            + (usage_event.cost_charged_output_kopeks or 0)
        ) == billing_context.hold_amount_kopeks

    @pytest.mark.asyncio
    async def test_single_rate_settle_charge_exceeds_hold_marks_estimated(
        self, monkeypatch
    ):
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import UsageEvent, Wallets
        from open_webui.utils.billing_integration import (
            preflight_single_rate_hold,
            settle_single_rate_usage,
        )
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 100000})

        billing_context = await preflight_single_rate_hold(
            user_id="1",
            model_id=self.model_id,
            modality="image",
            unit="image_1024",
            units=Decimal(1),
            request_id="img_exceed_hold",
        )

        assert billing_context is not None
        assert billing_context.hold_amount_kopeks > 0

        await settle_single_rate_usage(
            billing_context=billing_context,
            measured_units={"units": 2.0, "unit": "image_1024"},
            units=Decimal(2),
        )

        usage_event = (
            Session.query(UsageEvent)
            .filter(UsageEvent.request_id == "img_exceed_hold")
            .first()
        )
        assert usage_event is not None
        assert usage_event.is_estimated is True
        assert usage_event.estimate_reason == "charge_exceeds_hold"
        assert usage_event.cost_charged_kopeks == billing_context.hold_amount_kopeks

    @pytest.mark.asyncio
    async def test_single_rate_hold_rejects_invalid_units(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet_service.get_or_create_wallet("1", "RUB")

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id=self.model_id,
                modality="tts",
                unit="tts_char",
                units=Decimal(0),
            )

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_single_rate_hold_missing_rate_card(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        from open_webui.models.billing import Wallets

        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 1000})

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id="missing-model",
                modality="image",
                unit="image_1024",
                units=Decimal(1),
            )

        assert exc.value.status_code == 422
        assert exc.value.detail == {"error": "modality_disabled"}
 
    @pytest.mark.asyncio
    async def test_single_rate_hold_insufficient_funds(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        from open_webui.models.billing import Wallets

        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0})

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id=self.model_id,
                modality="image",
                unit="image_1024",
                units=Decimal(1),
            )

        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_single_rate_hold_insufficient_funds_includes_pending_auto_topup(
        self, monkeypatch
    ):
        from fastapi import HTTPException
        from open_webui.models.billing import Wallets
        from open_webui.utils.billing import AutoTopupResult
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing_integration as billing_integration

        async def fake_auto_topup(
            user_id: str,
            wallet_id: str,
            available_kopeks: int,
            required_kopeks: int,
            reason: str,
        ) -> AutoTopupResult:
            return AutoTopupResult(attempted=False, status="pending")

        monkeypatch.setattr(billing_integration, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(
            billing_integration.billing_service,
            "maybe_trigger_auto_topup",
            fake_auto_topup,
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "balance_topup_kopeks": 0,
                "balance_included_kopeks": 0,
                "auto_topup_enabled": True,
            },
        )

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id=self.model_id,
                modality="image",
                unit="image_1024",
                units=Decimal(1),
            )

        assert exc.value.status_code == 402
        assert exc.value.detail["error"] == "insufficient_funds"
        assert exc.value.detail["auto_topup_status"] == "pending"
        assert "auto_topup_payment_id" not in exc.value.detail

    @pytest.mark.asyncio
    async def test_single_rate_hold_daily_cap_exceeded(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        from open_webui.models.billing import Wallets

        now = int(time.time())
        Wallets.update_wallet(
            wallet.id,
            {
                "balance_topup_kopeks": 10000,
                "daily_cap_kopeks": 100,
                "daily_spent_kopeks": 90,
                "daily_reset_at": now + 3600,
            },
        )

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id=self.model_id,
                modality="image",
                unit="image_1024",
                units=Decimal(1),
            )

        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_single_rate_hold_max_reply_cost_exceeded(self, monkeypatch):
        from fastapi import HTTPException
        from open_webui.utils.billing_integration import preflight_single_rate_hold
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        from open_webui.models.billing import Wallets

        Wallets.update_wallet(
            wallet.id,
            {"balance_topup_kopeks": 10000, "max_reply_cost_kopeks": 10},
        )

        with pytest.raises(HTTPException) as exc:
            await preflight_single_rate_hold(
                user_id="1",
                model_id=self.model_id,
                modality="tts",
                unit="tts_char",
                units=Decimal(10),
            )

        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_single_rate_release_hold_restores_balance(self, monkeypatch):
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.billing_integration import (
            preflight_single_rate_hold,
            release_single_rate_hold,
            IMAGE_HOLD_REFERENCE,
        )
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(
            "open_webui.utils.billing_integration.ENABLE_BILLING_WALLET", True
        )

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 1000})

        billing_context = await preflight_single_rate_hold(
            user_id="1",
            model_id=self.model_id,
            modality="image",
            unit="image_1024",
            units=Decimal(1),
            request_id="img_release_1",
        )

        assert billing_context is not None

        from open_webui.internal.db import ScopedSession as Session

        hold_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "img_release_1",
                LedgerEntry.type == "hold",
            )
            .first()
        )
        assert hold_entry is not None

        await release_single_rate_hold(
            billing_context=billing_context,
            reference_type=IMAGE_HOLD_REFERENCE,
        )

        release_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "img_release_1",
                LedgerEntry.type == "release",
            )
            .first()
        )
        assert release_entry is not None

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 1000
