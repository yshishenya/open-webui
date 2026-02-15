import time
from typing import Optional

import pytest
from _pytest.monkeypatch import MonkeyPatch
import open_webui.utils.billing as billing_utils

from open_webui.models.billing import (
    PaymentKind,
    PaymentModel,
    PaymentStatus,
    Payments,
    TransactionModel,
    TransactionStatus,
    Transactions,
    UsageMetric,
    Wallets,
)
from open_webui.utils.billing import (
    AUTO_TOPUP_MAX_FAILURES,
    BillingService,
    WebhookRetryableError,
    WebhookVerificationError,
)
from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingServiceWebhookStatuses(AbstractPostgresTest):
    def _callable(self, value: object) -> object:
        return value.__func__ if hasattr(value, "__func__") else value

    @pytest.fixture(autouse=True)
    def _no_billing_singleton_mutation_guard(self) -> None:
        wallet_getter = self._callable(Wallets.get_wallet_by_id)
        wallet_updater = self._callable(Wallets.update_wallet)
        transactions_by_user = self._callable(Transactions.get_transactions_by_user)
        has_pending = self._callable(BillingService._has_pending_topup)
        wallet_service_apply_topup = self._callable(billing_utils.wallet_service.apply_topup)

        yield

        assert self._callable(Wallets.get_wallet_by_id) is wallet_getter
        assert self._callable(Wallets.update_wallet) is wallet_updater
        assert self._callable(Transactions.get_transactions_by_user) is transactions_by_user
        assert self._callable(BillingService._has_pending_topup) is has_pending
        assert self._callable(billing_utils.wallet_service.apply_topup) is wallet_service_apply_topup

    def _create_transaction(
        self,
        transaction_id: str,
        payment_id: str,
        status: str = TransactionStatus.PENDING.value,
        extra_metadata: Optional[dict[str, object]] = None,
    ) -> None:
        now = int(time.time())
        Transactions.create_transaction(
            TransactionModel(
                id=transaction_id,
                user_id="user_1",
                subscription_id=None,
                amount=100,
                currency="RUB",
                status=status,
                yookassa_payment_id=payment_id,
                yookassa_status="pending",
                description="Subscription charge",
                description_ru="Списание подписки",
                receipt_url=None,
                extra_metadata=extra_metadata or {"plan_id": "plan_1"},
                created_at=now,
                updated_at=now,
            )
        )

    def _create_topup_payment(
        self,
        payment_id: str,
        status: str = PaymentStatus.PENDING.value,
        wallet_id: Optional[str] = None,
        user_id: str = "user_1",
        metadata: Optional[dict[str, object]] = None,
    ) -> None:
        now = int(time.time())
        Payments.create_payment(
            PaymentModel(
                id=f"payment_{payment_id}",
                provider="yookassa",
                status=status,
                kind=PaymentKind.TOPUP.value,
                amount_kopeks=1000,
                currency="RUB",
                idempotency_key=None,
                provider_payment_id=payment_id,
                payment_method_id=None,
                status_details={"yookassa_status": "pending"},
                metadata_json=metadata or {"wallet_id": wallet_id, "user_id": user_id},
                raw_payload_json=None,
                user_id=user_id,
                wallet_id=wallet_id,
                subscription_id=None,
                created_at=now,
                updated_at=now,
            )
        )

    @pytest.mark.asyncio
    async def test_process_payment_webhook_requires_event_and_payment_id(self) -> None:
        service = BillingService()

        with pytest.raises(WebhookVerificationError, match="Missing event_type"):
            await service.process_payment_webhook({"payment_id": "pay_1"})

        with pytest.raises(WebhookVerificationError, match="Missing payment_id"):
            await service.process_payment_webhook({"event_type": "payment.succeeded"})

    @pytest.mark.asyncio
    async def test_process_payment_webhook_rejects_missing_payment_client(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: None)

        with pytest.raises(WebhookRetryableError, match="YooKassa client not initialized"):
            await service.process_payment_webhook(
                {"event_type": "payment.succeeded", "payment_id": "pay_1"}
            )

    @pytest.mark.asyncio
    async def test_process_payment_webhook_rejects_provider_payload_issues(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()

        class FakeYooKassaClientInvalid:
            async def get_payment(self, provider_payment_id: str) -> str:
                assert provider_payment_id == "pay_invalid"
                return "invalid-payload"

        class FakeYooKassaClientNotFound:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                assert provider_payment_id == "pay_notfound"
                return {"id": provider_payment_id, "status": "unknown"}

        monkeypatch.setattr(
            billing_utils, "get_yookassa_client",
            lambda: FakeYooKassaClientInvalid(),
        )

        with pytest.raises(WebhookRetryableError, match="Provider payment payload invalid"):
            await service.process_payment_webhook(
                {"event_type": "payment.succeeded", "payment_id": "pay_invalid"}
            )

        monkeypatch.setattr(
            billing_utils,
            "get_yookassa_client",
            lambda: FakeYooKassaClientNotFound(),
        )
        with pytest.raises(WebhookRetryableError, match="Provider status mismatch"):
            await service.process_payment_webhook(
                {"event_type": "payment.succeeded", "payment_id": "pay_notfound"}
            )

    @pytest.mark.asyncio
    async def test_process_payment_webhook_rejects_status_mismatch_and_unpaid_topup(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_status_mismatch"
        payment_id = "pay_status_mismatch"
        self._create_transaction(transaction_id=transaction_id, payment_id=payment_id)

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                return {
                    "id": provider_payment_id,
                    "status": "waiting_for_capture",
                    "paid": True,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {"transaction_id": transaction_id},
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())

        with pytest.raises(WebhookRetryableError, match="Provider status mismatch"):
            await service.process_payment_webhook(
                {
                    "event_type": "payment.succeeded",
                    "payment_id": payment_id,
                    "metadata": {"transaction_id": transaction_id},
                }
            )

        class FakeYooKassaUnpaid:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                return {
                    "id": provider_payment_id,
                    "status": "succeeded",
                    "paid": False,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {"transaction_id": transaction_id},
                }

        monkeypatch.setattr(
            billing_utils,
            "get_yookassa_client",
            lambda: FakeYooKassaUnpaid(),
        )

        with pytest.raises(WebhookRetryableError, match="Provider payment not marked as paid"):
            await service.process_payment_webhook(
                {
                    "event_type": "payment.succeeded",
                    "payment_id": payment_id,
                    "metadata": {"transaction_id": transaction_id},
                }
            )

    @pytest.mark.asyncio
    async def test_process_payment_webhook_rejects_payment_id_mismatch(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_mismatch"
        self._create_transaction(transaction_id=transaction_id, payment_id="other_payment")

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                return {
                    "id": provider_payment_id,
                    "status": "succeeded",
                    "paid": True,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {"transaction_id": transaction_id},
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())

        with pytest.raises(WebhookVerificationError, match="Payment ID does not match transaction"):
            await service.process_payment_webhook(
                {
                    "event_type": "payment.succeeded",
                    "payment_id": "incoming_payment",
                    "metadata": {"transaction_id": transaction_id},
                }
            )

    @pytest.mark.asyncio
    async def test_process_payment_webhook_uses_existing_transaction_and_ignores_duplicate(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_duplicate"
        payment_id = "pay_duplicate"
        self._create_transaction(
            transaction_id=transaction_id,
            payment_id=payment_id,
            status=TransactionStatus.SUCCEEDED.value,
        )

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                return {
                    "id": provider_payment_id,
                    "status": "succeeded",
                    "paid": True,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {
                        "user_id": "user_1",
                        "plan_id": "plan_1",
                        "transaction_id": transaction_id,
                    },
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())
        await service.process_payment_webhook(
            {
                "event_type": "payment.succeeded",
                "payment_id": payment_id,
                "metadata": {
                    "user_id": "user_1",
                    "plan_id": "plan_1",
                    "transaction_id": transaction_id,
                },
            }
        )

        updated = Transactions.get_transaction_by_id(transaction_id)
        assert updated is not None
        assert updated.status == TransactionStatus.SUCCEEDED.value

    @pytest.mark.asyncio
    async def test_process_payment_webhook_marks_transaction_canceled(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_cancel_1"
        payment_id = "pay_cancel_1"
        self._create_transaction(transaction_id=transaction_id, payment_id=payment_id)

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                assert provider_payment_id == payment_id
                return {
                    "id": payment_id,
                    "status": "canceled",
                    "paid": False,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {"transaction_id": transaction_id},
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())

        await service.process_payment_webhook(
            {
                "event_type": "payment.canceled",
                "payment_id": payment_id,
                "metadata": {"transaction_id": transaction_id},
            }
        )

        updated = Transactions.get_transaction_by_id(transaction_id)
        assert updated is not None
        assert updated.status == TransactionStatus.CANCELED.value
        assert updated.yookassa_status == "canceled"

    @pytest.mark.asyncio
    async def test_process_payment_webhook_updates_waiting_for_capture_status(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_wait_1"
        payment_id = "pay_wait_1"
        self._create_transaction(transaction_id=transaction_id, payment_id=payment_id)

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                assert provider_payment_id == payment_id
                return {
                    "id": payment_id,
                    "status": "waiting_for_capture",
                    "paid": False,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {"transaction_id": transaction_id},
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())

        await service.process_payment_webhook(
            {
                "event_type": "payment.waiting_for_capture",
                "payment_id": payment_id,
                "metadata": {"transaction_id": transaction_id},
            }
        )

        updated = Transactions.get_transaction_by_id(transaction_id)
        assert updated is not None
        assert updated.status == TransactionStatus.PENDING.value
        assert updated.yookassa_status == "waiting_for_capture"

    @pytest.mark.asyncio
    async def test_process_payment_webhook_succeeds_and_resets_plan_on_missing_metadata(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        transaction_id = "tx_missing_fields"
        payment_id = "pay_missing_fields"
        self._create_transaction(
            transaction_id=transaction_id,
            payment_id=payment_id,
            extra_metadata={"plan_id": "plan_1"},
        )

        class FakeYooKassaClient:
            async def get_payment(self, provider_payment_id: str) -> dict[str, object]:
                assert provider_payment_id == payment_id
                return {
                    "id": provider_payment_id,
                    "status": "succeeded",
                    "paid": True,
                    "amount": {"value": "100.00", "currency": "RUB"},
                    "metadata": {
                        "transaction_id": transaction_id,
                    },
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())

        assert (
            await service.process_payment_webhook(
                {
                    "event_type": "payment.succeeded",
                    "payment_id": payment_id,
                    "metadata": {
                        "transaction_id": transaction_id,
                    },
                }
            )
            is None
        )

        updated = Transactions.get_transaction_by_id(transaction_id)
        assert updated is not None
        assert updated.status == TransactionStatus.SUCCEEDED.value

    def test_process_topup_webhook_returns_early_without_payment_id(self) -> None:
        service = BillingService()
        service._process_topup_webhook(
            event_type="payment.succeeded",
            payment_id=None,
            webhook_data={"metadata": {}},
        )

    def test_process_topup_webhook_returns_early_when_payment_record_missing(self) -> None:
        service = BillingService()
        service._process_topup_webhook(
            event_type="payment.succeeded",
            payment_id="pay_missing",
            webhook_data={"metadata": {}},
        )

    @pytest.mark.asyncio
    async def test_process_topup_webhook_ignores_duplicate_succeeded_payment(self) -> None:
        from open_webui.utils.billing import BILLING_TOPUP_PACKAGES_KOPEKS
        import open_webui.utils.billing as billing_utils
        from open_webui.utils.wallet import wallet_service

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_dup", "RUB")
        original_topup_packages = list(BILLING_TOPUP_PACKAGES_KOPEKS)
        BILLING_TOPUP_PACKAGES_KOPEKS.append(1000)  # type: ignore[attr-defined]
        self._create_topup_payment(
            payment_id="pay_dup_1",
            status=PaymentStatus.SUCCEEDED.value,
            wallet_id=wallet.id,
            user_id="user_dup",
            metadata={"amount_kopeks": 1000},
        )

        called: dict[str, object] = {"count": 0}

        def _fail_apply_topup(**_: object) -> object:
            called["count"] += 1
            raise AssertionError("apply_topup should not be called for duplicate")

        monkeypatch = billing_utils.wallet_service
        original_apply_topup = monkeypatch.apply_topup
        monkeypatch.apply_topup = _fail_apply_topup  # type: ignore[method-assign]
        try:
            service._process_topup_webhook(
                event_type="payment.succeeded",
                payment_id="pay_dup_1",
                webhook_data={"metadata": {"wallet_id": wallet.id, "user_id": "user_dup"}},
            )
            assert called["count"] == 0
        finally:
            # restore global state
            monkeypatch.apply_topup = original_apply_topup  # type: ignore[method-assign]
            BILLING_TOPUP_PACKAGES_KOPEKS.clear()
            BILLING_TOPUP_PACKAGES_KOPEKS.extend(original_topup_packages)

    @pytest.mark.asyncio
    async def test_process_topup_webhook_waiting_for_capture_updates_payment(self) -> None:
        from open_webui.utils.wallet import wallet_service

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_wait", "RUB")
        self._create_topup_payment(
            payment_id="pay_wait_topup",
            status=PaymentStatus.PENDING.value,
            wallet_id=wallet.id,
            user_id="user_wait",
            metadata={"amount_kopeks": 1000},
        )

        service._process_topup_webhook(
            event_type="payment.waiting_for_capture",
            payment_id="pay_wait_topup",
            webhook_data={
                "status": "waiting_for_capture",
                "metadata": {"wallet_id": wallet.id, "user_id": "user_wait"},
            },
        )

        payment = service.payments.get_payment_by_provider_id("pay_wait_topup")
        assert payment is not None
        assert payment.status == PaymentStatus.PENDING.value
        assert payment.status_details["yookassa_status"] == "waiting_for_capture"

    @pytest.mark.asyncio
    async def test_process_topup_webhook_succeeded_path_resets_failure_count_on_auto_topup(
        self,
    ) -> None:
        from open_webui.utils.wallet import wallet_service
        import open_webui.models.billing as billing_models

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_reset", "RUB")
        billing_models.Wallets.update_wallet(
            wallet.id,
            {"auto_topup_enabled": True, "auto_topup_fail_count": 2},
        )

        service._process_topup_webhook(
            event_type="payment.succeeded",
            payment_id="pay_reset_1",
            webhook_data={
                "metadata": {
                    "amount_kopeks": 1500,
                    "wallet_id": wallet.id,
                    "user_id": "user_reset",
                    "auto_topup": True,
                },
            },
        )

        assert (
            service.wallets.get_wallet_by_id(wallet.id).auto_topup_fail_count
            == 0
        )

    @pytest.mark.asyncio
    async def test_process_topup_webhook_succeeded_path_rejects_without_amount_or_wallet(self) -> None:
        from open_webui.utils.wallet import wallet_service

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_incomplete", "RUB")
        self._create_topup_payment(
            payment_id="pay_no_amount",
            status=PaymentStatus.PENDING.value,
            wallet_id=None,
            user_id="user_incomplete",
            metadata={"wallet_id": wallet.id, "user_id": "user_incomplete"},
        )

        self._create_topup_payment(
            payment_id="pay_no_wallet",
            status=PaymentStatus.PENDING.value,
            wallet_id=None,
            user_id="user_incomplete",
            metadata={"user_id": "user_incomplete"},
        )

        called: dict[str, object] = {"count": 0}

        def _fail_apply_topup(**_: object) -> object:
            called["count"] += 1
            raise AssertionError("apply_topup should not be called")

        import open_webui.utils.billing as billing_utils

        wallet_service_singleton = billing_utils.wallet_service
        original_apply_topup = wallet_service_singleton.apply_topup
        wallet_service_singleton.apply_topup = _fail_apply_topup  # type: ignore[method-assign]
        try:
            service._process_topup_webhook(
                event_type="payment.succeeded",
                payment_id="pay_no_amount",
                webhook_data={
                    "metadata": {"wallet_id": wallet.id, "user_id": "user_incomplete"}
                },
            )
            service._process_topup_webhook(
                event_type="payment.succeeded",
                payment_id="pay_no_wallet",
                webhook_data={
                    "amount": "15.00",
                    "metadata": {"user_id": "user_incomplete"},
                },
            )
            assert called["count"] == 0
        finally:
            wallet_service_singleton.apply_topup = original_apply_topup  # type: ignore[method-assign]

    @pytest.mark.asyncio
    async def test_process_topup_webhook_create_missing_payment_and_apply_topup(self) -> None:
        from open_webui.utils.wallet import wallet_service

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_create", "RUB")

        service._process_topup_webhook(
            event_type="payment.succeeded",
            payment_id="pay_new",
            webhook_data={
                "metadata": {
                    "wallet_id": wallet.id,
                    "user_id": "user_create",
                    "amount_kopeks": 2000,
                    "kind": PaymentKind.TOPUP.value,
                },
                "amount": "20.00",
                "currency": "RUB",
                "status": "succeeded",
            },
        )

        payment = service.payments.get_payment_by_provider_id("pay_new")
        assert payment is not None
        assert payment.status == PaymentStatus.SUCCEEDED.value
        assert payment.raw_payload_json["status"] == "succeeded"

        wallet_updated = service.wallets.get_wallet_by_id(wallet.id)
        assert wallet_updated.balance_topup_kopeks >= 2000

    def test_process_topup_webhook_marks_canceled_auto_topup(self) -> None:
        from open_webui.utils.wallet import wallet_service

        service = BillingService()
        wallet = wallet_service.get_or_create_wallet("user_cancel_auto", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "auto_topup_enabled": True,
                "auto_topup_fail_count": AUTO_TOPUP_MAX_FAILURES - 1,
                "auto_topup_threshold_kopeks": 100,
                "auto_topup_amount_kopeks": 100,
            },
        )
        self._create_topup_payment(
            payment_id="pay_cancel_auto",
            status=PaymentStatus.PENDING.value,
            wallet_id=wallet.id,
            user_id="user_cancel_auto",
            metadata={
                "wallet_id": wallet.id,
                "user_id": "user_cancel_auto",
                "auto_topup": True,
                "auto_topup_reason": "balance_low",
            },
        )

        service._process_topup_webhook(
            event_type="payment.canceled",
            payment_id="pay_cancel_auto",
            webhook_data={
                "metadata": {
                    "wallet_id": wallet.id,
                    "user_id": "user_cancel_auto",
                    "auto_topup": True,
                },
                "status": "canceled",
            },
        )

        payment = service.payments.get_payment_by_provider_id("pay_cancel_auto")
        assert payment is not None
        assert payment.status == PaymentStatus.CANCELED.value
        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet.auto_topup_fail_count == AUTO_TOPUP_MAX_FAILURES
        assert updated_wallet.auto_topup_enabled is False

    @pytest.mark.asyncio
    async def test_is_auto_topup_metadata_understands_multiple_types(self) -> None:
        service = BillingService()

        assert service._is_auto_topup_metadata({"auto_topup": True}) is True
        assert service._is_auto_topup_metadata({"auto_topup": False}) is False
        assert service._is_auto_topup_metadata({"auto_topup": "true"}) is True
        assert service._is_auto_topup_metadata({"auto_topup": "FALSE"}) is False
        assert service._is_auto_topup_metadata({"auto_topup": 1}) is True
        assert service._is_auto_topup_metadata({"auto_topup": 2}) is False
        assert service._is_auto_topup_metadata({"auto_topup": None}) is False
        assert service._is_auto_topup_metadata(None) is False

    def test_record_auto_topup_failure_resets_disabled_flag_only_at_limit(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        service = BillingService()
        updates: list[dict[str, object]] = []

        def _capture_update(*_args: object, **_payload: object) -> object:
            assert len(_args) == 2
            update_payload = _args[1]
            assert isinstance(update_payload, dict)
            updates.append(update_payload)
            return None

        monkeypatch.setattr(service.wallets, "update_wallet", _capture_update)
        service._record_auto_topup_failure("wallet_1", 0)
        service._record_auto_topup_failure("wallet_1", AUTO_TOPUP_MAX_FAILURES - 1)
        assert updates == [
            {"auto_topup_fail_count": 1, "auto_topup_last_failed_at": updates[0]["auto_topup_last_failed_at"]},
            {
                "auto_topup_fail_count": AUTO_TOPUP_MAX_FAILURES,
                "auto_topup_last_failed_at": updates[1]["auto_topup_last_failed_at"],
                "auto_topup_enabled": False,
            },
        ]

    @pytest.mark.asyncio
    async def test_maybe_trigger_auto_topup_returns_statuses(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        service = BillingService()
        monkeypatch.setattr(service.wallets, "get_wallet_by_id", lambda _: None)
        assert (
            (await service.maybe_trigger_auto_topup(
                "user_x", "wallet_x", 0, 100, "insufficient"
            )
        ).attempted is False
        )

        class FakeWallet:
            id = "wallet_1"
            auto_topup_enabled = False
            auto_topup_threshold_kopeks = None
            auto_topup_amount_kopeks = None
            auto_topup_fail_count = 0
            balance_included_kopeks = 0
            balance_topup_kopeks = 0

        monkeypatch.setattr(
            service.wallets,
            "get_wallet_by_id",
            lambda _: FakeWallet(),
        )
        assert (
            await service.maybe_trigger_auto_topup(
                "user_1", "wallet_1", 10, 100, "insufficient"
            )
        ).status == "disabled"
        FakeWallet.auto_topup_enabled = True
        FakeWallet.auto_topup_threshold_kopeks = 1000
        FakeWallet.auto_topup_amount_kopeks = 500
        FakeWallet.auto_topup_fail_count = AUTO_TOPUP_MAX_FAILURES
        monkeypatch.setattr(service, "_has_pending_topup", lambda _: False)
        assert (
            await service.maybe_trigger_auto_topup(
                "user_1", "wallet_1", 900, 1000, "insufficient"
            )
        ).status == "fail_limit"

    @pytest.mark.asyncio
    async def test_get_user_billing_info_handles_all_branches(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils
        from types import SimpleNamespace

        service = BillingService()
        now = int(time.time())

        class FakeWallet:
            id = "wallet_1"

        class _Model:
            def __init__(self, payload: dict[str, object]) -> None:
                self._payload = payload

            def model_dump(self) -> dict[str, object]:
                return self._payload

            def __getattr__(self, name: str) -> object:
                return self._payload[name]

        service.get_user_subscription = lambda *_: _Model(  # type: ignore[method-assign]
            {"plan_id": "plan_1"}
        )
        service.get_plan = lambda *_: _Model(  # type: ignore[method-assign]
            {"quotas": {"tokens_input": 1000, "tokens_output": 500}}
        )
        service.get_current_period_usage = lambda *_: 0  # type: ignore[method-assign]
        monkeypatch.setattr(
            service.transactions,
            "get_transactions_by_user",
            lambda *_args, **_kwargs: [  # type: ignore[method-assign]
                SimpleNamespace(model_dump=lambda: {"id": "tx_1"})
            ],
        )
        monkeypatch.setattr(
            billing_utils,
            "get_lead_magnet_config",
            lambda: SimpleNamespace(  # type: ignore[method-assign]
                enabled=True,
                quotas={"tokens_input": 100, "tokens_output": 0, "images": 0, "tts_seconds": 0, "stt_seconds": 0},
                config_version=1,
            ),
        )
        monkeypatch.setattr(
            billing_utils,
            "get_lead_magnet_state",
            lambda *_: SimpleNamespace(  # type: ignore[method-assign]
                tokens_input_used=0,
                tokens_output_used=0,
                images_used=0,
                tts_seconds_used=0,
                stt_seconds_used=0,
                cycle_start=now,
                cycle_end=now + 10,
                config_version=1,
            ),
        )
        monkeypatch.setattr(
            billing_utils,
            "calculate_remaining",
            lambda *_: {"tokens_input": 100, "tokens_output": 0, "images": 0, "tts_seconds": 0, "stt_seconds": 0},
        )
        payload = service.get_user_billing_info("user_1")
        assert payload["subscription"] is not None
        assert payload["plan"] is not None
        assert payload["transactions"] == [{"id": "tx_1"}]
        assert payload["lead_magnet"]["enabled"] is True

        service.get_user_subscription = lambda *_: None  # type: ignore[method-assign]
        monkeypatch.setattr(
            billing_utils,
            "get_lead_magnet_config",
            lambda: SimpleNamespace(  # type: ignore[method-assign]
                enabled=False,
                quotas={},
                config_version=1,
                cycle_days=7,
            ),
        )
        monkeypatch.setattr(
            billing_utils,
            "get_lead_magnet_state",
            lambda *_: None,  # type: ignore[method-assign]
        )
        no_sub = service.get_user_billing_info("user_1")
        assert no_sub["subscription"] is None
        assert no_sub["plan"] is None
        assert no_sub["usage"] == {}
        assert no_sub["lead_magnet"]["enabled"] is False
