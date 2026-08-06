import asyncio
import time
import uuid
from test.util.abstract_integration_test import AbstractPostgresTest

import pytest
from _pytest.monkeypatch import MonkeyPatch
from open_webui.models.billing import UsageEventModel


class TestBillingIntegrity(AbstractPostgresTest):
    @staticmethod
    def _usage_event(
        wallet_id: str,
        user_id: str,
        operation_id: str,
        correlation_id: str,
        model_id: str = 'billing-test-model',
        charged_kopeks: int = 200,
    ) -> UsageEventModel:
        return UsageEventModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            wallet_id=wallet_id,
            request_id=operation_id,
            correlation_id=correlation_id,
            model_id=model_id,
            modality='text',
            measured_units_json={'prompt_tokens': 1, 'completion_tokens': 1},
            prompt_tokens=1,
            completion_tokens=1,
            cost_raw_kopeks=charged_kopeks,
            cost_charged_kopeks=charged_kopeks,
            created_at=int(time.time()),
        )

    def test_client_correlation_id_cannot_replay_financial_operation(self) -> None:
        from open_webui.internal.db import get_db
        from open_webui.models.billing import LedgerEntry, LedgerEntryType, UsageEvent
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet('correlation-user', 'RUB')
        wallet_service.apply_topup(wallet.id, 2000, 'topup', 'test')
        correlation_id = 'client-controlled-id'

        for operation_id in ('server-operation-1', 'server-operation-2'):
            wallet_service.hold_funds(
                wallet.id,
                500,
                operation_id,
                'chat_completion',
                correlation_id=correlation_id,
            )
            wallet_service.settle_hold(
                wallet.id,
                operation_id,
                'chat_completion',
                200,
                usage_event=self._usage_event(
                    wallet.id,
                    'correlation-user',
                    operation_id,
                    correlation_id,
                ),
            )

        with get_db() as db:
            assert db.query(LedgerEntry).filter(LedgerEntry.type == LedgerEntryType.CHARGE.value).count() == 2
            assert db.query(UsageEvent).count() == 2
            assert {event.correlation_id for event in db.query(UsageEvent).all()} == {correlation_id}

    def test_ledger_idempotency_is_scoped_to_wallet(self) -> None:
        from open_webui.utils.wallet import wallet_service

        first = wallet_service.get_or_create_wallet('wallet-scope-1', 'RUB')
        second = wallet_service.get_or_create_wallet('wallet-scope-2', 'RUB')

        for wallet in (first, second):
            wallet_service.apply_topup(
                wallet.id,
                1000,
                'shared-reference',
                'test',
                idempotency_key='shared-idempotency-key',
            )

        assert wallet_service.refresh_wallet(first.id).balance_topup_kopeks == 1000
        assert wallet_service.refresh_wallet(second.id).balance_topup_kopeks == 1000

    def test_settlement_rolls_back_wallet_when_usage_conflicts(self) -> None:
        from open_webui.models.billing import UsageEvents
        from open_webui.utils.wallet import WalletError, wallet_service

        wallet = wallet_service.get_or_create_wallet('rollback-user', 'RUB')
        wallet_service.apply_topup(wallet.id, 1000, 'topup', 'test')
        wallet_service.hold_funds(
            wallet.id,
            500,
            'rollback-operation',
            'chat_completion',
        )
        UsageEvents.create_usage_event(
            self._usage_event(
                wallet.id,
                'rollback-user',
                'rollback-operation',
                'correlation',
                model_id='conflicting-model',
                charged_kopeks=1,
            )
        )

        with pytest.raises(WalletError):
            wallet_service.settle_hold(
                wallet.id,
                'rollback-operation',
                'chat_completion',
                200,
                usage_event=self._usage_event(
                    wallet.id,
                    'rollback-user',
                    'rollback-operation',
                    'correlation',
                ),
            )

        refreshed = wallet_service.refresh_wallet(wallet.id)
        assert refreshed.balance_topup_kopeks == 500
        assert refreshed.daily_reserved_kopeks == 500
        assert refreshed.daily_spent_kopeks == 0

    def test_expired_hold_releases_and_daily_cap_counts_live_holds(self) -> None:
        from open_webui.utils.wallet import (
            DailyCapExceededError,
            wallet_service,
        )

        wallet = wallet_service.get_or_create_wallet('hold-user', 'RUB')
        wallet_service.apply_topup(wallet.id, 2000, 'topup', 'test')
        wallet_service.hold_funds(
            wallet.id,
            500,
            'expired-operation',
            'chat_completion',
            hold_expires_at=int(time.time()) - 1,
        )
        refreshed = wallet_service.refresh_wallet(wallet.id)
        assert refreshed.balance_topup_kopeks == 2000
        assert refreshed.daily_reserved_kopeks == 0

        wallet_service.hold_funds(
            wallet.id,
            600,
            'daily-operation-1',
            'chat_completion',
            daily_cap_kopeks=1000,
        )
        with pytest.raises(DailyCapExceededError):
            wallet_service.hold_funds(
                wallet.id,
                500,
                'daily-operation-2',
                'chat_completion',
                daily_cap_kopeks=1000,
            )

    def test_topup_credit_failure_is_retryable(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils
        from open_webui.models.billing import (
            PaymentKind,
            PaymentModel,
            Payments,
            PaymentStatus,
        )
        from open_webui.utils.billing import BillingService, WebhookRetryableError
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet('retry-user', 'RUB')
        now = int(time.time())
        Payments.create_payment(
            PaymentModel(
                id='retry-payment',
                provider='yookassa',
                status=PaymentStatus.PENDING.value,
                kind=PaymentKind.TOPUP.value,
                amount_kopeks=1500,
                currency='RUB',
                idempotency_key='retry-idempotency',
                provider_payment_id='provider-retry-payment',
                metadata_json={'kind': 'topup'},
                user_id='retry-user',
                wallet_id=wallet.id,
                created_at=now,
                updated_at=now,
            )
        )

        def fail_credit(**_: object) -> None:
            raise RuntimeError('database unavailable')

        monkeypatch.setattr(billing_utils.wallet_service, 'apply_topup', fail_credit)
        with pytest.raises(WebhookRetryableError):
            BillingService()._process_topup_webhook(
                'payment.succeeded',
                'provider-retry-payment',
                {
                    'amount': '15.00',
                    'currency': 'RUB',
                    'status': 'succeeded',
                    'metadata': {'kind': 'topup'},
                },
            )
        payment = Payments.get_payment_by_provider_id('provider-retry-payment')
        assert payment is not None
        assert payment.status == 'pending'

    @pytest.mark.asyncio
    async def test_concurrent_auto_topup_uses_one_provider_call(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils
        from open_webui.models.billing import PaymentKind, Payments, PaymentStatus
        from open_webui.utils.billing import BillingService
        from open_webui.utils.wallet import wallet_service

        calls: list[str] = []

        class FakeYooKassaClient:
            async def create_payment(self, **kwargs: object) -> dict[str, object]:
                calls.append(str(kwargs['idempotence_key']))
                await asyncio.sleep(0.05)
                return {
                    'id': 'provider-auto-payment',
                    'status': 'pending',
                    'payment_method': {'id': 'saved-method'},
                }

        monkeypatch.setattr(billing_utils, 'get_yookassa_client', lambda: FakeYooKassaClient())
        monkeypatch.setattr(billing_utils, 'BILLING_TOPUP_PACKAGES_KOPEKS', [1500])
        monkeypatch.setattr(billing_utils, 'BILLING_RECEIPT_ENABLED', False)
        wallet = wallet_service.get_or_create_wallet('auto-claim-user', 'RUB')
        service = BillingService()

        await asyncio.gather(
            service.create_auto_topup_payment('auto-claim-user', wallet.id, 1500, 'saved-method', 'low_balance'),
            service.create_auto_topup_payment('auto-claim-user', wallet.id, 1500, 'saved-method', 'low_balance'),
        )

        assert len(calls) == 1
        payments = Payments.list_payments_by_wallet(
            wallet.id,
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
        )
        assert len(payments) == 1
        assert payments[0].provider_payment_id == 'provider-auto-payment'

    @pytest.mark.asyncio
    async def test_subscription_switches_to_purchased_plan_and_credits_once(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.utils.billing as billing_utils
        from open_webui.models.billing import (
            PlanModel,
            Plans,
            SubscriptionModel,
            Subscriptions,
            TransactionModel,
            Transactions,
            TransactionStatus,
            Wallets,
        )
        from open_webui.utils.billing import BillingService

        now = int(time.time())
        for plan_id, included in (('old-plan', 0), ('purchased-plan', 2500)):
            Plans.create_plan(
                PlanModel(
                    id=plan_id,
                    name=plan_id,
                    price=100,
                    price_kopeks=10000,
                    currency='RUB',
                    interval='month',
                    included_kopeks_per_period=included,
                    quotas={},
                    features=[],
                    created_at=now,
                    updated_at=now,
                ).model_dump()
            )
        Subscriptions.create_subscription(
            SubscriptionModel(
                id='existing-subscription',
                user_id='subscription-user',
                plan_id='old-plan',
                status='active',
                current_period_start=now,
                current_period_end=now + 86400,
                created_at=now,
                updated_at=now,
            )
        )
        Transactions.create_transaction(
            TransactionModel(
                id='subscription-transaction',
                user_id='subscription-user',
                amount=100,
                currency='RUB',
                status=TransactionStatus.PENDING.value,
                yookassa_payment_id='subscription-payment',
                extra_metadata={'plan_id': 'purchased-plan'},
                created_at=now,
                updated_at=now,
            )
        )

        class FakeYooKassaClient:
            async def get_payment(self, payment_id: str) -> dict[str, object]:
                return {
                    'id': payment_id,
                    'status': 'succeeded',
                    'paid': True,
                    'amount': {'value': '100.00', 'currency': 'RUB'},
                    'metadata': {
                        'transaction_id': 'subscription-transaction',
                        'user_id': 'subscription-user',
                        'plan_id': 'purchased-plan',
                    },
                }

        monkeypatch.setattr(billing_utils, 'get_yookassa_client', lambda: FakeYooKassaClient())
        service = BillingService()
        payload = {
            'event_type': 'payment.succeeded',
            'payment_id': 'subscription-payment',
        }
        first = await service.process_payment_webhook(payload)
        second = await service.process_payment_webhook(payload)

        assert first is not None and second is not None
        assert first.plan_id == second.plan_id == 'purchased-plan'
        wallet = Wallets.get_wallet_by_user('subscription-user', 'RUB')
        assert wallet is not None
        assert wallet.balance_included_kopeks == 2500
