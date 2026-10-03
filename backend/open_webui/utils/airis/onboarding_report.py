"""Read-only registration cohorts from foreground success and applied wallet credit."""

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal
from zoneinfo import ZoneInfo

from open_webui.internal.db import get_async_db_context
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import EmailDelivery
from open_webui.models.email_preferences import (
    SUPPRESSION_DAYS,
    EmailPreference,
    EmailPreferenceEvent,
    ProductEmailPreference,
    email_fingerprint,
    evaluate_preference,
    valid_product_address,
)
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils.airis.email_scenarios import DAY, canceled_condition, credited_condition
from open_webui.utils.airis.mail_outcome_report import (
    MailOutcome,
    MailTypeSummary,
    mail_snapshot,
    summarize_mail_outcomes,
)
from pydantic import BaseModel
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only
from sqlalchemy.sql.elements import ColumnElement

REPORT_VERSION = 'registration-v1'
MAX_ACCOUNTS = 10000
SMALL_SAMPLE = 10


class MatureRate(BaseModel):
    count: int
    denominator: int
    fraction: float | None
    immature: int
    small_sample: bool


class PaymentFunnel(BaseModel):
    status_snapshot_at: int
    created_attempts: int
    users_with_attempts: int
    credited_attempts: int
    credited_users: int
    attempt_to_credit_fraction: float | None
    user_to_credit_fraction: float | None
    states_now: dict[str, int]
    cancellation_reason: None = None


class RegistrationCohort(BaseModel):
    date: str
    consent_segment: Literal['current_opt_in', 'no_current_opt_in']
    registrations: int
    suitable_verified_address_now: int
    product_eligible_now: int
    eligibility_reasons_now: dict[str, int]
    welcome_accepted_registrations: int
    first_success_24h: MatureRate
    first_success_7d: MatureRate
    return_7d: MatureRate
    paid_users_14d: MatureRate
    confirmed_payments_14d_mature: int
    payment_attempts_14d_mature: PaymentFunnel
    mail_outcomes: list[MailOutcome]
    mail_summary: list[MailTypeSummary]


class RegistrationReport(BaseModel):
    version: str = REPORT_VERSION
    generated_at: int
    start_at: int
    end_at: int
    observed_from: int
    timezone: str
    small_sample_below: int = SMALL_SAMPLE
    registrations: int
    exclusions: dict[str, int]
    cohorts: list[RegistrationCohort]
    mail_summary: list[MailTypeSummary]
    historical_mail_eligibility: None = None
    delivered: None = None
    inbox: None = None
    useful_response: None = None
    email_clicks: None = None
    limitations: list[str]


@dataclass(frozen=True)
class AccountFact:
    id: str
    registered_at: int
    suitable_address: bool
    preference: ProductEmailPreference
    first_success: int | None
    last_success: int | None
    paid_count: int


def mature_rate(accounts: list[AccountFact], now: int, window: int, qualified: set[str]) -> MatureRate:
    """Count only accounts whose entire observation window has elapsed."""
    mature = [account for account in accounts if account.registered_at + window <= now]
    count = sum(account.id in qualified for account in mature)
    denominator = len(mature)
    return MatureRate(
        count=count,
        denominator=denominator,
        fraction=count / denominator if denominator else None,
        immature=len(accounts) - denominator,
        small_sample=denominator < SMALL_SAMPLE,
    )


def calendar_date(timestamp: int, timezone: ZoneInfo) -> str:
    """Use the explicitly requested calendar, independent of host timezone."""
    return dt.datetime.fromtimestamp(timestamp, timezone).date().isoformat()


def cohort_metrics(accounts: list[AccountFact], now: int, timezone: ZoneInfo) -> dict[str, MatureRate]:
    """Keep activation, return and credit as distinct mature measures."""
    successful = {account.id for account in accounts if account.first_success is not None}
    first_day = {
        account.id
        for account in accounts
        if account.first_success is not None and account.first_success < account.registered_at + DAY
    }
    returned = {
        account.id
        for account in accounts
        if account.first_success is not None
        and account.last_success is not None
        and calendar_date(account.last_success, timezone) != calendar_date(account.first_success, timezone)
    }
    paid = {account.id for account in accounts if account.paid_count}
    return {
        'first_success_24h': mature_rate(accounts, now, DAY, first_day),
        'first_success_7d': mature_rate(accounts, now, 7 * DAY, successful),
        'return_7d': mature_rate(accounts, now, 7 * DAY, returned),
        'paid_users_14d': mature_rate(accounts, now, 14 * DAY, paid),
    }


