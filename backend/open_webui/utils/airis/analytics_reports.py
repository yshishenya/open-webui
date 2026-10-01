"""Cohort reports over consented funnel facts, never chat content."""

import datetime as dt
from collections import defaultdict
from statistics import median
from typing import TypedDict

from open_webui.internal.db import get_async_db_context
from open_webui.models.analytics import AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing import LedgerEntry, Payment, PaymentKind
from open_webui.models.users import User
from open_webui.utils.airis.analytics import enabled_at
from open_webui.utils.airis.analytics_payments import _confirmed_query
from sqlalchemy import func, select


class EventFact(TypedDict):
    identity_id: str
    name: str
    timestamp: int
    properties: dict[str, str | int | bool]


class CohortRow(TypedDict):
    cohort: str
    visitors: int
    registered: int
    activated: int
    paid: int
    repeated: int
    mature_visitors: int
    mature_paid: int
    conversion_percent: float | None
    median_hours_to_pay: float | None


def cohort_rows(
    facts: list[EventFact],
    touches: dict[str, dict[str, str | int]],
    now: int,
    window_days: int,
    breakdown: str = 'week',
) -> list[CohortRow]:
    """Only fully observed visitors enter the final conversion denominator."""
    users: dict[str, list[EventFact]] = defaultdict(list)
    for fact in facts:
        users[fact['identity_id']].append(fact)
    groups: dict[str, list[tuple[int, list[EventFact]]]] = defaultdict(list)
    for identity_id, events in users.items():
        visits = [event['timestamp'] for event in events if event['name'] == 'product_first_visit']
        if not visits:
            continue
        first = min(visits)
        touch = touches.get(identity_id, {})
        if breakdown == 'week':
            iso = dt.datetime.fromtimestamp(first, dt.UTC).isocalendar()
            key = f'{iso.year}-W{iso.week:02}'
        else:
            key = str(touch.get(breakdown) or 'direct / unknown')
        groups[key].append((first, events))
    rows: list[CohortRow] = []
    window = window_days * 86400
    for key, visitors in sorted(groups.items()):
        row: CohortRow = {
            'cohort': key,
            'visitors': len(visitors),
            'registered': 0,
            'activated': 0,
            'paid': 0,
            'repeated': 0,
            'mature_visitors': 0,
            'mature_paid': 0,
            'conversion_percent': None,
            'median_hours_to_pay': None,
        }
        hours: list[float] = []
        for first, events in visitors:
            observed = [event for event in events if first <= event['timestamp'] <= min(now, first + window)]
            names = {event['name'] for event in observed}
            row['registered'] += int('signup_completed' in names)
            row['activated'] += int('first_response_received' in names)
            payments = sorted(event['timestamp'] for event in observed if event['name'] == 'payment_confirmed')
            first_payments = [
                event['timestamp']
                for event in observed
                if event['name'] == 'payment_confirmed' and event['properties'].get('is_first_payment') is True
            ]
            paid = bool(first_payments)
            row['paid'] += int(paid)
            row['repeated'] += int(paid and len(payments) > 1)
            mature = now >= first + window
            row['mature_visitors'] += int(mature)
            row['mature_paid'] += int(mature and paid)
            if first_payments:
                hours.append((min(first_payments) - first) / 3600)
        if row['mature_visitors']:
            row['conversion_percent'] = round(100 * row['mature_paid'] / row['mature_visitors'], 2)
        if hours:
            row['median_hours_to_pay'] = round(median(hours), 2)
        rows.append(row)
    return rows


