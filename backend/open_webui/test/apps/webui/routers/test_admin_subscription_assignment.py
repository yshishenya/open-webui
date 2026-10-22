"""Regression checks for manual assignment versus verified paid activation."""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from _pytest.monkeypatch import MonkeyPatch
from open_webui.models.billing import (
    LedgerEntry,
    LedgerEntryType,
    PlanModel,
    Plans,
    SubscriptionModel,
    Subscriptions,
    TransactionModel,
    Transactions,
    UsageModel,
    UsageTracking,
    Wallets,
)
from open_webui.models.users import Users
from open_webui.utils.airis.subscription_policy import requires_next_term, subscription_terms
from open_webui.utils.billing import BillingService, WebhookRetryableError
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestAdminSubscriptionAssignment(AbstractPostgresTest):
    BASE_PATH = '/api/v1/admin/billing'

    def setup_method(self) -> None:
        super().setup_method()
        self.now = int(time.time())
        asyncio.run(
            Users.insert_new_user(
                id='assignment-user',
                name='Fixture',
                email='assignment@example.invalid',
                role='user',
                profile_image_url='/user.png',
            )
        )
        self.old = self.plan('old', 100)
        self.up = self.plan('up', 200)
        self.down = self.plan('down', 50)

    def plan(self, plan_id: str, requests: int | None) -> PlanModel:
        return Plans.create_plan(
            PlanModel(
                id=plan_id,
                name=plan_id,
                price=100,
                interval='month',
                quotas={'requests': requests},
                created_at=self.now,
                updated_at=self.now,
            ).model_dump()
        )

    def subscription(self, **changes: object) -> SubscriptionModel:
        data: dict[str, object] = {
            'id': 'assignment-sub',
            'user_id': 'assignment-user',
            'plan_id': 'old',
            'status': 'active',
            'current_period_start': self.now - 100,
            'current_period_end': self.now + 100,
            'created_at': self.now - 100,
            'updated_at': self.now - 100,
        }
        data.update(changes)
        sub = Subscriptions.create_subscription(SubscriptionModel.model_validate(data))
        UsageTracking.track_usage(
            UsageModel(
                id='already-used',
                user_id=sub.user_id,
                subscription_id=sub.id,
                metric='requests',
                amount=90,
                period_start=sub.current_period_start,
                period_end=sub.current_period_end,
                created_at=self.now - 1,
            )
        )
        return sub

    def test_upgrade_preserves_term_usage_cancellation_and_replay(self) -> None:
        before = self.subscription(cancel_at_period_end=True)
        with mock_webui_user(id='admin-fixture', role='admin'):
            payload = {'plan_id': 'up', 'reason': 'manual access approval'}
            first = self.fast_api_client.put(self.create_url('/users/assignment-user/subscription'), json=payload)
            assert first.status_code == 200, first.text
            assert (
                self.fast_api_client.put(
                    self.create_url('/users/assignment-user/subscription'), json=payload
                ).status_code
                == 200
            )
        after = Subscriptions.get_subscription_by_id(before.id)
        assert after.plan_id == 'up'
        assert (after.current_period_start, after.current_period_end) == (
            before.current_period_start,
            before.current_period_end,
        )
        assert after.cancel_at_period_end is True
        assert (
            UsageTracking.get_total_usage(
                after.user_id, after.current_period_start, after.current_period_end, 'requests'
            )
            == 90
        )
        assert Transactions.get_transactions_by_user(after.user_id) == []

    def test_scheduled_downgrade_replace_same_plan_noop_and_explicit_cancel(self) -> None:
        before = self.subscription()
        self.plan('another-down', 10)
        with mock_webui_user(id='admin-fixture', role='admin'):
            for target in ['down', 'another-down']:
                response = self.fast_api_client.put(
                    self.create_url('/users/assignment-user/subscription'),
                    json={'plan_id': target, 'reason': 'next term approval'},
                )
                assert response.status_code == 200, response.text
                result = response.json()
                assert result['plan']['id'] == result['subscription']['plan_id'] == 'old'
                assert result['scheduled_plan']['id'] == result['subscription']['next_plan_id'] == target
                saved = Subscriptions.get_subscription_by_id(before.id)
                assert saved.plan_id == 'old' and saved.next_plan_id == target
                assert saved.current_period_end == before.current_period_end
            same = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'), json={'plan_id': 'old'}
            )
            assert same.status_code == 200
            assert Subscriptions.get_subscription_by_id(before.id).next_plan_id == 'another-down'
            canceled = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={'plan_id': 'old', 'cancel_scheduled_change': True, 'reason': 'cancel queue only'},
            )
            assert canceled.status_code == 200, canceled.text
            assert canceled.json()['plan']['id'] == canceled.json()['subscription']['plan_id'] == 'old'
            assert canceled.json()['scheduled_plan'] is None
        saved = Subscriptions.get_subscription_by_id(before.id)
        assert saved.next_plan_id is None and saved.plan_id == 'old'
        assert (saved.current_period_start, saved.current_period_end) == (
            before.current_period_start,
            before.current_period_end,
        )

    @pytest.mark.parametrize(
        'field,metric', [('images_per_period', 'images'), ('tts_seconds_per_period', 'tts_seconds')]
    )
    def test_effective_quota_reduction_is_deferred(self, field: str, metric: str) -> None:
        Plans.update_plan_by_id('old', {field: 100, 'quotas': {metric: 10}})
        Plans.update_plan_by_id('up', {field: None, 'quotas': {metric: 20}})
        before = self.subscription()
        with mock_webui_user(id='admin-fixture', role='admin'):
            response = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={'plan_id': 'up', 'reason': 'effective 100 to 20'},
            )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result['plan']['id'] == result['subscription']['plan_id'] == 'old'
        assert result['scheduled_plan']['id'] == result['subscription']['next_plan_id'] == 'up'
        saved = Subscriptions.get_subscription_by_id(before.id)
        assert saved.current_period_end == before.current_period_end

    @pytest.mark.parametrize('status', ['active', 'canceled', 'past_due'])
    def test_no_unpaid_renewal_or_implicit_reactivation(self, status: str) -> None:
        before = self.subscription(status=status, current_period_end=self.now - 1, next_plan_id='down')
        with pytest.raises(ValueError, match='requires a verified payment'):
            BillingService().renew_subscription(before.id)
        with mock_webui_user(id='admin-fixture', role='admin'):
            rejected = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={'plan_id': 'up', 'reason': 'not an extension'},
            )
            assert rejected.status_code == 409
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()

    def test_reset_usage_and_missing_reason_rejected(self) -> None:
        before = self.subscription()
        with mock_webui_user(id='admin-fixture', role='admin'):
            for payload in [{'plan_id': 'up'}, {'plan_id': 'up', 'reset_usage': True, 'reason': 'not compensation'}]:
                assert (
                    self.fast_api_client.put(
                        self.create_url('/users/assignment-user/subscription'), json=payload
                    ).status_code
                    == 400
                )
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()

    def transaction(self, plan_id: str = 'down', **changes: object) -> TransactionModel:
        data: dict[str, object] = {
            'id': 'pending-purchase',
            'user_id': 'assignment-user',
            'amount': 100,
            'currency': 'RUB',
            'status': 'pending',
            'yookassa_payment_id': 'verified-payment',
            'extra_metadata': {'plan_id': plan_id, 'provider_idempotency_key': 'original-key'},
            'created_at': self.now,
            'updated_at': self.now,
        }
        data.update(changes)
        return Transactions.create_transaction(TransactionModel.model_validate(data))

    def test_pending_purchase_blocks_assignment_and_different_purchase(self) -> None:
        self.transaction()
        with mock_webui_user(id='admin-fixture', role='admin'):
            rejected = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={'plan_id': 'up', 'reason': 'must not race payment'},
            )
            assert rejected.status_code == 409
        service = BillingService()
        same = service._prepare_subscription_purchase('assignment-user', 'down', self.down, Decimal('100.00'))
        assert same.id == 'pending-purchase'
        assert same.extra_metadata['provider_idempotency_key'] == 'original-key'
        with pytest.raises(ValueError, match='must be checked'):
            service._prepare_subscription_purchase('assignment-user', 'up', self.up, Decimal('100.00'))

    def test_unknown_purchase_does_not_receive_a_replacement_key(self) -> None:
        self.transaction(created_at=self.now - 86401)
        with pytest.raises(ValueError, match='must be checked'):
            BillingService()._prepare_subscription_purchase('assignment-user', 'down', self.down, Decimal('100.00'))
        saved = Transactions.get_transaction_by_id('pending-purchase')
        assert saved.extra_metadata['provider_idempotency_key'] == 'original-key'

    def test_verified_renewal_applies_scheduled_plan_once(self) -> None:
        before = self.subscription(current_period_end=self.now - 1, next_plan_id='down')
        tx = self.transaction()
        service = BillingService()

        def apply() -> SubscriptionModel:
            return service._apply_subscription_payment(
                tx.id,
                'verified-payment',
                'succeeded',
                Decimal('100.00'),
                'RUB',
                {'plan_id': 'down', 'user_id': before.user_id},
                False,
            )

        first = apply()
        second = apply()
        assert first.plan_id == 'down' and first.next_plan_id is None
        assert first.current_period_start >= self.now
        assert first.model_dump() == second.model_dump()
        assert (
            UsageTracking.get_total_usage(
                before.user_id, before.current_period_start, before.current_period_end, 'requests'
            )
            == 90
        )

    def test_paid_webhook_cannot_overwrite_current_term(self) -> None:
        before = self.subscription()
        tx = self.transaction()
        BillingService()._apply_subscription_payment(
            tx.id, 'verified-payment', 'succeeded', Decimal('100.00'), 'RUB', {'plan_id': 'down'}, False
        )
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()
        saved = Transactions.get_transaction_by_id(tx.id)
        assert saved.status == 'pending' and saved.yookassa_status == 'succeeded'
        assert saved.extra_metadata['subscription_application_status'] == 'deferred'

    def test_deferred_payment_is_reachable_through_http_and_blocks_new_purchase(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as router
        import open_webui.utils.billing as billing
        from open_webui.utils.airis import analytics_payments

        Plans.update_plan_by_id('down', {'included_kopeks_per_period': 2500})
        before = self.subscription(cancel_at_period_end=True, next_plan_id='down')
        tx = self.transaction()
        metadata = {'transaction_id': tx.id, 'user_id': before.user_id, 'plan_id': 'down'}
        lookups: list[str] = []

        class Provider:
            async def get_payment(self, payment_id: str) -> dict[str, object]:
                lookups.append(payment_id)
                return {
                    'id': payment_id,
                    'status': 'succeeded',
                    'paid': True,
                    'amount': {'value': '100.00', 'currency': 'RUB'},
                    'metadata': metadata,
                }

            async def create_payment(self, **_: object) -> dict[str, object]:
                raise AssertionError('A captured deferred payment must never be charged again')

        async def no_analytics(_payment_id: str) -> None:
            return None

        provider = Provider()
        monkeypatch.setattr(router, 'get_yookassa_client', lambda: provider)
        monkeypatch.setattr(billing, 'get_yookassa_client', lambda: provider)
        monkeypatch.setattr(router, 'YOOKASSA_WEBHOOK_TOKEN', '')
        monkeypatch.setattr(router, 'YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST', False)
        monkeypatch.setattr(router, 'YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE', False)
        monkeypatch.setattr(analytics_payments, 'safely_record_confirmed_payment', no_analytics)
        payload = {
            'event': 'payment.succeeded',
            'object': {
                'id': 'verified-payment',
                'status': 'succeeded',
                'paid': True,
                'amount': {'value': '100.00', 'currency': 'RUB'},
                'metadata': metadata,
            },
        }
        endpoint = '/api/v1/billing/webhook/yookassa'
        for _ in range(2):
            response = self.fast_api_client.post(endpoint, json=payload)
            assert response.status_code == 200, response.text
        assert lookups == ['verified-payment', 'verified-payment']
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB') is None

        # A late create response/canceled observation cannot erase verified capture.
        for stale_status in ['pending', 'waiting_for_capture', 'canceled']:
            observed = BillingService()._record_subscription_provider_response(
                tx.id, 'verified-payment', stale_status, False
            )
            assert observed.yookassa_status == 'succeeded'
            assert observed.extra_metadata['subscription_application_status'] == 'deferred'

        fulfillment_time = before.current_period_end + 5
        monkeypatch.setattr(billing.time, 'time', lambda: fulfillment_time)
        with pytest.raises(ValueError, match='already paid'):
            BillingService()._prepare_subscription_purchase(before.user_id, 'down', self.down, Decimal('100.00'))
        with mock_webui_user(id='admin-fixture', role='admin'):
            assert (
                self.fast_api_client.put(
                    self.create_url('/users/assignment-user/subscription'),
                    json={'plan_id': 'up', 'reason': 'must not discard captured access'},
                ).status_code
                == 409
            )
        # No more provider callbacks: the real subscription read issues the paid
        # term from durable verified facts. Enable the route only in this test.
        monkeypatch.setattr(router, 'ENABLE_BILLING_SUBSCRIPTIONS', True)
        with mock_webui_user(id=before.user_id, role='user'):
            applied = self.fast_api_client.get('/api/v1/billing/subscription')
            assert applied.status_code == 200, applied.text
            assert applied.json()['plan_id'] == 'down'
            repeated_read = self.fast_api_client.get('/api/v1/billing/subscription')
            assert repeated_read.json() == applied.json()
        assert lookups == ['verified-payment', 'verified-payment']
        issued = Subscriptions.get_subscription_by_id(before.id)
        assert issued.plan_id == 'down' and issued.next_plan_id is None
        assert (issued.current_period_start, issued.current_period_end) == (
            fulfillment_time,
            fulfillment_time + 30 * 86400,
        )
        assert (
            UsageTracking.get_total_usage(
                before.user_id, before.current_period_start, before.current_period_end, 'requests'
            )
            == 90
        )
        replay = self.fast_api_client.post(endpoint, json=payload)
        assert replay.status_code == 200 and replay.json()['replayed'] is True
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == issued.model_dump()
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB').balance_included_kopeks == 2500

    @pytest.mark.parametrize(
        'payment_status,verified,application_status',
        [
            ('pending', True, 'deferred'),
            ('succeeded', False, 'deferred'),
            ('succeeded', True, 'review_required'),
        ],
    )
    def test_lazy_read_never_issues_unknown_or_review_required_payment(
        self,
        payment_status: str,
        verified: bool,
        application_status: str,
    ) -> None:
        before = self.subscription(current_period_end=self.now - 1, next_plan_id='down')
        tx = self.transaction(
            yookassa_status=payment_status,
            extra_metadata={
                'plan_id': 'down',
                'subscription_payment_verified': verified,
                'subscription_application_status': application_status,
                'subscription_deferred_until': self.now - 1,
            },
        )
        assert BillingService().get_user_subscription(before.user_id) is None
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()
        assert Transactions.get_transaction_by_id(tx.id).status == 'pending'
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB') is None

    def test_scheduled_plan_alone_never_starts_a_free_term(self) -> None:
        before = self.subscription(current_period_end=self.now - 1, next_plan_id='down')
        assert BillingService().get_user_subscription(before.user_id) is None
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()
        assert Transactions.get_transactions_by_user(before.user_id) == []

    def test_due_read_is_scoped_to_the_user(self, monkeypatch: MonkeyPatch) -> None:
        before = self.subscription()
        tx = self.transaction()
        BillingService()._apply_subscription_payment(
            tx.id,
            'verified-payment',
            'succeeded',
            Decimal('100.00'),
            'RUB',
            {'plan_id': 'down'},
            False,
        )
        monkeypatch.setattr('open_webui.utils.billing.time.time', lambda: before.current_period_end)
        assert BillingService().get_user_subscription('another-user') is None
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == before.model_dump()
        assert Transactions.get_transaction_by_id(tx.id).extra_metadata['subscription_application_status'] == 'deferred'

    def test_concurrent_due_reads_and_webhook_have_one_effect_postgres(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.internal.db import engine, get_db

        if engine.dialect.name != 'postgresql':
            pytest.skip('Row-lock concurrency requires PostgreSQL, not SQLite')
        Plans.update_plan_by_id('down', {'included_kopeks_per_period': 2500})
        before = self.subscription()
        tx = self.transaction()

        def apply() -> SubscriptionModel:
            return BillingService()._apply_subscription_payment(
                tx.id,
                'verified-payment',
                'succeeded',
                Decimal('100.00'),
                'RUB',
                {'plan_id': 'down'},
                False,
            )

        apply()
        monkeypatch.setattr('open_webui.utils.billing.time.time', lambda: before.current_period_end)
        barrier = Barrier(3)

        def fulfill(worker: int) -> SubscriptionModel:
            barrier.wait(timeout=10)
            return apply() if worker == 0 else BillingService().get_user_subscription(before.user_id)

        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(fulfill, [0, 1, 2]))
        assert all(result.model_dump() == results[0].model_dump() for result in results)
        assert results[0].current_period_start == before.current_period_end
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB').balance_included_kopeks == 2500
        with get_db() as db:
            assert (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_id == tx.id,
                    LedgerEntry.type == LedgerEntryType.SUBSCRIPTION_CREDIT.value,
                )
                .count()
                == 1
            )

    def test_legacy_credit_repair_preserves_schedule_and_cancellation(self) -> None:
        from open_webui.internal.db import get_db

        Plans.update_plan_by_id('old', {'included_kopeks_per_period': 2500})
        before = self.subscription(last_payment_id='verified-payment', cancel_at_period_end=True, next_plan_id='down')
        tx = self.transaction('old', status='succeeded', subscription_id=before.id)
        service = BillingService()
        for _ in range(2):
            repaired = service._apply_subscription_payment(
                tx.id,
                'verified-payment',
                'succeeded',
                Decimal('100.00'),
                'RUB',
                {'plan_id': 'old'},
                False,
            )
            assert repaired.current_period_start == before.current_period_start
            assert repaired.current_period_end == before.current_period_end
            assert repaired.next_plan_id == 'down' and repaired.cancel_at_period_end is True
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB').balance_included_kopeks == 2500
        with get_db() as db:
            assert (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_id == tx.id, LedgerEntry.type == LedgerEntryType.SUBSCRIPTION_CREDIT.value
                )
                .count()
                == 1
            )

    def test_late_old_success_after_new_purchase_cannot_replay_access(self, monkeypatch: MonkeyPatch) -> None:
        before = self.subscription(current_period_end=self.now - 1)
        old_tx = self.transaction('down')
        service = BillingService()
        first = service._apply_subscription_payment(
            old_tx.id,
            'verified-payment',
            'succeeded',
            Decimal('100.00'),
            'RUB',
            {'plan_id': 'down'},
            False,
        )
        monkeypatch.setattr('open_webui.utils.billing.time.time', lambda: first.current_period_end)
        newer_tx = service._prepare_subscription_purchase(before.user_id, 'up', self.up, Decimal('100.00'))
        newer = service._apply_subscription_payment(
            newer_tx.id,
            'newer-payment',
            'succeeded',
            Decimal('100.00'),
            'RUB',
            {'plan_id': 'up'},
            False,
        )
        Plans.update_plan_by_id('down', {'is_active': False})
        replay = service._apply_subscription_payment(
            old_tx.id,
            'verified-payment',
            'succeeded',
            Decimal('100.00'),
            'RUB',
            {'plan_id': 'down'},
            False,
        )
        assert replay.model_dump() == newer.model_dump()
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == newer.model_dump()

    @pytest.mark.parametrize('change', ['cancel', 'catalog'])
    def test_deferred_capture_requires_review_if_context_changes(self, monkeypatch: MonkeyPatch, change: str) -> None:
        before = self.subscription()
        tx = self.transaction(
            extra_metadata={
                'plan_id': 'down',
                'provider_idempotency_key': 'original-key',
                'subscription_terms': subscription_terms(self.down),
                'subscription_terms_source': 'checkout',
            }
        )
        service = BillingService()

        def apply() -> SubscriptionModel:
            return service._apply_subscription_payment(
                tx.id,
                'verified-payment',
                'succeeded',
                Decimal('100.00'),
                'RUB',
                {'plan_id': 'down'},
                False,
            )

        apply()
        if change == 'cancel':
            Subscriptions.update_subscription(before.id, {'status': 'canceled'})
        else:
            Plans.update_plan_by_id('down', {'included_kopeks_per_period': 9999})
        state = Subscriptions.get_subscription_by_id(before.id).model_dump()
        monkeypatch.setattr('open_webui.utils.billing.time.time', lambda: before.current_period_end)
        with pytest.raises(WebhookRetryableError, match='requires review'):
            apply()
        saved = Transactions.get_transaction_by_id(tx.id)
        assert saved.yookassa_status == 'succeeded'
        assert saved.extra_metadata['subscription_application_status'] == 'review_required'
        assert saved.extra_metadata['subscription_payment_verified'] is True
        assert Subscriptions.get_subscription_by_id(before.id).model_dump() == state
        assert Wallets.get_wallet_by_user(before.user_id, 'RUB') is None

    def test_purchase_after_assignment_is_rejected_before_provider(self) -> None:
        self.subscription()
        with pytest.raises(ValueError, match='active subscription'):
            BillingService()._prepare_subscription_purchase('assignment-user', 'up', self.up, Decimal('100.00'))

    def test_scheduled_plan_is_checked_before_creating_a_charge(self) -> None:
        self.subscription(current_period_end=self.now - 1, next_plan_id='down')
        with pytest.raises(ValueError, match='scheduled plan'):
            BillingService()._prepare_subscription_purchase('assignment-user', 'up', self.up, Decimal('100.00'))
        assert Transactions.get_transactions_by_user('assignment-user') == []

    def test_concurrent_purchases_share_one_pending_identity_postgres(self) -> None:
        from open_webui.internal.db import engine

        if engine.dialect.name != 'postgresql':
            pytest.skip('Row-lock concurrency requires PostgreSQL, not SQLite')
        barrier = Barrier(2)

        def reserve(_worker: int) -> TransactionModel:
            barrier.wait(timeout=10)
            return BillingService()._prepare_subscription_purchase(
                'assignment-user', 'down', self.down, Decimal('100.00')
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            first, second = list(pool.map(reserve, [1, 2]))
        assert first.id == second.id
        assert first.extra_metadata['provider_idempotency_key'] == second.extra_metadata['provider_idempotency_key']
        assert len(Transactions.get_transactions_by_user('assignment-user')) == 1

    def test_concurrent_purchase_and_manual_assignment_postgres(self) -> None:
        from open_webui.internal.db import engine

        if engine.dialect.name != 'postgresql':
            pytest.skip('Row-lock concurrency requires PostgreSQL, not SQLite')
        barrier = Barrier(2)

        def reserve() -> bool:
            barrier.wait(timeout=10)
            try:
                BillingService()._prepare_subscription_purchase('assignment-user', 'down', self.down, Decimal('100.00'))
                return True
            except ValueError:
                return False

        def assign() -> int:
            barrier.wait(timeout=10)
            return self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={'plan_id': 'up', 'reason': 'explicit new manual access'},
            ).status_code

        with mock_webui_user(id='admin-fixture', role='admin'):
            with ThreadPoolExecutor(max_workers=2) as pool:
                purchase, assignment = pool.submit(reserve), pool.submit(assign)
                bought, assigned = purchase.result(timeout=20), assignment.result(timeout=20)
        assert (bought, assigned) in [(True, 409), (False, 200)]

    def test_stale_pending_replacement_cannot_overwrite_a_newer_choice(self) -> None:
        before = self.subscription(next_plan_id='down')
        self.plan('other-down', 25)
        with mock_webui_user(id='admin-fixture', role='admin'):
            changed = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={
                    'plan_id': 'other-down',
                    'reason': 'newer choice',
                    'expected_next_plan_id': 'down',
                },
            )
            assert changed.status_code == 200
            stale = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={
                    'plan_id': 'down',
                    'reason': 'stale choice',
                    'expected_next_plan_id': 'down',
                },
            )
            assert stale.status_code == 409
            stale_cancel = self.fast_api_client.put(
                self.create_url('/users/assignment-user/subscription'),
                json={
                    'plan_id': 'old',
                    'reason': 'stale cancel',
                    'cancel_scheduled_change': True,
                    'expected_next_plan_id': 'down',
                },
            )
            assert stale_cancel.status_code == 409
        assert Subscriptions.get_subscription_by_id(before.id).next_plan_id == 'other-down'


