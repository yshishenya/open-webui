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
    async def test_create_payment_updates_transaction_and_returns_payload(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.utils.billing as billing_utils

        service = BillingService()
        service.get_plan = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            price=100,
            currency="RUB",
            name="Pro",
            name_ru="Про",
        )

        class FakeYooKassaClient:
            async def create_payment(self, **_: object) -> dict[str, object]:
                return {
                    "id": "pay_1",
                    "status": "pending",
                    "confirmation": {
                        "confirmation_url": "https://pay.example.com/confirm"
                    },
                }

        monkeypatch.setattr(
            billing_utils, "get_yookassa_client", lambda: FakeYooKassaClient()
        )
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