async def funnel_report(start: int, end: int, now: int, window_days: int, breakdown: str) -> dict[str, object]:
    """Read-only administrator report: first visit cohort, not payment-month division."""
    async with get_async_db_context() as db:
        identities = (
            (await db.execute(select(AnalyticsIdentity).where(AnalyticsIdentity.consent.is_(True)))).scalars().all()
        )
        visits = (
            (
                await db.execute(
                    select(AnalyticsEvent.identity_id)
                    .where(AnalyticsEvent.event_name == 'product_first_visit')
                    .group_by(AnalyticsEvent.identity_id)
                    .having(func.min(AnalyticsEvent.occurred_at) >= start, func.min(AnalyticsEvent.occurred_at) < end)
                )
            )
            .scalars()
            .all()
        )
        cohort_ids = set(visits) & {identity.id for identity in identities}
        first_visits = (
            dict(
                (
                    await db.execute(
                        select(AnalyticsEvent.identity_id, func.min(AnalyticsEvent.occurred_at))
                        .where(
                            AnalyticsEvent.event_name == 'product_first_visit',
                            AnalyticsEvent.identity_id.in_(cohort_ids),
                        )
                        .group_by(AnalyticsEvent.identity_id)
                    )
                ).all()
            )
            if cohort_ids
            else {}
        )
        account_times = dict(
            (
                await db.execute(
                    select(User.id, User.created_at).where(
                        User.id.in_([identity.user_id for identity in identities if identity.user_id])
                    )
                )
            ).all()
        )
        legacy_ids = {
            identity.id
            for identity in identities
            if identity.id in cohort_ids
            and identity.user_id is not None
            and (
                account_times.get(identity.user_id) is None
                or account_times[identity.user_id] < max(first_visits[identity.id], enabled_at())
            )
        }
        cohort_ids -= legacy_ids
        events = (
            (
                await db.execute(
                    select(AnalyticsEvent).where(
                        AnalyticsEvent.identity_id.in_(cohort_ids), AnalyticsEvent.occurred_at <= now
                    )
                )
            )
            .scalars()
            .all()
            if cohort_ids
            else []
        )
        facts: list[EventFact] = [
            {
                'identity_id': event.identity_id,
                'name': event.event_name,
                'timestamp': int(event.occurred_at),
                'properties': event.properties or {},
            }
            for event in events
        ]
        # Every stage and event count uses the same per-visitor observation window.
        facts = [
            fact
            for fact in facts
            if first_visits[fact['identity_id']]
            <= fact['timestamp']
            <= min(now, first_visits[fact['identity_id']] + window_days * 86400)
        ]
        touches = {identity.id: identity.first_touch or {} for identity in identities}
        rows = cohort_rows(facts, touches, now, window_days, breakdown)
        event_counts: dict[str, int] = {}
        for fact in facts:
            event_counts[fact['name']] = event_counts.get(fact['name'], 0) + 1
        financial_rows = (
            await db.execute(_confirmed_query().where(LedgerEntry.created_at >= start, LedgerEntry.created_at < end))
        ).all()
        financial: dict[str, dict[str, int]] = {}
        seen_payments: set[str] = set()
        for payment, ledger in financial_rows:
            if payment.id in seen_payments:
                continue
            seen_payments.add(payment.id)
            bucket = financial.setdefault(payment.currency, {'confirmed_payments': 0, 'gross_kopeks': 0})
            bucket['confirmed_payments'] += 1
            bucket['gross_kopeks'] += int(payment.amount_kopeks)
        refunds = (
            await db.execute(
                select(AnalyticsRefund.currency, func.sum(AnalyticsRefund.amount_kopeks))
                .where(AnalyticsRefund.occurred_at >= start, AnalyticsRefund.occurred_at < end)
                .group_by(AnalyticsRefund.currency)
            )
        ).all()
        for currency, amount in refunds:
            financial.setdefault(currency, {'confirmed_payments': 0, 'gross_kopeks': 0})['refund_kopeks'] = int(amount)
        for bucket in financial.values():
            bucket.setdefault('refund_kopeks', 0)
            bucket['net_kopeks'] = bucket['gross_kopeks'] - bucket['refund_kopeks']
        created = (
            await db.execute(
                select(func.count(Payment.id)).where(
                    Payment.kind == PaymentKind.TOPUP.value, Payment.created_at >= start, Payment.created_at < end
                )
            )
        ).scalar_one()
        converted = (
            await db.execute(_confirmed_query().where(Payment.created_at >= start, Payment.created_at < end))
        ).all()
        confirmed_created = len({payment.id for payment, ledger in converted})
        payment_funnel = {
            'created': int(created),
            'confirmed': confirmed_created,
            'conversion_percent': round(100 * confirmed_created / created, 2) if created else None,
        }
        stages = {
            name: len({fact['identity_id'] for fact in facts if fact['name'] == name})
            for name in [
                'product_first_visit',
                'landing_cta_click',
                'signup_form_viewed',
                'signup_started',
                'signup_completed',
                'first_prompt_submitted',
                'first_response_received',
                'billing_wallet_view',
                'billing_wallet_topup_package_click',
                'billing_wallet_topup_custom_submit',
                'payment_created',
                'payment_confirmed',
            ]
        }
        states = (
            await db.execute(
                select(AnalyticsDelivery.destination, AnalyticsDelivery.state, func.count()).group_by(
                    AnalyticsDelivery.destination, AnalyticsDelivery.state
                )
            )
        ).all()
        delivery = [{'destination': dest, 'state': state, 'count': count} for dest, state, count in states]
        return {
            'payment_funnel': payment_funnel,
            'stages': stages,
            'financial': financial,
            'delivery': delivery,
            'window_days': window_days,
            'rows': rows,
            'events': event_counts,
            'coverage': {
                'consented_identities': len(identities),
                'linked_accounts': sum(identity.user_id is not None for identity in identities),
                'excluded_existing_accounts': len(legacy_ids),
            },
            'limitations': [
                'Consented observed visitors only; blocked or unconsented visits are absent.',
                'Account creation is server-derived; activation is an observed client success.',
                'Fresh cohorts have no final conversion until their observation window closes.',
                'Anonymous devices cannot be linked before login.',
                'Accounts predating their first observed visit or rollout are excluded from acquisition cohorts; '
                'financial totals still include them.',
            ],
            'generated_at': now,
        }
