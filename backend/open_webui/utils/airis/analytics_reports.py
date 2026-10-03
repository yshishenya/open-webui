"""Cohort reports over consented funnel facts, never chat content."""

import datetime as dt
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from statistics import median
from typing import TypedDict

from open_webui.internal.db import get_async_db_context
from open_webui.models.analytics import AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
from open_webui.models.analytics_refunds import AnalyticsRefund
from open_webui.models.billing import Payment, PaymentKind
from open_webui.models.users import User
from open_webui.utils.airis.analytics import enabled_at
from open_webui.utils.airis.billing_reporting_facts import live_refund_condition, payment_table
from sqlalchemy import func, or_, select

SEQUENCE_KEYS = (
    'visitors',
    'registered',
    'responded',
    'paid_after_response',
    'paid_before_response',
    'paid_without_observed_response',
    'incomplete_paid',
)


def empty_sequence() -> dict[str, int]:
    return {key: 0 for name in SEQUENCE_KEYS for key in (name, 'mature_' + name)}


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
    immature_visitors: int
    next_maturity_at: int | None
    sequence: dict[str, int]


def percentage(count: int, denominator: int) -> float | None:
    """Round percentages consistently, including exact half-cent boundaries."""
    if not denominator:
        return None
    return float((Decimal(count) * 100 / Decimal(denominator)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def visitor_sequence(events: list[EventFact], first: int) -> dict[str, int]:
    """Count ordered observations; a missing event never proves the action was absent."""

    def earliest(name: str, after: int) -> int | None:
        return min(
            (event['timestamp'] for event in events if event['name'] == name and event['timestamp'] >= after),
            default=None,
        )

    registered = earliest('signup_completed', first)
    responded = earliest('first_response_received', registered) if registered is not None else None
    payment = min(
        (
            event['timestamp']
            for event in events
            if event['name'] == 'payment_confirmed' and event['properties'].get('is_first_payment') is True
        ),
        default=None,
    )
    result = dict.fromkeys(SEQUENCE_KEYS, 0)
    result['visitors'] = 1
    result['registered'] = int(registered is not None)
    result['responded'] = int(responded is not None)
    if payment is not None:
        if registered is None or payment < registered:
            result['incomplete_paid'] = 1
        elif responded is not None:
            result['paid_after_response' if payment >= responded else 'paid_before_response'] = 1
        else:
            result['paid_without_observed_response'] = 1
    return result


def cohort_key(first: int, touch: dict[str, str | int], breakdown: str) -> str:
    if breakdown == 'week':
        iso = dt.datetime.fromtimestamp(first, dt.UTC).isocalendar()
        return f'{iso.year}-W{iso.week:02}'
    return str(touch.get(breakdown) or 'unknown')


def cohort_rows(
    facts: list[EventFact],
    touches: dict[str, dict[str, str | int]],
    now: int,
    window_days: int,
    breakdown: str = 'week',
) -> list[CohortRow]:
    """Keep attained stages separate from ordered paths and mature denominators."""
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
        key = cohort_key(first, touch, breakdown)
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
            'immature_visitors': 0,
            'next_maturity_at': None,
            'sequence': empty_sequence(),
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
            for name, value in visitor_sequence(observed, first).items():
                row['sequence'][name] = row['sequence'].get(name, 0) + value
                row['sequence']['mature_' + name] = row['sequence'].get('mature_' + name, 0) + int(mature) * value
            if not mature:
                row['next_maturity_at'] = min(row['next_maturity_at'] or first + window, first + window)
            if first_payments:
                hours.append((min(first_payments) - first) / 3600)
        row['immature_visitors'] = row['visitors'] - row['mature_visitors']
        row['conversion_percent'] = percentage(row['mature_paid'], row['mature_visitors'])
        if hours:
            row['median_hours_to_pay'] = float(
                Decimal(str(median(hours))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            )
        rows.append(row)
    return rows


def cohort_summary(rows: list[CohortRow]) -> tuple[dict[str, int | float | None], dict[str, int]]:
    """Sum denominators, never average independently rounded row percentages."""
    keys = [
        'visitors',
        'registered',
        'activated',
        'paid',
        'repeated',
        'mature_visitors',
        'mature_paid',
        'immature_visitors',
    ]
    summary: dict[str, int | float | None] = {key: sum(row[key] for row in rows) for key in keys}
    summary['conversion_percent'] = percentage(int(summary['mature_paid']), int(summary['mature_visitors']))
    summary['next_maturity_at'] = min(
        (row['next_maturity_at'] for row in rows if row['next_maturity_at'] is not None), default=None
    )
    sequence = empty_sequence()
    for row in rows:
        for name, value in row['sequence'].items():
            sequence[name] = sequence.get(name, 0) + value
    return summary, sequence


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
        test_payment_ids = set(
            (await db.execute(select(Payment.id).where(Payment.raw_payload_json['test'].as_boolean().is_(True))))
            .scalars()
            .all()
        )
        facts: list[EventFact] = [
            {
                'identity_id': event.identity_id,
                'name': event.event_name,
                'timestamp': int(event.occurred_at),
                'properties': event.properties or {},
            }
            for event in events
            if (event.properties or {}).get('payment_id') not in test_payment_ids
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
        payments_table = payment_table()
        genuine = or_(payments_table.c.is_test.is_(None), payments_table.c.is_test.is_(False))
        financial_rows = (
            await db.execute(
                select(payments_table.c.currency, func.count(), func.sum(payments_table.c.amount_kopeks))
                .where(
                    payments_table.c.credit_status == 'credited',
                    genuine,
                    payments_table.c.credited_at >= start,
                    payments_table.c.credited_at < end,
                )
                .group_by(payments_table.c.currency)
            )
        ).all()
        financial: dict[str, dict[str, int]] = {
            currency: {'confirmed_payments': int(count), 'gross_kopeks': int(amount)}
            for currency, count, amount in financial_rows
        }
        refunds = (
            await db.execute(
                select(AnalyticsRefund.currency, func.sum(AnalyticsRefund.amount_kopeks))
                .where(AnalyticsRefund.occurred_at >= start, AnalyticsRefund.occurred_at < end, live_refund_condition())
                .group_by(AnalyticsRefund.currency)
            )
        ).all()
        for currency, amount in refunds:
            financial.setdefault(currency, {'confirmed_payments': 0, 'gross_kopeks': 0})['refund_kopeks'] = int(amount)
        for bucket in financial.values():
            bucket.setdefault('refund_kopeks', 0)
            bucket['net_kopeks'] = bucket['gross_kopeks'] - bucket['refund_kopeks']
        attempt_conditions = [
            payments_table.c.kind == PaymentKind.TOPUP.value,
            genuine,
            payments_table.c.created_at >= start,
            payments_table.c.created_at < end,
        ]
        created = (
            await db.execute(select(func.count()).select_from(payments_table).where(*attempt_conditions))
        ).scalar_one()
        confirmed_created = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(payments_table)
                    .where(*attempt_conditions, payments_table.c.credit_status == 'credited')
                )
            ).scalar_one()
        )
        payment_funnel = {
            'created': int(created),
            'confirmed': confirmed_created,
            'conversion_percent': percentage(confirmed_created, int(created)),
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
        summary, sequence = cohort_summary(rows)
        return {
            'summary': summary,
            'sequence': sequence,
            'start': start,
            'end': end,
            'timezone': 'UTC',
            'rounding': 'ROUND_HALF_UP',
            'coverage_scope': 'lifetime_current',
            'delivery_scope': 'lifetime_current',
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