async def success_times(session: AsyncSession, ids: list[str], now: int) -> dict[str, tuple[int, int]]:
    """Aggregate authoritative foreground times inside the seven-day window."""
    rows = (
        await session.execute(
            select(TaskSuccess.user_id, func.min(TaskSuccess.completed_at), func.max(TaskSuccess.completed_at))
            .join(User, User.id == TaskSuccess.user_id)
            .where(
                TaskSuccess.user_id.in_(ids),
                TaskSuccess.kind == 'foreground_chat',
                TaskSuccess.completed_at >= User.created_at,
                TaskSuccess.completed_at < User.created_at + 7 * DAY,
                TaskSuccess.completed_at <= now,
            )
            .group_by(TaskSuccess.user_id)
        )
    ).all()
    return {uid: (first, last) for uid, first, last in rows}


async def payment_counts(session: AsyncSession, ids: list[str], now: int) -> dict[str, int]:
    """Count distinct applied, provider-backed credits at ledger time."""
    rows = (
        await session.execute(
            select(Payment.user_id, func.count(func.distinct(Payment.id)))
            .join(User, User.id == Payment.user_id)
            .join(
                LedgerEntry,
                and_(
                    LedgerEntry.user_id == Payment.user_id,
                    LedgerEntry.wallet_id == Payment.wallet_id,
                    LedgerEntry.reference_type == 'payment',
                    LedgerEntry.reference_id == Payment.provider_payment_id,
                    LedgerEntry.type == 'topup',
                    LedgerEntry.amount_kopeks == Payment.amount_kopeks,
                    LedgerEntry.currency == Payment.currency,
                ),
            )
            .where(
                Payment.user_id.in_(ids),
                credited_condition(),
                LedgerEntry.created_at >= User.created_at,
                LedgerEntry.created_at < User.created_at + 14 * DAY,
                LedgerEntry.created_at <= now,
            )
            .group_by(Payment.user_id)
        )
    ).all()
    return dict(rows)


def attempt_state(now: int) -> ColumnElement[str]:
    """Classify only recorded provider and exact in-window credit facts."""
    credit_at = (
        select(func.min(LedgerEntry.created_at))
        .where(
            LedgerEntry.user_id == Payment.user_id,
            LedgerEntry.wallet_id == Payment.wallet_id,
            LedgerEntry.reference_type == 'payment',
            LedgerEntry.reference_id == Payment.provider_payment_id,
            LedgerEntry.type == 'topup',
            LedgerEntry.amount_kopeks == Payment.amount_kopeks,
            LedgerEntry.currency == Payment.currency,
        )
        .correlate(Payment)
        .scalar_subquery()
    )
    return case(
        (Payment.updated_at > now, 'unresolved'),
        (
            and_(credited_condition(), credit_at >= User.created_at, credit_at < User.created_at + 14 * DAY),
            'credited',
        ),
        (
            and_(
                Payment.status == 'succeeded',
                Payment.provider_payment_id.is_not(None),
                Payment.provider_payment_id != '',
                Payment.status_details['yookassa_status'].as_string() == 'succeeded',
            ),
            'succeeded_without_window_credit',
        ),
        (canceled_condition(), 'canceled'),
        (
            and_(Payment.status == 'failed', Payment.status_details['yookassa_status'].as_string() == 'create_failed'),
            'local_create_failed',
        ),
        (
            and_(
                Payment.status.in_(['created', 'pending']),
                Payment.status_details['yookassa_status']
                .as_string()
                .in_(['creating', 'pending', 'waiting_for_capture']),
            ),
            'processing',
        ),
        else_='unresolved',
    )


