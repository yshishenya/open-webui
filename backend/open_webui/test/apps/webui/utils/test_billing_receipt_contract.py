"""Receipt contact, money and provider-envelope regression checks."""

from decimal import Decimal
from types import SimpleNamespace

import open_webui.utils.billing as billing
import pytest
from open_webui.utils.yookassa import YooKassaClient, YooKassaConfig


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('info', 'account_email', 'customer'),
    [
        ({}, 'account@example.com', {'email': 'account@example.com'}),
        ({'billing_contact_email': ' billing@example.com '}, 'account@example.com', {'email': 'billing@example.com'}),
        (
            {'billing_contact_email': ' ', 'billing_contact_phone': ' +79990000000 '},
            'account@example.com',
            {'email': 'account@example.com', 'phone': '+79990000000'},
        ),
        ({'billing_contact_phone': '+79990000000'}, '', {'phone': '+79990000000'}),
        (None, 'account@example.com', {'email': 'account@example.com'}),
    ],
)
async def test_receipt_contact_and_exact_money(
    monkeypatch: pytest.MonkeyPatch,
    info: dict[str, str] | None,
    account_email: str,
    customer: dict[str, str],
) -> None:
    async def get_user(user_id: str) -> SimpleNamespace:
        assert user_id == 'receipt-owner'
        return SimpleNamespace(info=info, email=account_email)

    monkeypatch.setattr(billing.Users, 'get_user_by_id', get_user)
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_ENABLED', True)
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_VAT_CODE', 1)
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_PAYMENT_MODE', 'full_payment')
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_PAYMENT_SUBJECT', 'service')
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_TAX_SYSTEM_CODE', None)
    receipt = await billing.BillingService()._build_receipt('receipt-owner', Decimal('500.01'), 'RUB', 'Top-up wallet')
    assert receipt == {
        'customer': customer,
        'items': [
            {
                'description': 'Top-up wallet',
                'quantity': '1.00',
                'amount': {'value': '500.01', 'currency': 'RUB'},
                'vat_code': 1,
                'payment_mode': 'full_payment',
                'payment_subject': 'service',
            }
        ],
    }
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_TAX_SYSTEM_CODE', 2)
    configured = await billing.BillingService()._build_receipt(
        'receipt-owner', Decimal('500.01'), 'RUB', 'Top-up wallet'
    )
    assert configured == {**receipt, 'tax_system_code': 2}


@pytest.mark.asyncio
@pytest.mark.parametrize('user', [None, SimpleNamespace(info={}, email=' ')])
async def test_missing_contact_rejected_and_disabled_receipt_skips_lookup(
    monkeypatch: pytest.MonkeyPatch, user: SimpleNamespace | None
) -> None:
    lookups: list[str] = []

    async def get_user(user_id: str) -> SimpleNamespace | None:
        lookups.append(user_id)
        return user

    monkeypatch.setattr(billing.Users, 'get_user_by_id', get_user)
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_ENABLED', False)
    service = billing.BillingService()
    assert await service._build_receipt('owner', Decimal('15.00'), 'RUB', '') is None
    assert lookups == []
    monkeypatch.setattr(billing, 'BILLING_RECEIPT_ENABLED', True)
    with pytest.raises(ValueError, match='Set billing contact email or phone'):
        await service._build_receipt('owner', Decimal('15.00'), 'RUB', '')
    assert lookups == ['owner']


@pytest.mark.asyncio
async def test_provider_receives_receipt_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    client = YooKassaClient(YooKassaConfig('local-only', 'local-only'))
    receipt: dict[str, object] = {
        'customer': {'email': 'buyer@example.com'},
        'items': [{'quantity': '1.00', 'amount': {'value': '500.01', 'currency': 'RUB'}}],
    }

    async def request(method: str, endpoint: str, data: dict[str, object], idempotence_key: str) -> dict[str, object]:
        assert (method, endpoint, idempotence_key) == ('POST', 'payments', 'receipt-contract')
        assert data['receipt'] is receipt
        assert data['amount'] == {'value': '500.01', 'currency': 'RUB'}
        return {'id': 'local-only', 'status': 'pending'}

    monkeypatch.setattr(client, '_request', request)
    assert await client.create_payment(Decimal('500.01'), receipt=receipt, idempotence_key='receipt-contract') == {
        'id': 'local-only',
        'status': 'pending',
    }
