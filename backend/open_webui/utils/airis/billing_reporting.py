"""Read-only billing reporting queries for the admin financial workspace.

The reporting layer deliberately does not mutate billing state. It normalizes the
two payment stores at read time and keeps paid, included, and usage balances
separate so dashboards cannot silently present a mixed financial metric.
"""

from __future__ import annotations

import time
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing_wallet import (
    LedgerEntry,
    UsageEvent,
    Wallet,
)
from open_webui.models.users import User
from open_webui.utils.airis.billing_reporting_facts import (
    PaymentFact,
    live_refund_condition,
    payment_query,
    topup_query,
)
from sqlalchemy import Integer, and_, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

REPORTING_PAGE_MAX = 100
REPORTING_EXPORT_MAX = 50_000
REPORTING_DEFAULT_DAYS = 30
REPORTING_MAX_DAYS = 366


def amount_to_kopeks(value: object) -> int:
    """Convert a legacy decimal amount to integer kopeks without float math."""

    try:
        return int((Decimal(str(value)) * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, TypeError):
        return 0


def normalize_range(from_ts: int | None, to_ts: int | None) -> tuple[int, int]:
    now = int(time.time())
    end = min(int(to_ts if to_ts is not None else now), now)
    start = int(from_ts if from_ts is not None else end - REPORTING_DEFAULT_DAYS * 86400)
    if start >= end:
        raise ValueError('from must be before to')
    if end - start > REPORTING_MAX_DAYS * 86400:
        raise ValueError('date range cannot exceed 366 days')
    return start, end


class BillingReportingService:
    """Async, read-only reporting facade over the existing billing tables."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def payment_facts(
        self,
        *,
        from_ts: int,
        to_ts: int,
        currency: str,
        user_id: str | None = None,
        status: str | None = None,
        kind: str | None = None,
        limit: int = REPORTING_EXPORT_MAX,
        credit_status: str | None = None,
        older_than: int | None = None,
        is_test: bool | None = None,
    ) -> list[PaymentFact]:
        query = payment_query(
            from_ts=from_ts,
            to_ts=to_ts,
            currency=currency,
            user_id=user_id,
            status=status,
            kind=kind,
            credit_status=credit_status,
            older_than=older_than,
            is_test=is_test,
        )
        rows = (
            (
                await self.session.execute(
                    query.order_by(query.selected_columns.processed_at.desc(), query.selected_columns.id.desc()).limit(
                        limit
                    )
                )
            )
            .mappings()
            .all()
        )
        return [PaymentFact(**dict(row)) for row in rows]

    async def payment_page(
        self,
        *,
        from_ts: int,
        to_ts: int,
        currency: str,
        user_id: str | None,
        status: str | None,
        kind: str | None,
        page: int,
        page_size: int,
        credit_status: str | None = None,
        older_than: int | None = None,
        is_test: bool | None = None,
        payment_id: str | None = None,
    ) -> tuple[list[dict[str, object]], int]:
        if payment_id and not user_id:
            raise ValueError('Related payment requires a customer')
        query = payment_query(
            from_ts=0 if payment_id else from_ts,
            to_ts=int(time.time()) + 1 if payment_id else to_ts,
            currency=currency,
            user_id=user_id,
            status=status,
            kind=kind,
            credit_status=credit_status,
            older_than=older_than,
            is_test=is_test,
        )
        if payment_id:
            query = query.where(query.selected_columns.id == payment_id)
        total = int((await self.session.execute(select(func.count()).select_from(query.subquery()))).scalar_one())
        rows = (
            (
                await self.session.execute(
                    query.order_by(
                        query.selected_columns.processed_at.desc(),
                        query.selected_columns.id.desc(),
                    )
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            )
            .mappings()
            .all()
        )
        return [self._payment_payload(PaymentFact(**dict(row))) for row in rows], total

    async def financial_totals(
        self, *, from_ts: int, to_ts: int, currency: str, user_id: str | None = None
    ) -> dict[str, int]:
        topups = topup_query(currency=currency, user_id=user_id).subquery()
        payment_stmt = select(
            func.coalesce(func.sum(topups.c.amount_kopeks), 0),
            func.count(),
            func.count(func.distinct(topups.c.user_id)),
        ).where(topups.c.credited_at >= from_ts, topups.c.credited_at < to_ts)
        paid, count, payers = (await self.session.execute(payment_stmt)).one()
        refund_stmt = select(func.coalesce(func.sum(AnalyticsRefund.amount_kopeks), 0), func.count()).where(
            AnalyticsRefund.currency == currency,
            live_refund_condition(),
            AnalyticsRefund.occurred_at >= from_ts,
            AnalyticsRefund.occurred_at < to_ts,
        )
        usage_stmt = (
            select(func.coalesce(func.sum(UsageEvent.cost_charged_kopeks), 0), func.count())
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(Wallet.currency == currency, UsageEvent.created_at >= from_ts, UsageEvent.created_at < to_ts)
        )
        if user_id:
            refund_stmt = refund_stmt.where(AnalyticsRefund.user_id == user_id)
            usage_stmt = usage_stmt.where(UsageEvent.user_id == user_id)
        refunded, refunds = (await self.session.execute(refund_stmt)).one()
        spent, usages = (await self.session.execute(usage_stmt)).one()
        other = payment_query(
            from_ts=from_ts, to_ts=to_ts, currency=currency, user_id=user_id, status='succeeded'
        ).subquery()
        other_sum = (
            await self.session.execute(
                select(func.coalesce(func.sum(other.c.amount_kopeks), 0)).where(
                    other.c.kind != 'topup', or_(other.c.is_test.is_(None), other.c.is_test.is_(False))
                )
            )
        ).scalar_one()
        return {
            'successful_payments_kopeks': int(paid),
            'successful_payment_count': int(count),
            'payer_count': int(payers),
            'refund_kopeks': int(refunded),
            'refund_count': int(refunds),
            'net_kopeks': int(paid) - int(refunded),
            'usage_spend_kopeks': int(spent),
            'usage_event_count': int(usages),
            'other_payments_kopeks': int(other_sum),
        }

    async def overview(self, *, from_ts: int, to_ts: int, currency: str) -> dict[str, object]:
        metrics = await self.financial_totals(from_ts=from_ts, to_ts=to_ts, currency=currency)
        now = int(time.time())
        paid, included, wallets, reserved = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(Wallet.balance_topup_kopeks), 0),
                    func.coalesce(func.sum(Wallet.balance_included_kopeks), 0),
                    func.count(),
                    func.coalesce(func.sum(Wallet.daily_reserved_kopeks), 0),
                ).where(Wallet.currency == currency)
            )
        ).one()
        metrics.update(
            paid_balance_kopeks=int(paid),
            included_balance_kopeks=int(included),
            wallet_count=int(wallets),
            daily_reserved_kopeks=int(reserved),
        )
        negative = (
            await self.session.execute(
                select(func.count())
                .select_from(Wallet)
                .where(
                    Wallet.currency == currency,
                    or_(Wallet.balance_topup_kopeks < 0, Wallet.balance_included_kopeks < 0),
                )
            )
        ).scalar_one()
        pending = payment_query(
            from_ts=0, to_ts=now + 1, currency=currency, status='pending', older_than=now - 86400
        ).subquery()
        missing = payment_query(
            from_ts=0, to_ts=now + 1, currency=currency, status='succeeded', kind='topup', credit_status='not_credited'
        ).subquery()
        stale = (await self.session.execute(select(func.count()).select_from(pending))).scalar_one()
        unlinked = (await self.session.execute(select(func.count()).select_from(missing))).scalar_one()
        series: dict[int, dict[str, int]] = defaultdict(
            lambda: {'paid_kopeks': 0, 'usage_kopeks': 0, 'refund_kopeks': 0}
        )
        topups = topup_query(currency=currency).subquery()
        # Reuse the expressions so PostgreSQL sees identical bind parameters in SELECT/GROUP BY.
        paid_day = cast(func.floor(topups.c.credited_at / 86400), Integer)
        refund_day = cast(func.floor(AnalyticsRefund.occurred_at / 86400), Integer)
        usage_day = cast(func.floor(UsageEvent.created_at / 86400), Integer)
        queries = [
            (
                'paid_kopeks',
                select(paid_day, func.sum(topups.c.amount_kopeks))
                .where(topups.c.credited_at >= from_ts, topups.c.credited_at < to_ts)
                .group_by(paid_day),
            ),
            (
                'refund_kopeks',
                select(
                    refund_day,
                    func.sum(AnalyticsRefund.amount_kopeks),
                )
                .where(
                    AnalyticsRefund.currency == currency,
                    live_refund_condition(),
                    AnalyticsRefund.occurred_at >= from_ts,
                    AnalyticsRefund.occurred_at < to_ts,
                )
                .group_by(refund_day),
            ),
            (
                'usage_kopeks',
                select(usage_day, func.sum(UsageEvent.cost_charged_kopeks))
                .join(Wallet, Wallet.id == UsageEvent.wallet_id)
                .where(Wallet.currency == currency, UsageEvent.created_at >= from_ts, UsageEvent.created_at < to_ts)
                .group_by(usage_day),
            ),
        ]
        for name, query in queries:
            for day, total in (await self.session.execute(query)).all():
                series[int(day)][name] = int(total)
        return {
            'currency': currency,
            'from': from_ts,
            'to': to_ts,
            'as_of': now,
            'timezone': 'UTC',
            'time_semantics': 'topup_ledger_refund_provider_created_at',
            'metrics': metrics,
            'warnings': {
                'negative_balances': int(negative),
                'stale_pending_payments': int(stale),
                'successful_topups_without_ledger': int(unlinked),
                'payment_fact_limit_reached': 0,
            },
            'series': [
                {'date': time.strftime('%Y-%m-%d', time.gmtime(day * 86400)), **values}
                for day, values in sorted(series.items())
            ],
            'definitions': {
                'successful_payments': (
                    'Provider-confirmed TOPUP matched to its applied ledger; ' 'legacy subscriptions are separate.'
                ),
                'refund': (
                    'Verified succeeded provider refund, dated by provider created_at. '
                    'Wallet reflection requires separate verification.'
                ),
                'paid_balance': 'Current available paid funds, not historical balance or profit.',
                'included_balance': 'Current included/bonus funds, not cash paid.',
                'daily_reserved': 'Current daily limit reservation, not all active monetary holds.',
                'usage_spend': 'Final UsageEvent cost, including paid/included sources; not provider cost.',
                'time': 'All period totals use [from,to), UTC; balances are current.',
            },
        }

    async def refund_rows(
        self, *, from_ts: int, to_ts: int, currency: str, user_id: str | None, limit: int, offset: int
    ) -> tuple[list[dict[str, object]], int]:
        conditions = [
            AnalyticsRefund.currency == currency,
            live_refund_condition(),
            AnalyticsRefund.occurred_at >= from_ts,
            AnalyticsRefund.occurred_at < to_ts,
        ]
        if user_id:
            conditions.append(AnalyticsRefund.user_id == user_id)
        query = (
            select(AnalyticsRefund, User.name).outerjoin(User, User.id == AnalyticsRefund.user_id).where(*conditions)
        )
        total = int(
            (
                await self.session.execute(select(func.count()).select_from(AnalyticsRefund).where(*conditions))
            ).scalar_one()
        )
        rows = (
            await self.session.execute(
                query.order_by(AnalyticsRefund.occurred_at.desc(), AnalyticsRefund.id.desc())
                .offset(offset)
                .limit(limit)
            )
        ).all()
        return [
            {
                'id': refund.id,
                'user_id': refund.user_id,
                'name': name,
                'payment_id': refund.payment_id,
                'amount_kopeks': int(refund.amount_kopeks),
                'currency': refund.currency,
                'occurred_at': int(refund.occurred_at),
                'wallet_reflection': 'requires_verification',
            }
            for refund, name in rows
        ], total

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
        status: str | None = None,
    ) -> dict[str, object]:
        """Aggregate complete customer histories in SQL; paginate only final rows."""
        now = int(time.time())
        paid = topup_query(currency=currency).subquery()
        payments = (
            select(
                paid.c.user_id,
                func.sum(paid.c.amount_kopeks).label('paid_kopeks'),
                func.sum(
                    case(
                        (and_(paid.c.credited_at >= from_ts, paid.c.credited_at < to_ts), paid.c.amount_kopeks), else_=0
                    )
                ).label('period_paid_kopeks'),
                func.count().label('successful_payment_count'),
                func.max(paid.c.credited_at).label('last_payment_at'),
            )
            .where(paid.c.credited_at <= now)
            .group_by(paid.c.user_id)
            .subquery()
        )
        usages = (
            select(
                UsageEvent.user_id,
                func.sum(UsageEvent.cost_charged_kopeks).label('spent_kopeks'),
                func.sum(
                    case(
                        (
                            and_(UsageEvent.created_at >= from_ts, UsageEvent.created_at < to_ts),
                            UsageEvent.cost_charged_kopeks,
                        ),
                        else_=0,
                    )
                ).label('period_spent_kopeks'),
                func.max(UsageEvent.created_at).label('last_usage_at'),
            )
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .where(Wallet.currency == currency, UsageEvent.created_at <= now)
            .group_by(UsageEvent.user_id)
            .subquery()
        )
        refunds = (
            select(
                AnalyticsRefund.user_id,
                func.sum(AnalyticsRefund.amount_kopeks).label('refund_kopeks'),
                func.sum(
                    case(
                        (
                            and_(AnalyticsRefund.occurred_at >= from_ts, AnalyticsRefund.occurred_at < to_ts),
                            AnalyticsRefund.amount_kopeks,
                        ),
                        else_=0,
                    )
                ).label('period_refund_kopeks'),
            )
            .where(AnalyticsRefund.currency == currency, live_refund_condition(), AnalyticsRefund.occurred_at <= now)
            .group_by(AnalyticsRefund.user_id)
            .subquery()
        )
        attempts = payment_query(from_ts=0, to_ts=now + 1, currency=currency).subquery()
        problems = (
            select(
                attempts.c.user_id,
                func.sum(case((attempts.c.status.in_(['failed', 'canceled']), 1), else_=0)).label(
                    'failed_payment_count'
                ),
                func.sum(
                    case(
                        (
                            and_(
                                attempts.c.kind == 'topup',
                                attempts.c.status == 'succeeded',
                                attempts.c.credit_status == 'not_credited',
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label('uncredited_payment_count'),
                func.sum(
                    case((and_(attempts.c.status == 'pending', attempts.c.created_at < now - 86400), 1), else_=0)
                ).label('stale_payment_count'),
            )
            .group_by(attempts.c.user_id)
            .subquery()
        )
        statement = (
            select(
                User.id.label('user_id'),
                User.name,
                User.email,
                User.role,
                Wallet.balance_topup_kopeks,
                Wallet.balance_included_kopeks,
                *[
                    func.coalesce(payments.c[key], 0).label(key)
                    for key in ('paid_kopeks', 'period_paid_kopeks', 'successful_payment_count')
                ],
                payments.c.last_payment_at,
                *[func.coalesce(usages.c[key], 0).label(key) for key in ('spent_kopeks', 'period_spent_kopeks')],
                usages.c.last_usage_at,
                *[func.coalesce(refunds.c[key], 0).label(key) for key in ('refund_kopeks', 'period_refund_kopeks')],
                *[
                    func.coalesce(problems.c[key], 0).label(key)
                    for key in ('failed_payment_count', 'uncredited_payment_count', 'stale_payment_count')
                ],
            )
            .select_from(Wallet)
            .join(User, User.id == Wallet.user_id)
            .outerjoin(payments, payments.c.user_id == User.id)
            .outerjoin(usages, usages.c.user_id == User.id)
            .outerjoin(refunds, refunds.c.user_id == User.id)
            .outerjoin(problems, problems.c.user_id == User.id)
            .where(Wallet.currency == currency)
        )
        if query and query.strip():
            pattern = '%' + query.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
            statement = statement.where(
                or_(
                    User.id.ilike(pattern, escape='\\'),
                    User.email.ilike(pattern, escape='\\'),
                    User.name.ilike(pattern, escape='\\'),
                )
            )
        if status == 'negative_balance':
            statement = statement.where(or_(Wallet.balance_topup_kopeks < 0, Wallet.balance_included_kopeks < 0))
        elif status == 'paid':
            statement = statement.where(func.coalesce(payments.c.successful_payment_count, 0) > 0)
        elif status == 'never_paid':
            statement = statement.where(func.coalesce(payments.c.successful_payment_count, 0) == 0)
        elif status == 'problems':
            statement = statement.where(
                or_(
                    Wallet.balance_topup_kopeks < 0,
                    Wallet.balance_included_kopeks < 0,
                    func.coalesce(problems.c.uncredited_payment_count, 0) > 0,
                    func.coalesce(problems.c.stale_payment_count, 0) > 0,
                )
            )
        table = statement.subquery()
        total = int((await self.session.execute(select(func.count()).select_from(table))).scalar_one())
        key = {
            'paid': 'period_paid_kopeks',
            'spent': 'period_spent_kopeks',
            'balance': 'balance_topup_kopeks',
            'last_payment': 'last_payment_at',
            'last_usage': 'last_usage_at',
        }.get(sort, 'last_payment_at')
        column = table.c[key]
        ordering = column.desc().nulls_last() if direction == 'desc' else column.asc().nulls_last()
        rows = (
            (
                await self.session.execute(
                    select(table).order_by(ordering, table.c.user_id).offset((page - 1) * page_size).limit(page_size)
                )
            )
            .mappings()
            .all()
        )
        items = []
        for row in rows:
            item = dict(row)
            item.update(
                currency=currency,
                status=(
                    'negative_balance'
                    if row['balance_topup_kopeks'] < 0 or row['balance_included_kopeks'] < 0
                    else (
                        'payment_problem'
                        if row['uncredited_payment_count'] or row['stale_payment_count']
                        else 'healthy' if row['successful_payment_count'] else 'never_paid'
                    )
                ),
            )
            items.append(item)
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'currency': currency,
            'from': from_ts,
            'to': to_ts,
            'as_of': now,
            'payment_fact_limit_reached': False,
            'timezone': 'UTC',
            'lifetime_scope': 'all_history_through_as_of',
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
        now = int(time.time())
        period = await self.financial_totals(from_ts=from_ts, to_ts=to_ts, currency=currency, user_id=user_id)
        lifetime = await self.financial_totals(from_ts=0, to_ts=now + 1, currency=currency, user_id=user_id)
        payments, payment_total = await self.payment_page(
            from_ts=from_ts,
            to_ts=to_ts,
            currency=currency,
            user_id=user_id,
            status=None,
            kind=None,
            page=1,
            page_size=limit,
        )
        ledger, ledger_total = await self.ledger_rows(
            from_ts=from_ts, to_ts=to_ts, currency=currency, user_id=user_id, limit=limit, offset=0
        )
        usage, usage_total = await self.usage_rows(
            from_ts=from_ts, to_ts=to_ts, currency=currency, user_id=user_id, limit=limit, offset=0
        )
        refunds, refund_total = await self.refund_rows(
            from_ts=from_ts, to_ts=to_ts, currency=currency, user_id=user_id, limit=limit, offset=0
        )
        return {
            'user': {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role},
            'wallet': {
                'id': wallet.id if wallet else None,
                'currency': currency,
                'balance_topup_kopeks': int(wallet.balance_topup_kopeks or 0) if wallet else 0,
                'balance_included_kopeks': int(wallet.balance_included_kopeks or 0) if wallet else 0,
                'daily_spent_kopeks': int(wallet.daily_spent_kopeks or 0) if wallet else 0,
                'daily_cap_kopeks': wallet.daily_cap_kopeks if wallet else None,
                'daily_reserved_kopeks': int(wallet.daily_reserved_kopeks or 0) if wallet else 0,
                'topup_expires_at': wallet.topup_expires_at if wallet else None,
            },
            'metrics': {
                'paid_kopeks': lifetime['successful_payments_kopeks'],
                'period_paid_kopeks': period['successful_payments_kopeks'],
                'payment_count': lifetime['successful_payment_count'],
                'period_payment_count': period['successful_payment_count'],
                'spent_kopeks': lifetime['usage_spend_kopeks'],
                'period_spent_kopeks': period['usage_spend_kopeks'],
                'refund_kopeks': lifetime['refund_kopeks'],
                'period_refund_kopeks': period['refund_kopeks'],
                'other_payments_kopeks': lifetime['other_payments_kopeks'],
                'period_other_payments_kopeks': period['other_payments_kopeks'],
            },
            'payments': payments,
            'ledger': ledger,
            'usage': usage,
            'refunds': refunds,
            'record_totals': {
                'payments': payment_total,
                'ledger': ledger_total,
                'usage': usage_total,
                'refunds': refund_total,
            },
            'from': from_ts,
            'to': to_ts,
            'as_of': now,
            'timezone': 'UTC',
            'time_semantics': 'topup_ledger_refund_provider_created_at',
            'payment_fact_limit_reached': False,
        }

    async def ledger_rows(
        self,
        *,
        from_ts: int,
        to_ts: int,
        currency: str,
        user_id: str | None,
        limit: int,
        offset: int,
        reference_id: str | None = None,
    ) -> tuple[list[dict[str, object]], int]:
        if reference_id and not user_id:
            raise ValueError('Related wallet records require a customer')
        filters = [
            LedgerEntry.created_at >= (0 if reference_id else from_ts),
            LedgerEntry.created_at < (int(time.time()) + 1 if reference_id else to_ts),
            LedgerEntry.currency == currency,
        ]
        if user_id:
            filters.append(LedgerEntry.user_id == user_id)
        if reference_id:
            filters.append(LedgerEntry.reference_id == reference_id)
        stmt = (
            select(LedgerEntry, User.name, User.email)
            .outerjoin(User, User.id == LedgerEntry.user_id)
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
            UsageEvent.created_at < to_ts,
            Wallet.currency == currency,
        ]
        if user_id:
            filters.append(UsageEvent.user_id == user_id)
        stmt = (
            select(UsageEvent, User.name, User.email)
            .join(Wallet, Wallet.id == UsageEvent.wallet_id)
            .outerjoin(User, User.id == UsageEvent.user_id)
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
            'name': fact.name,
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
            'created_at': fact.created_at,
            'credited_at': fact.credited_at,
            'credit_status': fact.credit_status,
            'refunded_kopeks': fact.refunded_kopeks,
            'is_test': fact.is_test,
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