async def payment_funnel(session: AsyncSession, ids: list[str], now: int) -> PaymentFunnel:
    """Group current outcomes of attempts initiated inside fully mature registration windows."""
    attempts = (
        select(Payment.user_id.label('account'), attempt_state(now).label('state'))
        .join(User, User.id == Payment.user_id)
        .where(
            Payment.user_id.in_(ids),
            User.created_at + 14 * DAY <= now,
            Payment.provider == 'yookassa',
            Payment.kind == 'topup',
            Payment.created_at >= User.created_at,
            Payment.created_at < User.created_at + 14 * DAY,
        )
        .subquery()
    )
    total, users, credited, credited_users = (
        await session.execute(
            select(
                func.count(),
                func.count(func.distinct(attempts.c.account)),
                func.count(case((attempts.c.state == 'credited', 1))),
                func.count(func.distinct(case((attempts.c.state == 'credited', attempts.c.account)))),
            ).select_from(attempts)
        )
    ).one()
    states = dict((await session.execute(select(attempts.c.state, func.count()).group_by(attempts.c.state))).all())
    return PaymentFunnel(
        status_snapshot_at=now,
        created_attempts=total,
        users_with_attempts=users,
        credited_attempts=credited,
        credited_users=credited_users,
        attempt_to_credit_fraction=credited / total if total else None,
        user_to_credit_fraction=credited_users / users if users else None,
        states_now=states,
    )


async def account_facts(session: AsyncSession, ids: list[str], now: int) -> list[AccountFact]:
    """Bulk-read permission inputs without credentials or chat content."""
    rows = (
        await session.execute(
            select(User, EmailPreference, Auth.active)
            .options(load_only(User.id, User.email, User.role, User.created_at, User.email_verified))
            .outerjoin(EmailPreference, EmailPreference.user_id == User.id)
            .outerjoin(Auth, Auth.id == User.id)
            .where(User.id.in_(ids))
        )
    ).all()
    hashes = {email_fingerprint(user.email) for user, _, _ in rows}
    suppressed = set(
        (
            await session.scalars(
                select(EmailPreferenceEvent.email_hash).where(
                    EmailPreferenceEvent.email_hash.in_(hashes),
                    EmailPreferenceEvent.action.in_(['hard_bounce', 'complaint']),
                    EmailPreferenceEvent.created_at >= now - SUPPRESSION_DAYS * DAY,
                    EmailPreferenceEvent.created_at <= now,
                )
            )
        ).all()
    )
    successes = await success_times(session, ids, now)
    payments = await payment_counts(session, ids, now)
    return [
        AccountFact(
            id=user.id,
            registered_at=user.created_at,
            suitable_address=bool(user.email_verified and valid_product_address(user.email)),
            preference=evaluate_preference(user, preference, bool(active), email_fingerprint(user.email) in suppressed),
            first_success=successes.get(user.id, (None, None))[0],
            last_success=successes.get(user.id, (None, None))[1],
            paid_count=payments.get(user.id, 0),
        )
        for user, preference, active in rows
    ]


async def registration_population(
    session: AsyncSession, start: int, end: int, observed_from: int, now: int, excluded_ids: frozenset[str]
) -> tuple[list[str], dict[str, int]]:
    """Exclude explicit non-cohort accounts without silently truncating results."""
    rows = (
        await session.execute(
            select(User.id, User.role, User.created_at)
            .where(User.created_at >= start, User.created_at < end, User.created_at <= now)
            .limit(MAX_ACCOUNTS + 1)
        )
    ).all()
    # ponytail: bounded in-memory cohorts; narrow the range now, SQL bucket aggregation if >10000 matters.
    if len(rows) > MAX_ACCOUNTS:
        raise OverflowError('Report exceeds 10000 accounts; narrow the registration range')
    exclusions = {'non_user_role': 0, 'explicit_test_account': 0, 'before_observation_start': 0}
    ids: list[str] = []
    for uid, role, registered in rows:
        if role != 'user':
            exclusions['non_user_role'] += 1
        elif uid in excluded_ids:
            exclusions['explicit_test_account'] += 1
        elif registered < observed_from:
            exclusions['before_observation_start'] += 1
        else:
            ids.append(uid)
    return ids, exclusions


