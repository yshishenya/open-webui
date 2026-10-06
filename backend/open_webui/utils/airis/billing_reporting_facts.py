"""Canonical read-only payment facts and SQL aggregation, independent of page limits."""

from dataclasses import dataclass

from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing_models import Transaction
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.users import User
from sqlalchemy import BigInteger, and_, case, cast, func, literal, or_, select, union_all
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import Subquery


@dataclass(frozen=True)
class PaymentFact:
    id: str
    user_id: str
    kind: str
    status: str
    amount_kopeks: int
    currency: str
    provider: str
    provider_payment_id: str | None
    processed_at: int
    source: str
    wallet_id: str | None
    subscription_id: str | None
    name: str | None = None
    created_at: int = 0
    credited_at: int | None = None
    credit_status: str = 'not_credited'
    refunded_kopeks: int = 0
    is_test: bool | None = None


def payment_table() -> Subquery:
    """Canonicalize duplicate legacy subscriptions before filtering dates or pages."""
    credited = (
        select(
            LedgerEntry.reference_id.label('provider_id'),
            LedgerEntry.wallet_id,
            LedgerEntry.user_id,
            LedgerEntry.currency,
            LedgerEntry.amount_kopeks,
            func.min(LedgerEntry.created_at).label('credited_at'),
        )
        .where(LedgerEntry.type == 'topup', LedgerEntry.reference_type == 'payment')
        .group_by(
            LedgerEntry.reference_id,
            LedgerEntry.wallet_id,
            LedgerEntry.user_id,
            LedgerEntry.currency,
            LedgerEntry.amount_kopeks,
        )
        .subquery()
    )
    refunds = (
        select(AnalyticsRefund.payment_id, func.sum(AnalyticsRefund.amount_kopeks).label('refunded_kopeks'))
        .group_by(AnalyticsRefund.payment_id)
        .subquery()
    )
    topup = and_(
        Payment.kind == 'topup',
        Payment.status == 'succeeded',
        Payment.provider == 'yookassa',
        credited.c.credited_at.is_not(None),
    )
    credit_state = case((topup, 'credited'), (Payment.kind == 'topup', 'not_credited'), else_='not_applicable')
    stamp = case((topup, credited.c.credited_at), else_=func.coalesce(Payment.updated_at, Payment.created_at))
    payments = (
        select(
            Payment.id,
            Payment.user_id,
            Payment.kind,
            Payment.status,
            Payment.amount_kopeks,
            Payment.currency,
            Payment.provider,
            Payment.provider_payment_id,
            stamp.label('processed_at'),
            literal('billing_payment').label('source'),
            Payment.wallet_id,
            Payment.subscription_id,
            User.name,
            Payment.created_at,
            credited.c.credited_at,
            credit_state.label('credit_status'),
            func.coalesce(refunds.c.refunded_kopeks, 0).label('refunded_kopeks'),
            Payment.raw_payload_json['test'].as_boolean().label('is_test'),
        )
        .outerjoin(User, User.id == Payment.user_id)
        .outerjoin(
            credited,
            and_(
                credited.c.provider_id == Payment.provider_payment_id,
                credited.c.wallet_id == Payment.wallet_id,
                credited.c.user_id == Payment.user_id,
                credited.c.currency == Payment.currency,
                credited.c.amount_kopeks == Payment.amount_kopeks,
            ),
        )
        .outerjoin(refunds, refunds.c.payment_id == Payment.id)
    )
    duplicate = select(Payment.id).where(Payment.provider_payment_id == Transaction.yookassa_payment_id).exists()
    legacy = (
        select(
            Transaction.id,
            Transaction.user_id,
            literal('subscription').label('kind'),
            Transaction.status,
            cast(func.round(Transaction.amount * 100, 0), BigInteger).label('amount_kopeks'),
            Transaction.currency,
            literal('yookassa').label('provider'),
            Transaction.yookassa_payment_id.label('provider_payment_id'),
            func.coalesce(Transaction.updated_at, Transaction.created_at).label('processed_at'),
            literal('billing_transaction').label('source'),
            literal(None).label('wallet_id'),
            Transaction.subscription_id,
            User.name,
            Transaction.created_at,
            literal(None).label('credited_at'),
            literal('not_applicable').label('credit_status'),
            literal(0).label('refunded_kopeks'),
            Transaction.extra_metadata['provider_test'].as_boolean().label('is_test'),
        )
        .outerjoin(User, User.id == Transaction.user_id)
        .where(~duplicate)
    )
    return union_all(payments, legacy).subquery()


def payment_query(
    *,
    from_ts: int,
    to_ts: int,
    currency: str,
    user_id: str | None = None,
    status: str | None = None,
    kind: str | None = None,
    credit_status: str | None = None,
    older_than: int | None = None,
    is_test: bool | None = None,
) -> Select:
    """Half-open periods; attempts retain creation and credit timestamps separately."""
    table = payment_table()
    query = select(table).where(
        table.c.currency == currency, table.c.processed_at >= from_ts, table.c.processed_at < to_ts
    )
    for column, value in [
        (table.c.user_id, user_id),
        (table.c.status, status),
        (table.c.kind, kind),
        (table.c.credit_status, credit_status),
    ]:
        if value:
            query = query.where(column == value)
    if is_test is True:
        query = query.where(table.c.is_test.is_(True))
    elif is_test is False:
        query = query.where(or_(table.c.is_test.is_(None), table.c.is_test.is_(False)))
    if older_than is not None:
        query = query.where(table.c.created_at < older_than)
    return query


def topup_query(*, currency: str, user_id: str | None = None) -> Select:
    """Only provider-confirmed payments with an applied matching TOPUP count as funds."""
    table = payment_table()
    query = select(table).where(
        table.c.currency == currency,
        table.c.credit_status == 'credited',
        or_(table.c.is_test.is_(None), table.c.is_test.is_(False)),
    )
    if user_id:
        query = query.where(table.c.user_id == user_id)
    return query


def live_payment_condition() -> ColumnElement[bool]:
    """Exclude explicit provider tests; retain historical unknown flags."""
    return Payment.raw_payload_json['test'].as_boolean().is_not(True)


def live_refund_condition() -> ColumnElement[bool]:
    """Exclude explicitly marked test refunds while retaining historical orphan facts."""
    return (
        ~select(Payment.id)
        .where(Payment.id == AnalyticsRefund.payment_id, Payment.raw_payload_json['test'].as_boolean().is_(True))
        .exists()
    )
