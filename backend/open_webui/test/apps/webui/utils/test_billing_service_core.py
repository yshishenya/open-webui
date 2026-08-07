# ruff: noqa

from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch

from open_webui.models.billing import UsageMetric
from open_webui.utils.billing import BillingService


class TestBillingServiceCore:
    def test_check_quota_unlimited_without_subscription(self) -> None:
        service = BillingService()
        service.get_user_subscription = lambda *_: None  # type: ignore[method-assign]

        assert service.check_quota("user_1", UsageMetric.REQUESTS, 10) is True

    def test_check_quota_unlimited_without_plan_or_metric_limit(self) -> None:
        service = BillingService()
        service.get_user_subscription = lambda *_: SimpleNamespace(plan_id="plan_1")  # type: ignore[method-assign]

        service.get_plan = lambda *_: None  # type: ignore[method-assign]
        assert service.check_quota("user_1", UsageMetric.REQUESTS, 1) is True

        service.get_plan = lambda *_: SimpleNamespace(quotas={})  # type: ignore[method-assign]
        assert service.check_quota("user_1", UsageMetric.REQUESTS, 1) is True

        service.get_plan = lambda *_: SimpleNamespace(quotas={"tokens_input": 100})  # type: ignore[method-assign]
        assert service.check_quota("user_1", UsageMetric.REQUESTS, 1) is True

    def test_check_quota_detects_limit_exceeded(self) -> None:
        service = BillingService()
        service.get_user_subscription = lambda *_: SimpleNamespace(plan_id="plan_1")  # type: ignore[method-assign]
        service.get_plan = lambda *_: SimpleNamespace(quotas={"requests": 5})  # type: ignore[method-assign]
        service.get_current_period_usage = lambda *_: 5  # type: ignore[method-assign]

        assert service.check_quota("user_1", UsageMetric.REQUESTS, 1) is False

    @pytest.mark.asyncio
    async def test_create_payment_validates_plan_and_client(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        service.get_plan = lambda *_: None  # type: ignore[method-assign]

        with pytest.raises(ValueError, match="Plan .* not found"):
            await service.create_payment(
                user_id="user_1",
                plan_id="plan_missing",
                return_url="https://example.com/return",
            )

        service.get_plan = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            price=100,
            currency="RUB",
            name="Pro",
            name_ru="Про",
        )
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: None)

        with pytest.raises(RuntimeError, match="YooKassa client not initialized"):
            await service.create_payment(
                user_id="user_1",
                plan_id="plan_1",
                return_url="https://example.com/return",
            )

    @pytest.mark.asyncio
    async def test_create_payment_rejects_inactive_plan(self) -> None:
        service = BillingService()
        service.get_plan = lambda *_: SimpleNamespace(is_active=False)  # type: ignore[method-assign]

        with pytest.raises(ValueError, match="Plan .* not found"):
            await service.create_payment(
                user_id="user_1",
                plan_id="plan_inactive",
                return_url="https://example.com/return",
            )

    @pytest.mark.asyncio
    async def test_create_payment_updates_transaction_and_returns_payload(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        service.get_plan = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            price=100,
            currency="RUB",
            name="Pro",
            name_ru="Про",
        )

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.metadata: dict[str, object] = {}
                self.idempotence_key: object = None

            async def create_payment(self, **_: object) -> dict[str, object]:
                self.metadata = dict(_.get("metadata", {}))
                self.idempotence_key = _.get("idempotence_key")
                return {
                    "id": "pay_1",
                    "status": "pending",
                    "confirmation": {"confirmation_url": "https://pay.example.com/confirm"},
                }

        fake_client = FakeYooKassaClient()
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: fake_client)

        async def _resolve_user_email(_user_id: str) -> None:
            return None

        monkeypatch.setattr(service, "_resolve_user_email", _resolve_user_email)
        # Receipt generation needs a real user/contact in the DB. This unit-style
        # test focuses on payment wiring + transaction updates.
        monkeypatch.setattr(billing_utils, "BILLING_RECEIPT_ENABLED", False)

        updates: list[tuple[str, dict[str, object]]] = []

        def _create_transaction(transaction: object) -> object:
            return SimpleNamespace(id=getattr(transaction, "id"))

        def _update_transaction(transaction_id: str, payload: dict[str, object]) -> object:
            updates.append((transaction_id, payload))
            return object()

        monkeypatch.setattr(service.transactions, "create_transaction", _create_transaction)
        monkeypatch.setattr(service.transactions, "update_transaction", _update_transaction)

        result = await service.create_payment(
            user_id="user_1",
            plan_id="plan_1",
            return_url="https://example.com/return",
        )

        assert result["payment_id"] == "pay_1"
        assert result["status"] == "pending"
        assert result["confirmation_url"] == "https://pay.example.com/confirm"
        assert isinstance(result["transaction_id"], str)
        assert updates
        assert updates[-1][1]["yookassa_payment_id"] == "pay_1"
        assert updates[-1][1]["yookassa_status"] == "pending"
        assert isinstance(fake_client.idempotence_key, str)
        assert "user_email" not in fake_client.metadata

    @pytest.mark.asyncio
    async def test_process_payment_webhook_provider_fetch_failure_is_retryable(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils
        from open_webui.utils.billing import WebhookRetryableError

        class FailingYooKassaClient:
            async def get_payment(self, _: str) -> dict[str, object]:
                raise RuntimeError("provider unavailable")

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FailingYooKassaClient())

        with pytest.raises(WebhookRetryableError, match="Failed to fetch payment"):
            await BillingService().process_payment_webhook(
                {"event_type": "payment.succeeded", "payment_id": "pay_fetch_failure"}
            )

    @pytest.mark.asyncio
    async def test_reconcile_topup_guards_invalid_provider_states(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        with pytest.raises(ValueError, match="payment_id is required"):
            await service.reconcile_topup_payment("user_1", " ")

        monkeypatch.setattr(service.payments, "get_payment_by_provider_id", lambda _: None)
        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: None)
        with pytest.raises(RuntimeError, match="YooKassa client not initialized"):
            await service.reconcile_topup_payment("user_1", "pay_no_client")

        class FakeYooKassaClient:
            async def get_payment(self, _: str) -> object:
                return []

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())
        with pytest.raises(RuntimeError, match="Provider payment payload invalid"):
            await service.reconcile_topup_payment("user_1", "pay_invalid_payload")

        class UnpaidYooKassaClient:
            async def get_payment(self, _: str) -> dict[str, object]:
                return {"status": "succeeded", "paid": False}

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: UnpaidYooKassaClient())
        with pytest.raises(RuntimeError, match="not marked as paid"):
            await service.reconcile_topup_payment("user_1", "pay_unpaid")

    @pytest.mark.asyncio
    async def test_reconcile_topup_rejects_foreign_local_payment(self, monkeypatch: MonkeyPatch) -> None:
        service = BillingService()
        monkeypatch.setattr(
            service.payments,
            "get_payment_by_provider_id",
            lambda _: SimpleNamespace(user_id="other_user"),
        )

        with pytest.raises(PermissionError, match="does not belong"):
            await service.reconcile_topup_payment("user_1", "pay_foreign_local")

    @pytest.mark.asyncio
    async def test_process_payment_webhook_rejects_missing_topup_transaction(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils
        from open_webui.utils.billing import WebhookRetryableError

        class FakeYooKassaClient:
            async def get_payment(self, _: str) -> dict[str, object]:
                return {
                    "status": "succeeded",
                    "paid": True,
                    "amount": {"value": "10.00", "currency": "RUB"},
                    "metadata": {"transaction_id": "tx_missing"},
                }

        monkeypatch.setattr(billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient())
        service = BillingService()
        monkeypatch.setattr(service.transactions, "get_transaction_by_id", lambda _: None)

        with pytest.raises(WebhookRetryableError, match="Transaction tx_missing not found"):
            await service.process_payment_webhook(
                {"event_type": "payment.succeeded", "payment_id": "pay_missing_transaction"}
            )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("metadata", "amount", "currency", "match"),
        [
            ({"amount_kopeks": 999, "user_id": "user_1", "wallet_id": "wallet_1"}, "10.00", "RUB", "metadata amount mismatch"),
            ({"user_id": "user_1", "wallet_id": "wallet_1"}, "20.00", "RUB", "amount does not match"),
            ({"user_id": "user_1", "wallet_id": "wallet_1"}, "10.00", "USD", "currency does not match"),
            ({"user_id": "user_1", "wallet_id": "wallet_2"}, "10.00", "RUB", "wallet does not match"),
            ({"user_id": "user_2", "wallet_id": "wallet_1"}, "10.00", "RUB", "user does not match"),
        ],
    )
    async def test_topup_webhook_rejects_context_mismatches(
        self,
        monkeypatch: MonkeyPatch,
        metadata: dict[str, object],
        amount: str,
        currency: str,
        match: str,
    ) -> None:
        from open_webui.utils.billing import WebhookVerificationError

        service = BillingService()
        monkeypatch.setattr(
            service.payments,
            "get_payment_by_provider_id",
            lambda _: SimpleNamespace(
                amount_kopeks=1000,
                currency="RUB",
                wallet_id="wallet_1",
                user_id="user_1",
                status="pending",
            ),
        )

        with pytest.raises(WebhookVerificationError, match=match):
            service._process_topup_webhook(
                "payment.succeeded",
                "pay_context_mismatch",
                {
                    "amount": amount,
                    "currency": currency,
                    "metadata": metadata,
                },
            )