@pytest.mark.parametrize(
    'changes',
    [
        {'quotas': {'requests': 50}},
        {'currency': 'USD'},
        {'interval': 'year'},
        {'features': []},
        {'included_kopeks_per_period': 5},
        {'images_per_period': 5},
        {'model_tiers_allowed': ['restricted']},
    ],
)
def test_rights_reductions_or_incomparable_terms_are_deferred(changes: dict[str, object]) -> None:
    old = PlanModel(
        id='old',
        name='Old',
        price=100,
        interval='month',
        quotas={'requests': None},
        features=['feature'],
        included_kopeks_per_period=10,
        created_at=1,
        updated_at=1,
    )
    new = PlanModel.model_validate({**old.model_dump(), **changes, 'id': 'new'})
    assert requires_next_term(old, new) is True


@pytest.mark.parametrize('field,metric', [('images_per_period', 'images'), ('tts_seconds_per_period', 'tts_seconds')])
@pytest.mark.parametrize(
    'old_limit,new_limit,old_generic,new_generic,reduction',
    [
        (100, None, 10, 20, True),
        (None, 20, 100, 10, True),
        (100, 200, 1000, 10, False),
        (None, 20, None, 100, True),
    ],
)
def test_effective_quota_precedence_matches_enforcement(
    field: str,
    metric: str,
    old_limit: int | None,
    new_limit: int | None,
    old_generic: int | None,
    new_generic: int | None,
    reduction: bool,
) -> None:
    from open_webui.utils.billing_integration import _subscription_quota_limits

    old = PlanModel.model_validate(
        {
            'id': 'old',
            'name': 'Old',
            'price': 100,
            'interval': 'month',
            'created_at': 1,
            'updated_at': 1,
            field: old_limit,
            'quotas': {metric: old_generic},
        }
    )
    new = PlanModel.model_validate({**old.model_dump(), 'id': 'new', field: new_limit, 'quotas': {metric: new_generic}})
    old_effective, new_effective = _subscription_quota_limits(old), _subscription_quota_limits(new)
    assert reduction == (
        metric in new_effective and (metric not in old_effective or new_effective[metric] < old_effective[metric])
    )
    assert requires_next_term(old, new) is reduction


def test_invalid_legacy_quota_to_finite_is_a_reduction() -> None:
    from open_webui.utils.billing_integration import _subscription_quota_limits

    old = PlanModel(
        id='old', name='Old', price=100, interval='month', quotas={'requests': -1}, created_at=1, updated_at=1
    )
    new = old.model_copy(update={'id': 'new', 'quotas': {'requests': 10}})
    assert _subscription_quota_limits(old) == {}
    assert _subscription_quota_limits(new) == {'requests': 10}
    assert requires_next_term(old, new) is True
