"""Verified financial facts for the consent-bound product funnel.

The billing ledger remains authoritative. Recovery uses keyset pagination and
never invents a purchase from a browser callback or unverified notification.
"""

import datetime as dt
import logging
from decimal import Decimal, InvalidOperation

from open_webui.internal.db import get_async_db
from open_webui.models.analytics import AnalyticsIdentity
from open_webui.models.analytics_refunds import AnalyticsFirstPayment, AnalyticsRefund
from open_webui.models.billing import LedgerEntry, LedgerEntryType, Payment, PaymentKind, PaymentStatus
from open_webui.utils.yookassa import get_yookassa_client
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import Select

log = logging.getLogger(__name__)
PaymentCursor = tuple[int, str]


def _refund_amount(value: object) -> int:
    """Reject fractional kopeks, non-finite values, and non-positive refunds."""
    if not isinstance(value, str):
        raise ValueError('Refund amount missing')
    try:
        amount = Decimal(value) * 100
        if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
            raise ValueError('Invalid refund amount')
        return int(amount)
    except InvalidOperation as exc:
        raise ValueError('Invalid refund amount') from exc


def _provider_timestamp(value: object) -> int:
    if not isinstance(value, str):
        raise ValueError('Refund creation time missing')
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError('Refund creation time needs timezone')
        return int(parsed.timestamp())
    except (ValueError, OverflowError) as exc:
        raise ValueError('Invalid refund creation time') from exc


def _confirmed_query() -> Select:
    return (
        select(Payment, LedgerEntry)
        .join(
            LedgerEntry,
            and_(
                LedgerEntry.reference_id == Payment.provider_payment_id,
                LedgerEntry.reference_type == 'payment',
                LedgerEntry.type == LedgerEntryType.TOPUP.value,
                LedgerEntry.wallet_id == Payment.wallet_id,
                LedgerEntry.user_id == Payment.user_id,
            ),
        )
        .where(
            Payment.status == PaymentStatus.SUCCEEDED.value,
            Payment.kind == PaymentKind.TOPUP.value,
            Payment.provider == 'yookassa',
        )
    )


async def record_confirmed_payment(provider_payment_id: str) -> bool:
    """Record a ledger-backed purchase once; a recovery sweep repairs gaps."""
    from open_webui.utils.airis.analytics import enabled_at, record_account_event

    async with get_async_db() as db:
        row = (await db.execute(_confirmed_query().where(Payment.provider_payment_id == provider_payment_id))).first()
        if row is None:
            return False
        payment, ledger = row
        # Same lock as wallet credit prevents a concurrent payment from changing
        # classification while this user's event is being persisted.
        from open_webui.models.billing import Wallet

        await db.execute(select(Wallet).where(Wallet.id == payment.wallet_id).with_for_update())
        payment_user_id = str(payment.user_id)
        payment_local_id = str(payment.id)
        payment_amount = int(payment.amount_kopeks)
        payment_currency = str(payment.currency)
        payment_auto = str((payment.metadata_json or {}).get('auto_topup', '')).lower() in {'true', '1'}
        ledger_time = int(ledger.created_at)
        marker = await db.get(AnalyticsFirstPayment, payment_user_id)
        first = (
            await db.execute(
                select(Payment, LedgerEntry)
                .join(
                    LedgerEntry,
                    and_(
                        LedgerEntry.reference_id == Payment.provider_payment_id,
                        LedgerEntry.reference_type == 'payment',
                        LedgerEntry.type == LedgerEntryType.TOPUP.value,
                        LedgerEntry.wallet_id == Payment.wallet_id,
                        LedgerEntry.user_id == Payment.user_id,
                    ),
                )
                .where(
                    Payment.user_id == payment.user_id,
                    Payment.provider == 'yookassa',
                    Payment.kind == PaymentKind.TOPUP.value,
                )
                .order_by(LedgerEntry.created_at, Payment.id)
                .limit(1)
            )
        ).first()
        if marker is None and first is not None:
            marker = AnalyticsFirstPayment(
                user_id=payment.user_id, payment_id=first[0].id, occurred_at=int(first[1].created_at)
            )
            # Unique user key also resolves a race between different currency wallets.
            try:
                async with db.begin_nested():
                    db.add(marker)
                    await db.flush()
                await db.commit()
            except IntegrityError:
                await db.rollback()
                marker = await db.get(AnalyticsFirstPayment, payment_user_id)
                if marker is None:
                    raise
            # Financial marker survives analytics consent revocation and failures.
        is_first = marker is not None and marker.payment_id == payment_local_id
        if enabled_at() <= 0 or ledger_time < enabled_at():
            return False
        properties: dict[str, str | int | bool] = {
            'payment_id': payment_local_id,
            'amount_kopeks': payment_amount,
            'currency': payment_currency,
            'is_first_payment': is_first,
            'auto_topup': payment_auto,
        }
        recorded = await record_account_event(
            payment_user_id,
            'payment_confirmed',
            f'payment_confirmed:{payment_local_id}',
            properties,
            occurred_at=ledger_time,
            db=db,
        )
        if is_first:
            await record_account_event(
                payment_user_id,
                'first_payment_confirmed',
                'first_payment_confirmed',
                properties,
                occurred_at=ledger_time,
                db=db,
            )
        await db.commit()
        return recorded


