"""Read-only billing reporting queries for the admin financial workspace.

The reporting layer deliberately does not mutate billing state. It normalizes the
two payment stores at read time and keeps paid, included, and usage balances
separate so dashboards cannot silently present a mixed financial metric.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from open_webui.models.billing_models import Transaction
from open_webui.models.billing_wallet import (
    LedgerEntry,
    Payment,
    PaymentStatus,
    UsageEvent,
    Wallet,
)
from open_webui.models.users import User
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

REPORTING_PAGE_MAX = 100
REPORTING_EXPORT_MAX = 50_000
REPORTING_DEFAULT_DAYS = 30
REPORTING_MAX_DAYS = 366


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


def amount_to_kopeks(value: object) -> int:
    """Convert a legacy decimal amount to integer kopeks without float math."""

    try:
        return int((Decimal(str(value)) * Decimal('100')).quantize(Decimal('1')))
    except (InvalidOperation, ValueError, TypeError):
        return 0


def normalize_range(from_ts: int | None, to_ts: int | None) -> tuple[int, int]:
    now = int(time.time())
    end = min(int(to_ts or now), now)
    start = int(from_ts or (end - REPORTING_DEFAULT_DAYS * 86400))
    if start > end:
        raise ValueError('from must be before to')
    if end - start > REPORTING_MAX_DAYS * 86400:
        raise ValueError('date range cannot exceed 366 days')
    return start, end


class BillingReportingService:
    """Async, read-only reporting facade over the existing billing tables."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def payment_facts(  # noqa: C901 - normalization spans two legacy payment stores
        self,
        *,
        from_ts: int,
        to_ts: int,
        currency: str,
        user_id: str | None = None,
        status: str | None = None,
        kind: str | None = None,
        limit: int = REPORTING_EXPORT_MAX,
    ) -> list[PaymentFact]:
        payment_stmt = select(Payment).where(
            func.coalesce(Payment.updated_at, Payment.created_at) >= from_ts,
            func.coalesce(Payment.updated_at, Payment.created_at) <= to_ts,
            Payment.currency == currency,
        )
        if user_id:
            payment_stmt = payment_stmt.where(Payment.user_id == user_id)
        if status:
            payment_stmt = payment_stmt.where(Payment.status == status)
        if kind:
            payment_stmt = payment_stmt.where(Payment.kind == kind)
        # Fetch a bounded window from each legacy store, merge deterministically,
        # then apply the global cap below.  Callers must surface truncation when
        # the cap is reached; this keeps reporting requests memory-bounded.
        payment_stmt = payment_stmt.order_by(Payment.created_at.desc()).limit(limit)
        payment_rows = (await self.session.execute(payment_stmt)).scalars().all()

        transaction_stmt = select(Transaction).where(
            func.coalesce(Transaction.updated_at, Transaction.created_at) >= from_ts,
            func.coalesce(Transaction.updated_at, Transaction.created_at) <= to_ts,
            Transaction.currency == currency,
        )
        if user_id:
            transaction_stmt = transaction_stmt.where(Transaction.user_id == user_id)
        if status:
            transaction_stmt = transaction_stmt.where(Transaction.status == status)
        if kind and kind != 'subscription':
            transaction_stmt = transaction_stmt.where(False)
        transaction_stmt = transaction_stmt.order_by(Transaction.created_at.desc()).limit(limit)
        transaction_rows = (await self.session.execute(transaction_stmt)).scalars().all()

        facts: list[PaymentFact] = []
        provider_ids: set[str] = set()
        for row in payment_rows:
            provider_id = row.provider_payment_id
            if provider_id:
                provider_ids.add(provider_id)
            facts.append(
                PaymentFact(
                    id=row.id,
                    user_id=row.user_id,
                    kind=row.kind,
                    status=row.status,
                    amount_kopeks=int(row.amount_kopeks or 0),
                    currency=row.currency,
                    provider=row.provider,
                    provider_payment_id=provider_id,
                    processed_at=int(row.updated_at or row.created_at),
                    source='billing_payment',
                    wallet_id=row.wallet_id,
                    subscription_id=row.subscription_id,
                )
            )

        for row in transaction_rows:
            # A subscription can exist in both stores during migration. Do not
            # double-count it when the provider id is already canonicalized.
            if row.yookassa_payment_id and row.yookassa_payment_id in provider_ids:
                continue
            facts.append(
                PaymentFact(
                    id=row.id,
                    user_id=row.user_id,
                    kind='subscription',
                    status=row.status,
                    amount_kopeks=amount_to_kopeks(row.amount),
                    currency=row.currency,
                    provider='yookassa',
                    provider_payment_id=row.yookassa_payment_id,
                    processed_at=int(row.updated_at or row.created_at),
                    source='billing_transaction',
                    wallet_id=None,
                    subscription_id=row.subscription_id,
                )
            )

        facts.sort(key=lambda item: (item.processed_at, item.id), reverse=True)
        return facts[:limit]

    async def overview(self, *, from_ts: int, to_ts: int, currency: str) -> dict[str, object]:
        facts = await self.payment_facts(
            from_ts=from_ts,
            to_ts=to_ts,
            currency=currency,
            limit=REPORTING_EXPORT_MAX,
        )
        successful = [fact for fact in facts if fact.status == PaymentStatus.SUCCEEDED.value]
        usage_stmt = (
            select(
                func.coalesce(func.sum(UsageEvent.cost_charged_kopeks), 0),
                func.count(UsageEvent.id),
            )
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(
                UsageEvent.created_at >= from_ts,
                UsageEvent.created_at <= to_ts,
                Wallet.currency == currency,
            )
        )
        usage_total, usage_count = (await self.session.execute(usage_stmt)).one()

        wallet_stmt = select(
            func.coalesce(func.sum(Wallet.balance_topup_kopeks), 0),
            func.coalesce(func.sum(Wallet.balance_included_kopeks), 0),
            func.count(Wallet.id),
        ).where(Wallet.currency == currency)
        paid_balance, included_balance, wallet_count = (await self.session.execute(wallet_stmt)).one()

        negative_stmt = select(func.count(Wallet.id)).where(
            Wallet.currency == currency,
            or_(Wallet.balance_topup_kopeks < 0, Wallet.balance_included_kopeks < 0),
        )
        negative_balances = int((await self.session.execute(negative_stmt)).scalar_one() or 0)

        stale_pending_stmt = select(func.count(Payment.id)).where(
            Payment.currency == currency,
            Payment.status == PaymentStatus.PENDING.value,
            Payment.created_at < int(time.time()) - 86400,
        )
        stale_pending = int((await self.session.execute(stale_pending_stmt)).scalar_one() or 0)

        unlinked_stmt = (
            select(func.count(Payment.id))
            .outerjoin(
                LedgerEntry,
                and_(
                    LedgerEntry.reference_type == 'payment',
                    LedgerEntry.reference_id == Payment.provider_payment_id,
                    LedgerEntry.type == 'topup',
                ),
            )
            .where(
                Payment.currency == currency,
                Payment.kind == 'topup',
                Payment.status == PaymentStatus.SUCCEEDED.value,
                LedgerEntry.id.is_(None),
            )
        )
        unlinked_topups = int((await self.session.execute(unlinked_stmt)).scalar_one() or 0)

        series: dict[str, dict[str, int]] = defaultdict(lambda: {'paid_kopeks': 0, 'usage_kopeks': 0})
        for fact in successful:
            day = time.strftime('%Y-%m-%d', time.gmtime(fact.processed_at))
            series[day]['paid_kopeks'] += fact.amount_kopeks
        usage_rows_stmt = (
            select(UsageEvent.created_at, UsageEvent.cost_charged_kopeks)
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(
                UsageEvent.created_at >= from_ts,
                UsageEvent.created_at <= to_ts,
                Wallet.currency == currency,
            )
        )
        for created_at, cost in (await self.session.execute(usage_rows_stmt)).all():
            day = time.strftime('%Y-%m-%d', time.gmtime(int(created_at)))
            series[day]['usage_kopeks'] += int(cost or 0)

        payer_count = len({fact.user_id for fact in successful})
        return {
            'currency': currency,
            'from': from_ts,
            'to': to_ts,
            'as_of': int(time.time()),
            'time_semantics': 'processed_at_fallback',
            'metrics': {
                'successful_payments_kopeks': sum(fact.amount_kopeks for fact in successful),
                'successful_payment_count': len(successful),
                'payer_count': payer_count,
                'usage_spend_kopeks': int(usage_total or 0),
                'usage_event_count': int(usage_count or 0),
                'paid_balance_kopeks': int(paid_balance or 0),
                'included_balance_kopeks': int(included_balance or 0),
                'wallet_count': int(wallet_count or 0),
            },
            'warnings': {
                'negative_balances': negative_balances,
                'stale_pending_payments': stale_pending,
                'successful_topups_without_ledger': unlinked_topups,
                'payment_fact_limit_reached': int(len(facts) >= REPORTING_EXPORT_MAX),
            },
            'series': [{'date': day, **values} for day, values in sorted(series.items())],
            'definitions': {
                'successful_payments': 'Successful top-ups and subscription payments; refunds are not included.',
                'paid_balance': 'Current balance_topup_kopeks liability, not revenue.',
                'included_balance': 'Current bonus/included balance; never counted as cash paid.',
                'usage_spend': 'Sum of billing_usage_event.cost_charged_kopeks.',
                'time': 'processed_at is local processing time until provider paid_at is persisted.',
            },
        }

    async def customers(
        self,
        *,
        from_ts: int,
        to_ts: int,
        currency: str,
        query: str | None,
        page: int,
        page_size: int,
        sort: str,
        direction: str,
    ) -> dict[str, object]:
        # The customer set is intentionally bounded by wallets; all aggregates
        # remain in SQL and only the page is serialized.
        wallet_stmt = select(Wallet, User).join(User, User.id == Wallet.user_id).where(Wallet.currency == currency)
        if query:
            pattern = f'%{query.strip()}%'
            wallet_stmt = wallet_stmt.where(
                or_(User.id.ilike(pattern), User.email.ilike(pattern), User.name.ilike(pattern))
            )
        wallet_rows = (await self.session.execute(wallet_stmt)).all()
        facts = await self.payment_facts(
            from_ts=0,
            to_ts=to_ts,
            currency=currency,
            limit=REPORTING_EXPORT_MAX,
        )
        payment_by_user: dict[str, list[PaymentFact]] = defaultdict(list)
        for fact in facts:
            payment_by_user[fact.user_id].append(fact)

        usage_stmt = (
            select(
                UsageEvent.user_id,
                func.coalesce(func.sum(UsageEvent.cost_charged_kopeks), 0),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(UsageEvent.created_at >= from_ts, UsageEvent.created_at <= to_ts),
                                UsageEvent.cost_charged_kopeks,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ),
                func.max(UsageEvent.created_at),
            )
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(
                Wallet.currency == currency,
                UsageEvent.created_at <= to_ts,
            )
            .group_by(UsageEvent.user_id)
        )
        usage_by_user = {
            str(user_id): {
                'spent_kopeks': int(total or 0),
                'period_spent_kopeks': int(period_total or 0),
                'last_usage_at': int(last_usage or 0) or None,
            }
            for user_id, total, period_total, last_usage in (await self.session.execute(usage_stmt)).all()
        }

        items: list[dict[str, object]] = []
        for wallet, user in wallet_rows:
            user_facts = payment_by_user.get(user.id, [])
            successful = [fact for fact in user_facts if fact.status == PaymentStatus.SUCCEEDED.value]
            period_successful = [fact for fact in successful if fact.processed_at >= from_ts]
            failed = [fact for fact in user_facts if fact.status in {'failed', 'canceled'}]
            usage = usage_by_user.get(user.id, {})
            items.append(
                {
                    'user_id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'role': user.role,
                    'currency': currency,
                    'paid_kopeks': sum(fact.amount_kopeks for fact in successful),
                    'period_paid_kopeks': sum(fact.amount_kopeks for fact in period_successful),
                    'spent_kopeks': int(usage.get('spent_kopeks', 0)),
                    'period_spent_kopeks': int(usage.get('period_spent_kopeks', 0)),
                    'balance_topup_kopeks': int(wallet.balance_topup_kopeks or 0),
                    'balance_included_kopeks': int(wallet.balance_included_kopeks or 0),
                    'last_payment_at': max((fact.processed_at for fact in successful), default=None),
                    'last_usage_at': usage.get('last_usage_at'),
                    'successful_payment_count': len(successful),
                    'failed_payment_count': len(failed),
                    'status': (
                        'negative_balance'
                        if int(wallet.balance_topup_kopeks or 0) < 0
                        else 'healthy' if successful else 'never_paid'
                    ),
                }
            )

        reverse = direction == 'desc'
        sort_key = {
            'paid': 'paid_kopeks',
            'spent': 'spent_kopeks',
            'balance': 'balance_topup_kopeks',
            'last_payment': 'last_payment_at',
            'last_usage': 'last_usage_at',
        }.get(sort, 'last_payment_at')
        items.sort(key=lambda item: (item.get(sort_key) is None, item.get(sort_key) or 0), reverse=reverse)
        total = len(items)
        start = (page - 1) * page_size
        return {
            'items': items[start : start + page_size],
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'currency': currency,
            'from': from_ts,
            'to': to_ts,
            'as_of': int(time.time()),
            'payment_fact_limit_reached': len(facts) >= REPORTING_EXPORT_MAX,
        }

    async def customer_detail(
        self, *, user_id: str, from_ts: int, to_ts: int, currency: str, limit: int
    ) -> dict[str, object] | None:
        user = (await self.session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user:
            return None
        wallet = (
            await self.session.execute(select(Wallet).where(Wallet.user_id == user_id, Wallet.currency == currency))
        ).scalar_one_or_none()
        all_facts = await self.payment_facts(
            from_ts=0,
            to_ts=to_ts,
            currency=currency,
            user_id=user_id,
            limit=REPORTING_EXPORT_MAX,
        )
        facts = all_facts[:limit]
        ledger_stmt = (
            select(LedgerEntry)
            .where(LedgerEntry.user_id == user_id, LedgerEntry.currency == currency)
            .order_by(LedgerEntry.created_at.desc())
            .limit(limit)
        )
        ledger = (await self.session.execute(ledger_stmt)).scalars().all()
        usage_stmt = (
            select(UsageEvent)
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(
                UsageEvent.user_id == user_id,
                UsageEvent.created_at >= 0,
                UsageEvent.created_at <= to_ts,
                Wallet.currency == currency,
            )
            .order_by(UsageEvent.created_at.desc())
            .limit(limit)
        )
        usage = (await self.session.execute(usage_stmt)).scalars().all()
        spend_stmt = (
            select(
                func.coalesce(func.sum(UsageEvent.cost_charged_kopeks), 0),
                func.coalesce(
                    func.sum(
                        case(
                            (UsageEvent.created_at >= from_ts, UsageEvent.cost_charged_kopeks),
                            else_=0,
                        )
                    ),
                    0,
                ),
            )
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(
                UsageEvent.user_id == user_id,
                UsageEvent.created_at <= to_ts,
                Wallet.currency == currency,
            )
        )
        spent_kopeks, period_spent_kopeks = (await self.session.execute(spend_stmt)).one()
        successful = [fact for fact in all_facts if fact.status == PaymentStatus.SUCCEEDED.value]
        return {
            'user': {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role},
            'wallet': {
                'id': wallet.id if wallet else None,
                'currency': currency,
                'balance_topup_kopeks': int(wallet.balance_topup_kopeks or 0) if wallet else 0,
                'balance_included_kopeks': int(wallet.balance_included_kopeks or 0) if wallet else 0,
                'daily_spent_kopeks': int(wallet.daily_spent_kopeks or 0) if wallet else 0,
                'daily_cap_kopeks': wallet.daily_cap_kopeks if wallet else None,
            },
            'metrics': {
                'paid_kopeks': sum(fact.amount_kopeks for fact in successful),
                'period_paid_kopeks': sum(fact.amount_kopeks for fact in successful if fact.processed_at >= from_ts),
                'payment_count': len(successful),
                'spent_kopeks': int(spent_kopeks or 0),
                'period_spent_kopeks': int(period_spent_kopeks or 0),
            },
            'payments': [self._payment_payload(fact) for fact in facts],
            'ledger': [self._ledger_payload(entry) for entry in ledger],
            'usage': [self._usage_payload(event) for event in usage],
            'from': from_ts,
            'to': to_ts,
            'as_of': int(time.time()),
            'time_semantics': 'processed_at_fallback',
            'payment_fact_limit_reached': len(all_facts) >= REPORTING_EXPORT_MAX,
        }

    async def ledger_rows(
        self, *, from_ts: int, to_ts: int, currency: str, user_id: str | None, limit: int, offset: int
    ) -> tuple[list[dict[str, object]], int]:
        filters = [
            LedgerEntry.created_at >= from_ts,
            LedgerEntry.created_at <= to_ts,
            LedgerEntry.currency == currency,
        ]
        if user_id:
            filters.append(LedgerEntry.user_id == user_id)
        stmt = (
            select(LedgerEntry, User.name, User.email)
            .join(User, User.id == LedgerEntry.user_id)
            .where(*filters)
            .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
            .offset(offset)
            .limit(limit)
        )
        count_stmt = select(func.count(LedgerEntry.id)).where(*filters)
        rows = (await self.session.execute(stmt)).all()
        total = int((await self.session.execute(count_stmt)).scalar_one() or 0)
        return [{**self._ledger_payload(entry), 'name': name, 'email': email} for entry, name, email in rows], total

    async def usage_rows(
        self, *, from_ts: int, to_ts: int, currency: str, user_id: str | None, limit: int, offset: int
    ) -> tuple[list[dict[str, object]], int]:
        filters = [
            UsageEvent.created_at >= from_ts,
            UsageEvent.created_at <= to_ts,
            Wallet.currency == currency,
        ]
        if user_id:
            filters.append(UsageEvent.user_id == user_id)
        stmt = (
            select(UsageEvent, User.name, User.email)
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .join(User, User.id == UsageEvent.user_id)
            .where(*filters)
            .order_by(UsageEvent.created_at.desc(), UsageEvent.id.desc())
            .offset(offset)
            .limit(limit)
        )
        count_stmt = select(func.count(UsageEvent.id)).join(Wallet, Wallet.id == UsageEvent.wallet_id).where(*filters)
        rows = (await self.session.execute(stmt)).all()
        total = int((await self.session.execute(count_stmt)).scalar_one() or 0)
        return [{**self._usage_payload(event), 'name': name, 'email': email} for event, name, email in rows], total

    @staticmethod
    def _payment_payload(fact: PaymentFact) -> dict[str, object]:
        return {
            'id': fact.id,
            'user_id': fact.user_id,
            'kind': fact.kind,
            'status': fact.status,
            'amount_kopeks': fact.amount_kopeks,
            'currency': fact.currency,
            'provider': fact.provider,
            'provider_payment_id': fact.provider_payment_id,
            'processed_at': fact.processed_at,
            'source': fact.source,
            'wallet_id': fact.wallet_id,
            'subscription_id': fact.subscription_id,
        }

    @staticmethod
    def _ledger_payload(entry: LedgerEntry) -> dict[str, object]:
        return {
            'id': entry.id,
            'user_id': entry.user_id,
            'wallet_id': entry.wallet_id,
            'currency': entry.currency,
            'type': entry.type,
            'amount_kopeks': int(entry.amount_kopeks or 0),
            'balance_included_after': int(entry.balance_included_after or 0),
            'balance_topup_after': int(entry.balance_topup_after or 0),
            'reference_id': entry.reference_id,
            'reference_type': entry.reference_type,
            'correlation_id': entry.correlation_id,
            'created_at': int(entry.created_at),
        }

    @staticmethod
    def _usage_payload(event: UsageEvent) -> dict[str, object]:
        return {
            'id': event.id,
            'user_id': event.user_id,
            'request_id': event.request_id,
            'correlation_id': event.correlation_id,
            'model_id': event.model_id,
            'modality': event.modality,
            'provider': event.provider,
            'cost_charged_kopeks': int(event.cost_charged_kopeks or 0),
            'billing_source': event.billing_source,
            'is_estimated': bool(event.is_estimated),
            'created_at': int(event.created_at),
        }


def safe_csv_cell(value: object) -> str:
    """Prevent formula execution when exported data is opened in a spreadsheet."""

    text = '' if value is None else str(value)
    # Spreadsheet engines may ignore leading whitespace/control characters
    # before interpreting a formula.  Keep the original value for auditability,
    # but prefix an apostrophe when the first meaningful character is dangerous.
    first_meaningful = text.lstrip('\ufeff').lstrip()
    if first_meaningful.startswith(('=', '+', '-', '@')):
        return "'" + text
    return text
