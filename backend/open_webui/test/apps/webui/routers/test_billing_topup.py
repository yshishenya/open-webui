import time
from decimal import Decimal
from typing import Optional

import pytest
from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingTopup(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def _ensure_user(
        self,
        user_id: str,
        email: str = "user@example.com",
        info: Optional[dict[str, object]] = None,
    ) -> None:
        from open_webui.models.users import Users

        if not Users.get_user_by_id(user_id):
            Users.insert_new_user(
                id=user_id,
                name=f"User {user_id}",
                email=email,
                role="user",
            )

        if info is not None:
            Users.update_user_by_id(user_id, {"info": info})

    def _mock_yookassa_get_payment(
        self,
        monkeypatch: MonkeyPatch,
        payment_id: str,
        status: str,
        metadata: dict[str, object],
        amount_value: str = "199.00",
        currency: str = "RUB",
        paid: bool = True,
    ) -> None:
        import open_webui.utils.billing as billing_utils

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                assert provider_payment_id == payment_id
                return {
                    "id": payment_id,
                    "status": status,
                    "paid": paid,
                    "amount": {"value": amount_value, "currency": currency},
                    "metadata": metadata,
                }

        fake_client = FakeYooKassaClient()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: fake_client)

    def test_topup_rejects_invalid_amount(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router
        import open_webui.utils.billing as billing_utils

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(billing_utils, "BILLING_TOPUP_PACKAGES_KOPEKS", [1000])

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/topup"),
                json={
                    "amount_kopeks": 2000,
                    "return_url": "https://example.com/return",
                },
            )

        assert response.status_code == 400
        assert "Invalid topup amount" in response.json()["detail"]

    def test_topup_maps_provider_auth_error(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.yookassa import YooKassaRequestError

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        async def fake_create_topup_payment(**_: object) -> dict[str, object]:
            raise YooKassaRequestError(
                "YooKassa request failed with status 401",
                status_code=401,
                response_text='{"type":"error","code":"invalid_credentials"}',
            )

        monkeypatch.setattr(
            billing_router.billing_service,
            "create_topup_payment",
            fake_create_topup_payment,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/topup"),
                json={
                    "amount_kopeks": 100000,
                    "return_url": "https://example.com/return",
                },
            )

        assert response.status_code == 502
        assert response.json()["detail"] == "Payment provider credentials are invalid"

    def test_topup_maps_provider_bad_request_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.yookassa import YooKassaRequestError

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        async def fake_create_topup_payment(**_: object) -> dict[str, object]:
            raise YooKassaRequestError(
                "YooKassa request failed with status 400",
                status_code=400,
                response_text='{"type":"error","code":"invalid_request"}',
            )

        monkeypatch.setattr(
            billing_router.billing_service,
            "create_topup_payment",
            fake_create_topup_payment,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/topup"),
                json={
                    "amount_kopeks": 100000,
                    "return_url": "https://example.com/return",
                },
            )

        assert response.status_code == 502
        assert (
            response.json()["detail"] == "Payment provider rejected the payment request"
        )

    def test_payment_maps_provider_auth_error(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.yookassa import YooKassaRequestError

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)

        async def fake_create_payment(**_: object) -> dict[str, object]:
            raise YooKassaRequestError(
                "YooKassa request failed with status 401",
                status_code=401,
                response_text='{"type":"error","code":"invalid_credentials"}',
            )

        monkeypatch.setattr(
            billing_router.billing_service,
            "create_payment",
            fake_create_payment,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/payment"),
                json={
                    "plan_id": "plan_basic",
                    "return_url": "https://example.com/return",
                },
            )

        assert response.status_code == 502
        assert response.json()["detail"] == "Payment provider credentials are invalid"

    def test_payment_maps_provider_bad_request_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.yookassa import YooKassaRequestError

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)

        async def fake_create_payment(**_: object) -> dict[str, object]:
            raise YooKassaRequestError(
                "YooKassa request failed with status 400",
                status_code=400,
                response_text='{"type":"error","code":"invalid_request"}',
            )

        monkeypatch.setattr(
            billing_router.billing_service,
            "create_payment",
            fake_create_payment,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/payment"),
                json={
                    "plan_id": "plan_basic",
                    "return_url": "https://example.com/return",
                },
            )

        assert response.status_code == 502
        assert (
            response.json()["detail"] == "Payment provider rejected the payment request"
        )

    @pytest.mark.asyncio
    async def test_create_subscription_payment_includes_receipt(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import PlanModel, Plans
        from open_webui.utils.billing import billing_service
        import open_webui.utils.billing as billing_utils

        self._ensure_user(
            user_id="receipt-sub",
            email="receipt-sub@example.com",
            info={"billing_contact_phone": "+79000000000"},
        )
        now = int(time.time())
        plan = Plans.create_plan(
            PlanModel(
                id="plan_receipt_sub",
                name="Receipt plan",
                price=199.0,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=1,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.last_receipt: Optional[dict[str, object]] = None

            async def create_payment(
                self,
                amount: Decimal,
                currency: str,
                description: str,
                return_url: str,
                metadata: dict[str, object],
                receipt: Optional[dict[str, object]] = None,
                payment_method_id: Optional[str] = None,
                save_payment_method: Optional[bool] = None,
            ) -> dict[str, object]:
                self.last_receipt = receipt
                return {
                    "id": "pay_sub_receipt",
                    "status": "pending",
                    "confirmation": {"confirmation_url": "https://example.com/confirm"},
                }

        fake_client = FakeYooKassaClient()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: fake_client)
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_ENABLED", True)
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_VAT_CODE", 1)
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_MODE",
            "full_payment",
        )
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_SUBJECT",
            "service",
        )
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_TAX_SYSTEM_CODE", None)

        result = await billing_service.create_payment(
            user_id="receipt-sub",
            plan_id=plan.id,
            return_url="https://example.com/return",
        )

        assert result["payment_id"] == "pay_sub_receipt"
        assert fake_client.last_receipt is not None
        customer = fake_client.last_receipt.get("customer")
        assert isinstance(customer, dict)
        assert customer.get("email") == "receipt-sub@example.com"
        assert customer.get("phone") == "+79000000000"
        items = fake_client.last_receipt.get("items")
        assert isinstance(items, list)
        assert len(items) == 1

    @pytest.mark.asyncio
    async def test_create_topup_payment_creates_payment_record(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import PaymentKind, PaymentStatus, Payments
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing as billing_utils

        self._ensure_user("1", email="topup-user@example.com")

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.last_amount: Optional[Decimal] = None
                self.last_metadata: Optional[dict[str, object]] = None
                self.last_payment_method_id: Optional[str] = None
                self.last_receipt: Optional[dict[str, object]] = None

            async def create_payment(
                self,
                amount: Decimal,
                currency: str,
                description: str,
                return_url: str,
                metadata: dict[str, object],
                receipt: Optional[dict[str, object]] = None,
                payment_method_id: Optional[str] = None,
                save_payment_method: Optional[bool] = None,
            ) -> dict[str, object]:
                self.last_amount = amount
                self.last_metadata = metadata
                self.last_payment_method_id = payment_method_id
                self.last_receipt = receipt
                return {
                    "id": "pay_stub",
                    "status": "pending",
                    "confirmation": {"confirmation_url": "https://example.com/confirm"},
                    "payment_method": {"id": "pm_1"},
                }

        fake_client = FakeYooKassaClient()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: fake_client)
        monkeypatch.setattr(billing_utils, "BILLING_TOPUP_PACKAGES_KOPEKS", [19900])
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_ENABLED", True)
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_VAT_CODE", 1)
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_MODE",
            "full_payment",
        )
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_SUBJECT",
            "service",
        )
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_TAX_SYSTEM_CODE", None)

        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        result = await billing_service.create_topup_payment(
            user_id="1",
            wallet_id=wallet.id,
            amount_kopeks=19900,
            return_url="https://example.com/return",
        )

        assert result["payment_id"] == "pay_stub"
        assert result["confirmation_url"] == "https://example.com/confirm"
        assert fake_client.last_amount == Decimal("199.00")
        assert isinstance(fake_client.last_metadata, dict)
        assert fake_client.last_metadata.get("wallet_id") == wallet.id
        assert isinstance(fake_client.last_receipt, dict)
        customer = fake_client.last_receipt.get("customer")
        assert isinstance(customer, dict)
        assert customer.get("email") == "topup-user@example.com"

        payment = Payments.get_payment_by_provider_id("pay_stub")
        assert payment is not None
        assert payment.kind == PaymentKind.TOPUP.value
        assert payment.status == PaymentStatus.PENDING.value
        assert payment.payment_method_id == "pm_1"

    @pytest.mark.asyncio
    async def test_auto_topup_creates_payment_with_saved_method(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing as billing_utils

        self._ensure_user("1", email="auto-topup-user@example.com")

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.last_payment_method_id: Optional[str] = None
                self.last_metadata: Optional[dict[str, object]] = None
                self.last_receipt: Optional[dict[str, object]] = None

            async def create_payment(
                self,
                amount: Decimal,
                currency: str,
                description: str,
                return_url: Optional[str] = None,
                metadata: Optional[dict[str, object]] = None,
                receipt: Optional[dict[str, object]] = None,
                payment_method_id: Optional[str] = None,
                save_payment_method: Optional[bool] = None,
            ) -> dict[str, object]:
                self.last_payment_method_id = payment_method_id
                self.last_metadata = metadata
                self.last_receipt = receipt
                return {
                    "id": "pay_auto",
                    "status": "pending",
                    "payment_method": {"id": payment_method_id},
                }

        fake_client = FakeYooKassaClient()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: fake_client)
        monkeypatch.setattr(billing_utils, "BILLING_TOPUP_PACKAGES_KOPEKS", [19900])
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_ENABLED", True)
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_VAT_CODE", 1)
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_MODE",
            "full_payment",
        )
        monkeypatch.setattr(
            billing_utils,
            "BILLING_RECEIPT_PAYMENT_SUBJECT",
            "service",
        )
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_TAX_SYSTEM_CODE", None)

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "auto_topup_enabled": True,
                "auto_topup_threshold_kopeks": 5000,
                "auto_topup_amount_kopeks": 19900,
            },
        )

        now = int(time.time())
        Payments.create_payment(
            PaymentModel(
                id="pm_saved",
                provider="yookassa",
                status=PaymentStatus.SUCCEEDED.value,
                kind=PaymentKind.TOPUP.value,
                amount_kopeks=19900,
                currency="RUB",
                idempotency_key="idem_saved",
                provider_payment_id="pay_saved",
                payment_method_id="pm_saved",
                status_details=None,
                metadata_json={
                    "kind": PaymentKind.TOPUP.value,
                    "user_id": "1",
                    "wallet_id": wallet.id,
                },
                raw_payload_json=None,
                user_id="1",
                wallet_id=wallet.id,
                subscription_id=None,
                created_at=now,
                updated_at=now,
            )
        )

        result = await billing_service.maybe_trigger_auto_topup(
            user_id="1",
            wallet_id=wallet.id,
            available_kopeks=1000,
            required_kopeks=2000,
            reason="balance_low",
        )

        assert result.attempted is True
        assert result.status == "created"
        assert fake_client.last_payment_method_id == "pm_saved"
        assert isinstance(fake_client.last_receipt, dict)
        customer = fake_client.last_receipt.get("customer")
        assert isinstance(customer, dict)
        assert customer.get("email") == "auto-topup-user@example.com"

        auto_payment = Payments.get_payment_by_provider_id("pay_auto")
        assert auto_payment is not None
        assert auto_payment.metadata_json is not None
        assert auto_payment.metadata_json.get("auto_topup") is True

    @pytest.mark.asyncio
    async def test_create_topup_payment_requires_receipt_contact(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.users import Users
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing as billing_utils

        class FakeYooKassaClient:
            async def create_payment(self, **_: object) -> dict[str, object]:
                return {
                    "id": "unused",
                    "status": "pending",
                    "confirmation": {"confirmation_url": "https://example.com/confirm"},
                }

        Users.insert_new_user(
            id="no-contact-user",
            name="No Contact",
            email="",
            role="user",
        )
        Users.update_user_by_id("no-contact-user", {"info": {}})

        monkeypatch.setattr(billing_utils, "BILLING_TOPUP_PACKAGES_KOPEKS", [19900])
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_ENABLED", True)
        monkeypatch.setattr(
            billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient()
        )

        wallet = wallet_service.get_or_create_wallet("no-contact-user", "RUB")

        with pytest.raises(
            ValueError,
            match="Set billing contact email or phone in billing settings to issue a payment receipt",
        ):
            await billing_service.create_topup_payment(
                user_id="no-contact-user",
                wallet_id=wallet.id,
                amount_kopeks=19900,
                return_url="https://example.com/return",
            )

    @pytest.mark.asyncio
    async def test_auto_topup_missing_payment_method_skips(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import Payments, Wallets
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service
        import open_webui.utils.billing as billing_utils

        monkeypatch.setattr(billing_utils, "BILLING_TOPUP_PACKAGES_KOPEKS", [19900])

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "auto_topup_enabled": True,
                "auto_topup_threshold_kopeks": 5000,
                "auto_topup_amount_kopeks": 19900,
            },
        )

        existing = Payments.list_payments_by_wallet(wallet.id)

        result = await billing_service.maybe_trigger_auto_topup(
            user_id="1",
            wallet_id=wallet.id,
            available_kopeks=100,
            required_kopeks=500,
            reason="balance_low",
        )

        assert result.attempted is True
        assert result.status == "missing_payment_method"
        updated = Payments.list_payments_by_wallet(wallet.id)
        assert len(updated) == len(existing)

    @pytest.mark.asyncio
    async def test_auto_topup_canceled_increments_fail_count(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "auto_topup_enabled": True,
                "auto_topup_fail_count": 0,
            },
        )

        payment = PaymentModel(
            id="payment_auto",
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=19900,
            currency="RUB",
            idempotency_key="idem_auto",
            provider_payment_id="pay_auto_fail",
            payment_method_id="pm_saved",
            status_details=None,
            metadata_json={
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "auto_topup": True,
                "amount_kopeks": 19900,
            },
            raw_payload_json=None,
            user_id="1",
            wallet_id=wallet.id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        Payments.create_payment(payment)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_auto_fail",
            status="canceled",
            metadata=payment.metadata_json or {},
            amount_value="199.00",
            currency="RUB",
            paid=False,
        )

        await billing_service.process_payment_webhook(
            {
                "event_type": "payment.canceled",
                "payment_id": "pay_auto_fail",
                "status": "canceled",
                "amount": "199.00",
                "currency": "RUB",
                "metadata": payment.metadata_json,
            }
        )

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.auto_topup_fail_count == 1
        assert updated_wallet.auto_topup_last_failed_at is not None

    @pytest.mark.asyncio
    async def test_topup_webhook_credits_wallet(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import (
            LedgerEntries,
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        payment = PaymentModel(
            id="payment_1",
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=19900,
            currency="RUB",
            idempotency_key="idem_1",
            provider_payment_id="pay_123",
            payment_method_id=None,
            status_details=None,
            metadata_json={
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
            raw_payload_json=None,
            user_id="1",
            wallet_id=wallet.id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        Payments.create_payment(payment)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_123",
            status="succeeded",
            metadata=payment.metadata_json or {},
            amount_value="199.00",
            currency="RUB",
            paid=True,
        )

        webhook_data = {
            "event_type": "payment.succeeded",
            "payment_id": "pay_123",
            "status": "succeeded",
            "amount": "199.00",
            "currency": "RUB",
            "metadata": {
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
        }

        await billing_service.process_payment_webhook(webhook_data)

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 19900

        ledger_entries = LedgerEntries.get_entries_by_user("1")
        assert any(
            entry.type == "topup" and entry.reference_id == "pay_123"
            for entry in ledger_entries
        )

        updated_payment = Payments.get_payment_by_provider_id("pay_123")
        assert updated_payment is not None
        assert updated_payment.status == PaymentStatus.SUCCEEDED.value

    @pytest.mark.asyncio
    async def test_topup_webhook_idempotent(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.billing import (
            LedgerEntries,
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        payment = PaymentModel(
            id="payment_2",
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=19900,
            currency="RUB",
            idempotency_key="idem_2",
            provider_payment_id="pay_456",
            payment_method_id=None,
            status_details=None,
            metadata_json={
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
            raw_payload_json=None,
            user_id="1",
            wallet_id=wallet.id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        Payments.create_payment(payment)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_456",
            status="succeeded",
            metadata=payment.metadata_json or {},
            amount_value="199.00",
            currency="RUB",
            paid=True,
        )

        webhook_data = {
            "event_type": "payment.succeeded",
            "payment_id": "pay_456",
            "status": "succeeded",
            "amount": "199.00",
            "currency": "RUB",
            "metadata": {
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
        }

        await billing_service.process_payment_webhook(webhook_data)
        await billing_service.process_payment_webhook(webhook_data)

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 19900

        ledger_entries = LedgerEntries.get_entries_by_user("1")
        topups = [
            entry
            for entry in ledger_entries
            if entry.type == "topup" and entry.reference_id == "pay_456"
        ]
        assert len(topups) == 1

    @pytest.mark.asyncio
    async def test_topup_webhook_creates_payment_when_missing(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import LedgerEntries, Payments, Wallets
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        metadata = {
            "kind": "topup",
            "user_id": "1",
            "wallet_id": wallet.id,
        }
        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_new",
            status="succeeded",
            metadata=metadata,
            amount_value="199.00",
            currency="RUB",
            paid=True,
        )

        webhook_data = {
            "event_type": "payment.succeeded",
            "payment_id": "pay_new",
            "status": "succeeded",
            "amount": "199.00",
            "currency": "RUB",
            "metadata": metadata,
        }

        await billing_service.process_payment_webhook(webhook_data)

        payment = Payments.get_payment_by_provider_id("pay_new")
        assert payment is not None
        assert payment.amount_kopeks == 19900

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 19900

        ledger_entries = LedgerEntries.get_entries_by_user("1")
        assert any(
            entry.type == "topup" and entry.reference_id == "pay_new"
            for entry in ledger_entries
        )

    @pytest.mark.asyncio
    async def test_topup_webhook_canceled_updates_status(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        payment = PaymentModel(
            id="payment_3",
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=19900,
            currency="RUB",
            idempotency_key="idem_3",
            provider_payment_id="pay_cancel",
            payment_method_id=None,
            status_details=None,
            metadata_json={
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
            raw_payload_json=None,
            user_id="1",
            wallet_id=wallet.id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        Payments.create_payment(payment)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_cancel",
            status="canceled",
            metadata=payment.metadata_json or {},
            amount_value="199.00",
            currency="RUB",
            paid=False,
        )

        webhook_data = {
            "event_type": "payment.canceled",
            "payment_id": "pay_cancel",
            "status": "canceled",
            "amount": "199.00",
            "currency": "RUB",
            "metadata": {
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
        }

        await billing_service.process_payment_webhook(webhook_data)

        updated_payment = Payments.get_payment_by_provider_id("pay_cancel")
        assert updated_payment is not None
        assert updated_payment.status == PaymentStatus.CANCELED.value

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 0

    @pytest.mark.asyncio
    async def test_topup_webhook_waiting_for_capture_updates_status(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
            Wallets,
        )
        from open_webui.utils.billing import billing_service
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        payment = PaymentModel(
            id="payment_4",
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=19900,
            currency="RUB",
            idempotency_key="idem_4",
            provider_payment_id="pay_wait",
            payment_method_id=None,
            status_details=None,
            metadata_json={
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
            raw_payload_json=None,
            user_id="1",
            wallet_id=wallet.id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        Payments.create_payment(payment)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_wait",
            status="waiting_for_capture",
            metadata=payment.metadata_json or {},
            amount_value="199.00",
            currency="RUB",
            paid=False,
        )

        webhook_data = {
            "event_type": "payment.waiting_for_capture",
            "payment_id": "pay_wait",
            "status": "waiting_for_capture",
            "amount": "199.00",
            "currency": "RUB",
            "metadata": {
                "kind": PaymentKind.TOPUP.value,
                "user_id": "1",
                "wallet_id": wallet.id,
                "amount_kopeks": 19900,
            },
        }

        await billing_service.process_payment_webhook(webhook_data)

        updated_payment = Payments.get_payment_by_provider_id("pay_wait")
        assert updated_payment is not None
        assert updated_payment.status == PaymentStatus.PENDING.value

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 0