async def repair_confirmed_payments(
    cursor: PaymentCursor | None = None,
    batch_size: int = 100,
) -> PaymentCursor | None:
    """Repair one bounded page; None marks a complete sweep.

    The core consent/activation gate rejects facts preceding either cutoff.
    Only users with active consent are scanned. Start a fresh sweep regularly
    so a concurrent status transition or a crashed hook is eventually repaired.
    """
    from open_webui.utils.airis.analytics import enabled_at

    if enabled_at() <= 0:
        return None
    batch_size = max(1, min(batch_size, 500))
    async with get_async_db() as db:
        query = (
            _confirmed_query()
            .join(
                AnalyticsIdentity,
                AnalyticsIdentity.user_id == Payment.user_id,
            )
            .where(
                AnalyticsIdentity.consent.is_(True),
                LedgerEntry.created_at >= AnalyticsIdentity.granted_at,
                LedgerEntry.created_at >= enabled_at(),
            )
        )
        if cursor is not None:
            query = query.where(
                or_(
                    LedgerEntry.created_at > cursor[0],
                    and_(LedgerEntry.created_at == cursor[0], Payment.id > cursor[1]),
                )
            )
        rows = (await db.execute(query.order_by(LedgerEntry.created_at, Payment.id).limit(batch_size))).all()
        page = [(str(payment.provider_payment_id), int(ledger.created_at), str(payment.id)) for payment, ledger in rows]
    for provider_id, _, _ in page:
        await record_confirmed_payment(provider_id)
    if len(page) < batch_size:
        return None
    _, timestamp, payment_id = page[-1]
    return timestamp, payment_id


async def record_verified_refund(refund_id: str, provider_payment_id: str) -> bool:
    """Fetch and verify a provider refund; never mutate wallet balances."""
    client = get_yookassa_client()
    if client is None:
        raise RuntimeError('YooKassa client not initialized')
    refund = await client.get_refund(refund_id)
    if not isinstance(refund, dict) or refund.get('id') != refund_id or refund.get('payment_id') != provider_payment_id:
        raise ValueError('Refund payment mismatch')
    if refund.get('status') != 'succeeded':
        raise RuntimeError('Refund not confirmed by provider')
    amount_object = refund.get('amount')
    if not isinstance(amount_object, dict):
        raise ValueError('Refund amount missing')
    amount = _refund_amount(amount_object.get('value'))
    currency = amount_object.get('currency')
    occurred_at = _provider_timestamp(refund.get('created_at'))
    async with get_async_db() as db:
        payment = (
            await db.execute(
                select(Payment).where(
                    Payment.provider_payment_id == provider_payment_id,
                    Payment.provider == 'yookassa',
                    Payment.status == PaymentStatus.SUCCEEDED.value,
                )
            )
        ).scalar_one_or_none()
        if payment is None:
            raise RuntimeError('Original successful payment not found')
        if currency != payment.currency or amount > payment.amount_kopeks:
            raise ValueError('Refund amount or currency mismatch')
        # Serialize cumulative refund verification on the original payment.
        await db.execute(select(Payment).where(Payment.id == payment.id).with_for_update())
        existing = await db.get(AnalyticsRefund, refund_id)
        if existing is not None:
            if existing.payment_id != payment.id or existing.amount_kopeks != amount or existing.currency != currency:
                raise ValueError('Refund identifier reused with different facts')
        else:
            refunded = (
                await db.execute(
                    select(func.coalesce(func.sum(AnalyticsRefund.amount_kopeks), 0)).where(
                        AnalyticsRefund.payment_id == payment.id,
                    )
                )
            ).scalar_one()
            if refunded + amount > payment.amount_kopeks:
                raise ValueError('Refund total exceeds original payment')
            db.add(
                AnalyticsRefund(
                    id=refund_id,
                    payment_id=payment.id,
                    user_id=payment.user_id,
                    amount_kopeks=amount,
                    currency=payment.currency,
                    occurred_at=occurred_at,
                )
            )
            await db.commit()
    return await record_confirmed_refund(refund_id)


