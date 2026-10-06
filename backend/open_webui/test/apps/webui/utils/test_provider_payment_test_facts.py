"""Provider test flags survive persistence without changing wallet credit."""

from unittest.mock import AsyncMock

import pytest
from open_webui.internal.db import get_db
from open_webui.models.billing import LedgerEntry, Payments, Wallets
from open_webui.utils import billing
from open_webui.utils.airis import analytics_payments
from open_webui.utils.airis.billing_reporting_facts import payment_query
from test.apps.webui.utils.test_billing_service_webhook_statuses import (
    TestBillingServiceWebhookStatuses as WebhookCases,
)
from test.util.abstract_integration_test import AbstractPostgresTest


@pytest.mark.parametrize('flag', [True, False, None, 'false', 'true', 0, 1])
def test_sanitizers_preserve_only_provider_boolean(flag: object) -> None:
    service = billing.BillingService()
    for sanitize in [service._sanitize_payment_payload, service._sanitize_webhook_payload]:
        saved = sanitize({'test': flag})
        assert saved.get('test') is (flag if isinstance(flag, bool) else None)
    assert service._sanitize_webhook_payload({'test': flag}, {'test': True})['test'] is (
        flag if isinstance(flag, bool) else True
    )


class TestProviderFlags(AbstractPostgresTest):
    _create_topup_payment = WebhookCases._create_topup_payment
    _create_plan = WebhookCases._create_plan
    _create_transaction = WebhookCases._create_transaction

    @pytest.mark.asyncio
    @pytest.mark.parametrize('path', ['webhook', 'reconcile'])
    @pytest.mark.parametrize('flag', [True, False, None, 'false'])
    async def test_verified_flag_credit_replay_and_legacy_recovery(
        self, monkeypatch: pytest.MonkeyPatch, path: str, flag: object
    ) -> None:
        service = billing.BillingService()
        wallet = billing.wallet_service.get_or_create_wallet('user_1', 'RUB')
        payment_id = 'flag-provider'
        self._create_topup_payment(payment_id, wallet_id=wallet.id)

        class Provider:
            async def get_payment(self, provider_id: str) -> dict[str, object]:
                assert provider_id == payment_id
                result: dict[str, object] = {
                    'id': provider_id,
                    'status': 'succeeded',
                    'paid': True,
                    'amount': {'value': '10.00', 'currency': 'RUB'},
                    'metadata': {'kind': 'topup', 'wallet_id': wallet.id, 'user_id': 'user_1'},
                }
                if flag is not None:
                    result['test'] = flag
                return result

        monkeypatch.setattr(billing, 'get_yookassa_client', lambda: Provider())
        monkeypatch.setattr(analytics_payments, 'safely_record_confirmed_payment', AsyncMock())

        async def apply() -> None:
            if path == 'webhook':
                await service.process_payment_webhook(
                    {'payment_id': payment_id, 'event_type': 'payment.succeeded', 'test': flag is not True}
                )
            else:
                result = await service.reconcile_topup_payment('user_1', payment_id)
                assert result['credited'] is True

        await apply()
        saved = Payments.get_payment_by_provider_id(payment_id)
        assert saved.raw_payload_json.get('test') is (flag if isinstance(flag, bool) else None)
        # A provider read can repair the flag on a previously credited legacy row.
        Payments.update_payment_by_provider_id(payment_id, {'raw_payload_json': {}})
        await apply()
        saved = Payments.get_payment_by_provider_id(payment_id)
        assert saved.raw_payload_json.get('test') is (flag if isinstance(flag, bool) else None)
        await apply()
        if isinstance(flag, bool):
            known = flag
            flag = None
            await apply()
            assert Payments.get_payment_by_provider_id(payment_id).raw_payload_json['test'] is known
        current = Wallets.get_wallet_by_id(wallet.id)
        assert current.balance_topup_kopeks == 1000
        with get_db() as db:
            assert db.query(LedgerEntry).filter(LedgerEntry.reference_id == payment_id).count() == 1

    @pytest.mark.asyncio
    @pytest.mark.parametrize('flag', [True, False, None])
    async def test_subscription_flag_is_persisted_and_excluded_from_live_facts(
        self, monkeypatch: pytest.MonkeyPatch, flag: bool | None
    ) -> None:
        self._create_plan()
        self._create_transaction('flag-transaction', 'subscription-provider', extra_metadata={'plan_id': 'plan_1'})

        class Provider:
            async def get_payment(self, provider_id: str) -> dict[str, object]:
                return {
                    'id': provider_id,
                    'status': 'succeeded',
                    'paid': True,
                    'test': flag,
                    'amount': {'value': '100.00', 'currency': 'RUB'},
                    'metadata': {'transaction_id': 'flag-transaction', 'plan_id': 'plan_1', 'user_id': 'user_1'},
                }

        monkeypatch.setattr(billing, 'get_yookassa_client', lambda: Provider())
        service = billing.BillingService()
        for _ in range(2):
            await service.process_payment_webhook(
                {'payment_id': 'subscription-provider', 'event_type': 'payment.succeeded', 'test': flag is not True}
            )
        from open_webui.models.billing import Transactions

        saved = Transactions.get_transaction_by_id('flag-transaction')
        assert saved.extra_metadata['provider_test'] is flag
        assert saved.extra_metadata['plan_id'] == 'plan_1'
        with get_db() as db:
            rows = db.execute(payment_query(from_ts=1, to_ts=9999999999, currency='RUB', is_test=False)).all()
            assert len(rows) == (0 if flag is True else 1)
            assert db.query(LedgerEntry).filter(LedgerEntry.reference_id == 'flag-transaction').count() == 1
