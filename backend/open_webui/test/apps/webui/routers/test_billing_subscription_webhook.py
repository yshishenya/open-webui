import time

import pytest
from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingSubscriptionWebhook(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def _mock_yookassa_get_payment(
        self,
        monkeypatch: MonkeyPatch,
        payment_id: str,
        status: str,
        metadata: dict[str, object],
        amount_value: str = "100.00",
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

    @pytest.mark.asyncio
    async def test_subscription_webhook_idempotent(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PlanModel,
            Plans,
            Subscriptions,
            SubscriptionStatus,
            TransactionModel,
            Transactions,
            TransactionStatus,
        )
        from open_webui.utils.billing import billing_service

        now = int(time.time())
        plan_id = "plan_sub"
        Plans.create_plan(
            PlanModel(
                id=plan_id,
                name="Pro",
                price=100,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=0,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

        transaction = TransactionModel(
            id="tx_1",
            user_id="user_1",
            subscription_id=None,
            amount=100,
            currency="RUB",
            status=TransactionStatus.PENDING.value,
            yookassa_payment_id="pay_sub_1",
            yookassa_status="pending",
            description="Subscription: Pro",
            description_ru="Подписка: Pro",
            receipt_url=None,
            extra_metadata={"plan_id": plan_id},
            created_at=now,
            updated_at=now,
        )
        Transactions.create_transaction(transaction)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_sub_1",
            status="succeeded",
            metadata={
                "user_id": "user_1",
                "plan_id": plan_id,
                "transaction_id": "tx_1",
            },
            amount_value="100.00",
            currency="RUB",
            paid=True,
        )

        await billing_service.process_payment_webhook(
            {
                "event_type": "payment.succeeded",
                "payment_id": "pay_sub_1",
                "status": "succeeded",
                "amount": "100.00",
                "currency": "RUB",
                "metadata": {
                    "user_id": "user_1",
                    "plan_id": plan_id,
                    "transaction_id": "tx_1",
                },
            }
        )

        subscription = Subscriptions.get_subscription_by_user_id("user_1")
        assert subscription is not None
        assert subscription.status in {
            SubscriptionStatus.ACTIVE.value,
            SubscriptionStatus.TRIALING.value,
        }
        first_period_end = subscription.current_period_end

        await billing_service.process_payment_webhook(
            {
                "event_type": "payment.succeeded",
                "payment_id": "pay_sub_1",
                "status": "succeeded",
                "amount": "100.00",
                "currency": "RUB",
                "metadata": {
                    "user_id": "user_1",
                    "plan_id": plan_id,
                    "transaction_id": "tx_1",
                },
            }
        )

        subscription_after = Subscriptions.get_subscription_by_user_id("user_1")
        assert subscription_after is not None
        assert subscription_after.current_period_end == first_period_end

        updated_tx = Transactions.get_transaction_by_id("tx_1")
        assert updated_tx is not None
        assert updated_tx.status == TransactionStatus.SUCCEEDED.value

    def test_yookassa_webhook_token_optional_but_enforced_when_configured(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        async def _noop_process_webhook(_: dict[str, object]) -> None:
            return None

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _noop_process_webhook,
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "secret_123")

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_1",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }

        response_missing = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )
        assert response_missing.status_code == 401

        response_wrong = self.fast_api_client.post(
            self.create_url("/webhook/yookassa?token=wrong"),
            json=payload,
        )
        assert response_wrong.status_code == 401

        response_ok = self.fast_api_client.post(
            self.create_url("/webhook/yookassa?token=secret_123"),
            json=payload,
        )
        assert response_ok.status_code == 200

    @pytest.mark.asyncio
    async def test_subscription_webhook_renews_from_now_if_expired(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PlanModel,
            Plans,
            SubscriptionModel,
            Subscriptions,
            SubscriptionStatus,
            TransactionModel,
            Transactions,
            TransactionStatus,
        )
        from open_webui.utils.billing import billing_service

        now = int(time.time())
        plan_id = "plan_sub_expired"
        Plans.create_plan(
            PlanModel(
                id=plan_id,
                name="Pro",
                price=100,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=0,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

        expired_end = now - 10
        expired_subscription = SubscriptionModel(
            id="sub_1",
            user_id="user_2",
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=expired_end - 30,
            current_period_end=expired_end,
            cancel_at_period_end=False,
            auto_renew=False,
            trial_end=None,
            last_payment_id=None,
            wallet_id=None,
            payment_method_id=None,
            next_plan_id=None,
            extra_metadata=None,
            created_at=now,
            updated_at=now,
        )
        Subscriptions.create_subscription(expired_subscription)

        transaction = TransactionModel(
            id="tx_expired",
            user_id="user_2",
            subscription_id=expired_subscription.id,
            amount=100,
            currency="RUB",
            status=TransactionStatus.PENDING.value,
            yookassa_payment_id="pay_sub_expired",
            yookassa_status="pending",
            description="Subscription: Pro",
            description_ru="Подписка: Pro",
            receipt_url=None,
            extra_metadata={"plan_id": plan_id},
            created_at=now,
            updated_at=now,
        )
        Transactions.create_transaction(transaction)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_sub_expired",
            status="succeeded",
            metadata={
                "user_id": "user_2",
                "plan_id": plan_id,
                "transaction_id": "tx_expired",
            },
            amount_value="100.00",
            currency="RUB",
            paid=True,
        )

        await billing_service.process_payment_webhook(
            {
                "event_type": "payment.succeeded",
                "payment_id": "pay_sub_expired",
                "status": "succeeded",
                "amount": "100.00",
                "currency": "RUB",
                "metadata": {
                    "user_id": "user_2",
                    "plan_id": plan_id,
                    "transaction_id": "tx_expired",
                },
            }
        )

        renewed = Subscriptions.get_subscription_by_id(expired_subscription.id)
        assert renewed is not None
        assert renewed.current_period_start >= now
        assert renewed.current_period_end - renewed.current_period_start == 30 * 24 * 60 * 60

    @pytest.mark.asyncio
    async def test_subscription_webhook_rejects_payment_id_mismatch(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        from open_webui.models.billing import (
            PlanModel,
            Plans,
            TransactionModel,
            Transactions,
            TransactionStatus,
        )
        from open_webui.utils.billing import WebhookVerificationError, billing_service

        now = int(time.time())
        plan_id = "plan_sub_2"
        Plans.create_plan(
            PlanModel(
                id=plan_id,
                name="Pro",
                price=100,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=0,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

        transaction = TransactionModel(
            id="tx_mismatch",
            user_id="user_1",
            subscription_id=None,
            amount=100,
            currency="RUB",
            status=TransactionStatus.PENDING.value,
            yookassa_payment_id="pay_expected",
            yookassa_status="pending",
            description="Subscription: Pro",
            description_ru="Подписка: Pro",
            receipt_url=None,
            extra_metadata={"plan_id": plan_id},
            created_at=now,
            updated_at=now,
        )
        Transactions.create_transaction(transaction)

        self._mock_yookassa_get_payment(
            monkeypatch,
            payment_id="pay_other",
            status="succeeded",
            metadata={
                "user_id": "user_1",
                "plan_id": plan_id,
                "transaction_id": "tx_mismatch",
            },
            amount_value="100.00",
            currency="RUB",
            paid=True,
        )

        with pytest.raises(WebhookVerificationError):
            await billing_service.process_payment_webhook(
                {
                    "event_type": "payment.succeeded",
                    "payment_id": "pay_other",
                    "status": "succeeded",
                    "amount": "100.00",
                    "currency": "RUB",
                    "metadata": {
                        "user_id": "user_1",
                        "plan_id": plan_id,
                        "transaction_id": "tx_mismatch",
                    },
                }
            )