async def record_confirmed_refund(refund_id: str) -> bool:
    """Emit a verified persisted refund only when current consent permits it."""
    from open_webui.utils.airis.analytics import enabled_at, record_account_event

    if enabled_at() <= 0:
        return False
    async with get_async_db() as db:
        refund = await db.get(AnalyticsRefund, refund_id)
        if refund is None or refund.occurred_at < enabled_at():
            return False
        recorded = await record_account_event(
            refund.user_id,
            'refund_confirmed',
            f'refund_confirmed:{refund.id}',
            {
                'payment_id': refund.payment_id,
                'refund_id': refund.id,
                'amount_kopeks': int(refund.amount_kopeks),
                'currency': refund.currency,
            },
            occurred_at=int(refund.occurred_at),
            db=db,
        )
        await db.commit()
        return recorded


async def repair_confirmed_refunds(cursor: PaymentCursor | None = None, batch_size: int = 100) -> PaymentCursor | None:
    """Repair verified refunds after a crash between persistence and enqueue."""
    from open_webui.utils.airis.analytics import enabled_at

    if enabled_at() <= 0:
        return None
    batch_size = max(1, min(batch_size, 500))
    async with get_async_db() as db:
        query = (
            select(AnalyticsRefund)
            .join(
                AnalyticsIdentity,
                AnalyticsIdentity.user_id == AnalyticsRefund.user_id,
            )
            .where(
                AnalyticsIdentity.consent.is_(True),
                AnalyticsRefund.occurred_at >= AnalyticsIdentity.granted_at,
                AnalyticsRefund.occurred_at >= enabled_at(),
            )
        )
        if cursor is not None:
            query = query.where(
                or_(
                    AnalyticsRefund.occurred_at > cursor[0],
                    and_(AnalyticsRefund.occurred_at == cursor[0], AnalyticsRefund.id > cursor[1]),
                )
            )
        rows = (
            (await db.execute(query.order_by(AnalyticsRefund.occurred_at, AnalyticsRefund.id).limit(batch_size)))
            .scalars()
            .all()
        )
        page = [(str(row.id), int(row.occurred_at)) for row in rows]
    for refund_id, _ in page:
        await record_confirmed_refund(refund_id)
    if len(page) < batch_size:
        return None
    return page[-1][1], page[-1][0]


async def safely_record_confirmed_payment(provider_payment_id: str) -> None:
    """Analytics outages cannot change a successfully credited payment."""
    try:
        await record_confirmed_payment(provider_payment_id)
    except Exception:
        log.exception('Financial analytics hook failed; recovery will retry')


async def record_created_payment(local_payment_id: str) -> bool:
    """A payment attempt exists only after provider creation was persisted."""
    from open_webui.utils.airis.analytics import enabled_at, record_account_event

    if enabled_at() <= 0:
        return False
    async with get_async_db() as db:
        payment = await db.get(Payment, local_payment_id)
        if (
            payment is None
            or not payment.provider_payment_id
            or payment.provider != 'yookassa'
            or payment.kind != PaymentKind.TOPUP.value
        ):
            return False
        result = await record_account_event(
            payment.user_id,
            'payment_created',
            f'payment_created:{payment.id}',
            {'payment_id': payment.id, 'amount_kopeks': int(payment.amount_kopeks), 'currency': payment.currency},
            occurred_at=int(payment.created_at),
            db=db,
        )
        await db.commit()
        return result


async def safely_record_created_payment(local_payment_id: str) -> None:
    try:
        await record_created_payment(local_payment_id)
    except Exception:
        log.exception('Payment creation analytics failed; recovery will retry')


async def repair_created_payments(cursor: PaymentCursor | None = None, batch_size: int = 100) -> PaymentCursor | None:
    from open_webui.utils.airis.analytics import enabled_at

    if enabled_at() <= 0:
        return None
    batch_size = max(1, min(batch_size, 500))
    async with get_async_db() as db:
        query = (
            select(Payment)
            .join(AnalyticsIdentity, AnalyticsIdentity.user_id == Payment.user_id)
            .where(
                AnalyticsIdentity.consent.is_(True),
                Payment.created_at >= AnalyticsIdentity.granted_at,
                Payment.created_at >= enabled_at(),
                Payment.provider == 'yookassa',
                Payment.kind == PaymentKind.TOPUP.value,
                Payment.provider_payment_id.is_not(None),
            )
        )
        if cursor is not None:
            query = query.where(
                or_(Payment.created_at > cursor[0], and_(Payment.created_at == cursor[0], Payment.id > cursor[1]))
            )
        rows = (await db.execute(query.order_by(Payment.created_at, Payment.id).limit(batch_size))).scalars().all()
        page = [(str(row.id), int(row.created_at)) for row in rows]
    for payment_id, _ in page:
        await record_created_payment(payment_id)
    return None if len(page) < batch_size else (page[-1][1], page[-1][0])