async def registration_cohort(
    session: AsyncSession, accounts: list[AccountFact], date: str, subscribed: bool, now: int, timezone: ZoneInfo
) -> RegistrationCohort:
    """Combine one registration-day and current-consent segment."""
    ids = [account.id for account in accounts]
    reasons: dict[str, int] = defaultdict(int)
    for account in accounts:
        reasons[account.preference.reason] += 1
    welcome = await session.scalar(
        select(func.count(func.distinct(EmailDelivery.user_id))).where(
            EmailDelivery.user_id.in_(ids),
            EmailDelivery.type == 'welcome',
            EmailDelivery.status == 'accepted',
            EmailDelivery.accepted_at <= now,
        )
    )
    outcomes, summaries = await mail_snapshot(session, ids, now)
    return RegistrationCohort(
        date=date,
        consent_segment='current_opt_in' if subscribed else 'no_current_opt_in',
        registrations=len(accounts),
        suitable_verified_address_now=sum(account.suitable_address for account in accounts),
        product_eligible_now=sum(account.preference.can_receive for account in accounts),
        eligibility_reasons_now=dict(reasons),
        welcome_accepted_registrations=welcome,
        confirmed_payments_14d_mature=sum(
            account.paid_count for account in accounts if account.registered_at + 14 * DAY <= now
        ),
        mail_outcomes=outcomes,
        mail_summary=summaries,
        payment_attempts_14d_mature=await payment_funnel(session, ids, now),
        **cohort_metrics(accounts, now, timezone),
    )


async def registration_report(
    start: int, end: int, observed_from: int, now: int, timezone: ZoneInfo, excluded_ids: frozenset[str]
) -> RegistrationReport:
    """Take one consistent operational snapshot; historical coverage is explicit."""
    async with get_async_db_context() as session:
        if session.get_bind().dialect.name == 'postgresql':
            await session.connection(execution_options={'isolation_level': 'REPEATABLE READ'})
        ids, exclusions = await registration_population(session, start, end, observed_from, now, excluded_ids)
        facts = await account_facts(session, ids, now) if ids else []
        groups: dict[tuple[str, bool], list[AccountFact]] = defaultdict(list)
        for account in facts:
            groups[(calendar_date(account.registered_at, timezone), account.preference.subscribed)].append(account)
        cohorts = [
            await registration_cohort(session, accounts, date, subscribed, now, timezone)
            for (date, subscribed), accounts in sorted(groups.items())
        ]
        return RegistrationReport(
            generated_at=now,
            start_at=start,
            end_at=end,
            observed_from=observed_from,
            timezone=timezone.key,
            registrations=len(facts),
            exclusions=exclusions,
            cohorts=cohorts,
            mail_summary=summarize_mail_outcomes(
                [row for cohort in cohorts for row in cohort.mail_outcomes],
                {
                    kind: sum(
                        row.queued_accounts for cohort in cohorts for row in cohort.mail_summary if row.type == kind
                    )
                    for kind in {row.type for cohort in cohorts for row in cohort.mail_summary}
                },
                now,
            ),
            limitations=[
                'Existing ordinary accounts only; privacy-deleted registration history is unavailable.',
                'Explicit test IDs are operator-supplied; unmarked test accounts cannot be inferred.',
                'observed_from must match the recorded durable-success launch; older proxy data is excluded.',
                'Consent and eligibility are current state; historical and causal comparisons are unavailable.',
                'Events use half-open windows; immature accounts are excluded from final fractions.',
                'Return requires a foreground success on a different calendar day within registration+7d.',
                'Credit needs provider proof and applied ledger funds; gross conversion is not retained revenue.',
                'Attempt funnel uses attempts initiated in registration+14d for mature accounts; statuses are current.',
                'Detailed cancellation causes are not retained; local create_failed is a separate observation.',
                'Queue acceptance is SMTP acceptance; receipt/bounce/complaint counts are recorded observations only.',
                'Job and account totals are separate; historical eligibility and receipt coverage are unknown.',
                'States are current; the timestamp cutoff limits jobs and receipts, not state history.',
                'Delivery/Inbox rates, response usefulness, email clicks and causal effects are unavailable.',
            ],
        )
