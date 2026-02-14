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

    def test_yookassa_webhook_ip_allowlist_optional_but_enforced_when_enabled(
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
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", True)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TRUST_X_FORWARDED_FOR", True)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES", "")

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_1",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }

        response_bad = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={"X-Forwarded-For": "1.1.1.1"},
        )
        assert response_bad.status_code == 401

        response_ok = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={"X-Forwarded-For": "185.71.76.1"},
        )
        assert response_ok.status_code == 200

    def test_yookassa_webhook_trust_signature_required_when_secret_configured(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.config = type("Config", (), {"webhook_secret": "whsec"})()

            def verify_webhook(self, _: str, signature: str) -> bool:
                return signature == "valid_signature"

        async def _noop_process_webhook(_: dict[str, object]) -> None:
            return None

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _noop_process_webhook,
        )
        monkeypatch.setattr(
            billing_router,
            "get_yookassa_client",
            lambda: FakeYooKassaClient(),
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_sig_1",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }
        current_timestamp = str(int(time.time()))

        response_missing = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )
        assert response_missing.status_code == 401
        assert response_missing.json()["detail"] == "Missing signature"

        response_bad = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={
                "X-YooKassa-Signature": "bad_signature",
                "X-YooKassa-Timestamp": current_timestamp,
            },
        )
        assert response_bad.status_code == 401
        assert response_bad.json()["detail"] == "Invalid signature"

        response_stale = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={
                "X-YooKassa-Signature": "valid_signature",
                "X-YooKassa-Timestamp": "1",
            },
        )
        assert response_stale.status_code == 401
        assert (
            response_stale.json()["detail"]
            == "Signature timestamp is outside allowed window"
        )

        response_ok = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={
                "X-YooKassa-Signature": "valid_signature",
                "X-YooKassa-Timestamp": current_timestamp,
            },
        )
        assert response_ok.status_code == 200

    def test_yookassa_webhook_trust_replay_short_circuit_for_topup(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            PaymentStatus,
            Payments,
        )
        from open_webui.utils.wallet import wallet_service

        now = int(time.time())
        wallet = wallet_service.get_or_create_wallet("user_replay", "RUB")

        Payments.create_payment(
            PaymentModel(
                id="payment_replay",
                provider="yookassa",
                status=PaymentStatus.SUCCEEDED.value,
                kind=PaymentKind.TOPUP.value,
                amount_kopeks=10000,
                currency="RUB",
                idempotency_key="idem_replay",
                provider_payment_id="pay_replay_1",
                payment_method_id=None,
                status_details={"yookassa_status": "succeeded"},
                metadata_json={
                    "kind": PaymentKind.TOPUP.value,
                    "user_id": "user_replay",
                    "wallet_id": wallet.id,
                    "amount_kopeks": 10000,
                },
                raw_payload_json=None,
                user_id="user_replay",
                wallet_id=wallet.id,
                subscription_id=None,
                created_at=now,
                updated_at=now,
            )
        )

        async def _fail_if_called(_: dict[str, object]) -> None:
            raise AssertionError("process_payment_webhook should not run for replay")

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _fail_if_called,
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_replay_1",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {
                    "kind": PaymentKind.TOPUP.value,
                    "user_id": "user_replay",
                    "wallet_id": wallet.id,
                },
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "replayed": True}

    def test_yookassa_webhook_returns_503_for_retryable_processing_errors(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.billing import WebhookRetryableError

        async def _retryable(_: dict[str, object]) -> None:
            raise WebhookRetryableError("Provider status mismatch")

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _retryable,
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_retryable",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {"transaction_id": "tx_retryable"},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )
        assert response.status_code == 503
        assert response.json()["detail"] == "Temporary error processing webhook"

    def test_yookassa_webhook_rejects_invalid_body_encoding(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            data=b"\xff\xfe\xfd",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid request body encoding"

    def test_yookassa_webhook_rejects_invalid_json_payload(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            data="{invalid_json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid JSON payload"

    def test_yookassa_webhook_signature_with_unavailable_client_returns_503(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_sig_missing_client",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={
                "X-YooKassa-Signature": "sig",
                "X-YooKassa-Timestamp": str(int(time.time())),
            },
        )

        assert response.status_code == 503
        assert response.json()["detail"] == "Payment system temporarily unavailable"

    def test_yookassa_webhook_rejects_non_integer_signature_timestamp(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        class FakeYooKassaClient:
            def __init__(self) -> None:
                self.config = type("Config", (), {"webhook_secret": "whsec"})()

            def verify_webhook(self, _: str, signature: str) -> bool:
                return signature == "valid_signature"

        monkeypatch.setattr(
            billing_router,
            "get_yookassa_client",
            lambda: FakeYooKassaClient(),
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_bad_ts",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
            headers={
                "X-YooKassa-Signature": "valid_signature",
                "X-YooKassa-Timestamp": "not_an_int",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid signature timestamp"

    def test_yookassa_webhook_returns_400_on_parse_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        def _raise_parse_error(_: dict[str, object]) -> dict[str, object]:
            raise ValueError("bad webhook shape")

        monkeypatch.setattr(
            billing_router.YooKassaWebhookHandler,
            "parse_webhook",
            staticmethod(_raise_parse_error),
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_bad_parse",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid webhook payload"

    def test_yookassa_webhook_returns_400_on_verification_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router
        from open_webui.utils.billing import WebhookVerificationError

        async def _verification_error(_: dict[str, object]) -> None:
            raise WebhookVerificationError("verification failed")

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _verification_error,
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_verification_error",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {"transaction_id": "tx_123"},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Webhook verification failed"

    def test_yookassa_webhook_returns_500_on_unexpected_processing_error(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        async def _boom(_: dict[str, object]) -> None:
            raise RuntimeError("unexpected webhook failure")

        monkeypatch.setattr(
            billing_router.billing_service,
            "process_payment_webhook",
            _boom,
        )
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
        monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
        monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

        payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "pay_unexpected_error",
                "status": "succeeded",
                "amount": {"value": "100.00", "currency": "RUB"},
                "metadata": {"transaction_id": "tx_999"},
            },
        }

        response = self.fast_api_client.post(
            self.create_url("/webhook/yookassa"),
            json=payload,
        )

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to process webhook"

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
