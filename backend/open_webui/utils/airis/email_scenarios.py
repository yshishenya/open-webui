"""Reconstruct email candidates from authoritative account/payment facts."""

import os
import time
from dataclasses import dataclass

from open_webui.internal.db import get_async_db_context
from open_webui.models.auths import Auth
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.email_delivery import (
    SUBMISSION_WINDOW_SECONDS,
    DeliveryView,
    EmailDelivery,
    EmailType,
    enqueue_email,
)
from open_webui.models.email_preferences import EmailPreference, preference_for_user
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

DAY = 86400
ONBOARDING_VERSION = 'onboarding_v1'
RELEASE_A = ('welcome', 'activation_24h')
RELEASE_B = ('topup_credited', 'paid_value_72h', 'payment_help_72h', 'feedback_14d')


@dataclass(frozen=True)
class EmailQueueConfig:
    enabled: bool = False
    release_a: bool = False
    release_b: bool = False
    dry_run: bool = True
    pilot_only: bool = True
    pilot_user_ids: frozenset[str] = frozenset()
    start_at: int = 0
    credited_start_at: int = 0

    @classmethod
    def from_env(cls) -> 'EmailQueueConfig':
        def flag(name: str, default: str = 'false') -> bool:
            return os.getenv(name, default).lower() == 'true'

        return cls(
            enabled=flag('AIRIS_EMAIL_QUEUE_ENABLED'),
            release_a=flag('AIRIS_EMAIL_RELEASE_A_ENABLED'),
            release_b=flag('AIRIS_EMAIL_RELEASE_B_ENABLED'),
            dry_run=flag('AIRIS_EMAIL_DRY_RUN', 'true'),
            pilot_only=flag('AIRIS_EMAIL_PILOT_ONLY', 'true'),
            pilot_user_ids=frozenset(
                value.strip() for value in os.getenv('AIRIS_EMAIL_PILOT_USER_IDS', '').split(',') if value.strip()
            ),
            start_at=int(os.getenv('AIRIS_EMAIL_ONBOARDING_START_AT', '0')),
            credited_start_at=int(os.getenv('AIRIS_EMAIL_CREDITED_START_AT', '0')),
        )

    def allows(self, user_id: str, email_type: str) -> bool:
        return (
            self.enabled
            and not self.dry_run
            and (not self.pilot_only or user_id in self.pilot_user_ids)
            and ((self.release_a and email_type in RELEASE_A) or (self.release_b and email_type in RELEASE_B))
        )


@dataclass(frozen=True)
class ScenarioDecision:
    reason: str = 'ready'
    defer_until: int | None = None


def credited_condition(credited_since: int | None = None) -> ColumnElement[bool]:
    """Provider success alone is insufficient: a matching applied ledger credit is required."""
    return and_(
        Payment.provider == 'yookassa',
        Payment.kind == 'topup',
        Payment.status == 'succeeded',
        Payment.provider_payment_id.is_not(None),
        Payment.provider_payment_id != '',
        Payment.amount_kopeks > 0,
        Payment.status_details['yookassa_status'].as_string() == 'succeeded',
        exists(
            select(LedgerEntry.id)
            .correlate(Payment)
            .where(
                LedgerEntry.user_id == Payment.user_id,
                LedgerEntry.wallet_id == Payment.wallet_id,
                LedgerEntry.reference_type == 'payment',
                LedgerEntry.reference_id == Payment.provider_payment_id,
                LedgerEntry.type == 'topup',
                LedgerEntry.amount_kopeks == Payment.amount_kopeks,
                LedgerEntry.currency == Payment.currency,
                LedgerEntry.created_at >= credited_since if credited_since is not None else True,
            )
        ),
    )


def canceled_condition() -> ColumnElement[bool]:
    """Only a recorded final provider cancellation can trigger payment help."""
    return and_(
        Payment.provider == 'yookassa',
        Payment.kind == 'topup',
        Payment.status == 'canceled',
        Payment.provider_payment_id.is_not(None),
        Payment.provider_payment_id != '',
        func.coalesce(Payment.status_details['yookassa_status'].as_string(), '') == 'canceled',
    )


async def queue_welcome(user_id: str) -> bool:
    """All signup/verification/provider callers share one idempotent durable boundary."""
    config = EmailQueueConfig.from_env()
    if not config.allows(user_id, 'welcome') or config.start_at <= 0:
        return False
    now = int(time.time())
    async with get_async_db_context() as session:
        user = await session.scalar(select(User).where(User.id == user_id).with_for_update())
        if (
            not user
            or user.role != 'user'
            or user.created_at < config.start_at
            or not user.created_at <= now < user.created_at + 7 * DAY
            or not (await preference_for_user(session, user, now)).can_receive
        ):
            return False
        result = await enqueue_email(session, user.id, 'welcome', ONBOARDING_VERSION, now, user.created_at + 7 * DAY)
        await session.commit()
        return result is not None


async def latest_help_payment(session: AsyncSession, user_id: str, now: int) -> Payment | None:
    # Pending/creating/waiting_for_capture are unresolved provider checks, never a help trigger.
    return await session.scalar(
        select(Payment)
        .where(
            Payment.user_id == user_id,
            canceled_condition(),
            Payment.created_at > now - 7 * DAY,
        )
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .limit(1)
    )


async def recent_submission(
    session: AsyncSession, user_id: str, job_id: str, email_type: str | None = None
) -> int | None:
    # Unknown/active submissions conservatively reserve the entire bounded SMTP operation.
    query = select(
        func.max(func.coalesce(EmailDelivery.accepted_at, EmailDelivery.submitted_at + SUBMISSION_WINDOW_SECONDS))
    ).where(
        EmailDelivery.user_id == user_id,
        EmailDelivery.category == 'product',
        EmailDelivery.id != job_id,
        EmailDelivery.status.in_(['accepted', 'unknown', 'claimed']),
    )
    if email_type is not None:
        query = query.where(EmailDelivery.type == email_type)
    return await session.scalar(query)


async def unresolved_payment(session: AsyncSession, user_id: str, since: int) -> bool:
    return bool(
        await session.scalar(
            select(Payment.id)
            .where(
                Payment.user_id == user_id,
                Payment.kind == 'topup',
                Payment.provider == 'yookassa',
                ~func.coalesce(or_(credited_condition(), canceled_condition()), False),
                Payment.created_at >= since,
            )
            .limit(1)
        )
    )


async def activation_decision(session: AsyncSession, user: User, job: DeliveryView, now: int) -> ScenarioDecision:
    if await session.scalar(select(TaskSuccess.operation_id).where(TaskSuccess.user_id == user.id).limit(1)):
        return ScenarioDecision('activation')
    welcome_at = await session.scalar(
        select(EmailDelivery.accepted_at).where(
            EmailDelivery.user_id == user.id,
            EmailDelivery.type == 'welcome',
            EmailDelivery.status == 'accepted',
            EmailDelivery.scenario_key == ONBOARDING_VERSION,
        )
    )
    if welcome_at is None:
        return ScenarioDecision('welcome_pending', now + 300)
    due = max(user.created_at + DAY, welcome_at + DAY)
    return ScenarioDecision('welcome_window', due) if now < due else ScenarioDecision()


async def paid_value_decision(session: AsyncSession, user: User, job: DeliveryView, now: int) -> ScenarioDecision:
    if not await session.scalar(select(TaskSuccess.operation_id).where(TaskSuccess.user_id == user.id).limit(1)):
        return ScenarioDecision('no_activation')
    if await session.scalar(select(Payment.id).where(Payment.user_id == user.id, credited_condition()).limit(1)):
        return ScenarioDecision('credited')
    if await latest_help_payment(session, user.id, now) or await unresolved_payment(session, user.id, now - 7 * DAY):
        return ScenarioDecision('payment_priority')
    return ScenarioDecision()


async def payment_help_decision(session: AsyncSession, user: User, job: DeliveryView, now: int) -> ScenarioDecision:
    payment = await latest_help_payment(session, user.id, now)
    if not payment or payment.id != job.payment_id:
        return ScenarioDecision('payment_priority')
    if await session.scalar(
        select(Payment.id)
        .where(
            Payment.user_id == user.id,
            credited_condition(credited_since=payment.created_at),
        )
        .limit(1)
    ):
        return ScenarioDecision('credited')
    if await unresolved_payment(session, user.id, now - 7 * DAY):
        return ScenarioDecision('payment_priority')
    if now < payment.created_at + 3 * DAY:
        return ScenarioDecision('scenario_window', payment.created_at + 3 * DAY)
    previous = await recent_submission(session, user.id, job.id, 'payment_help_72h')
    if previous is not None and previous + 7 * DAY > now:
        return ScenarioDecision('frequency', previous + 7 * DAY)
    return ScenarioDecision()


async def scenario_decision(session: AsyncSession, user: User, job: DeliveryView, now: int) -> ScenarioDecision:
    """Repeat time and scenario checks immediately before transport submission."""
    if job.expires_at is not None and now >= job.expires_at:
        return ScenarioDecision('expired')
    if job.type == 'topup_credited':
        credited = await session.scalar(
            select(Payment.id).where(
                Payment.id == job.payment_id,
                Payment.user_id == user.id,
                credited_condition(),
            )
        )
        return ScenarioDecision('ready' if credited else 'credit_unconfirmed')
    minimum = {
        'welcome': user.created_at,
        'activation_24h': user.created_at + DAY,
        'paid_value_72h': user.created_at + 3 * DAY,
        'payment_help_72h': job.due_at,
        'feedback_14d': user.created_at + 14 * DAY,
    }
    if job.type not in minimum:
        return ScenarioDecision('invalid_scenario')
    if now < max(job.due_at, minimum[job.type]):
        return ScenarioDecision('scenario_window', max(job.due_at, minimum[job.type]))
    if job.type in {'welcome', 'activation_24h', 'paid_value_72h'} and now >= user.created_at + 7 * DAY:
        return ScenarioDecision('expired')
    checks = {
        'activation_24h': activation_decision,
        'paid_value_72h': paid_value_decision,
        'payment_help_72h': payment_help_decision,
    }
    return await checks[job.type](session, user, job, now) if job.type in checks else ScenarioDecision()


# ponytail: each instance scans bounded pages; persist cursors only if restart churn prevents completing a scan.
_account_cursor: tuple[int, str] = (0, '')
_payment_cursor: tuple[int, str] = (0, '')


def account_scenarios(user: User, config: EmailQueueConfig, now: int) -> list[tuple[EmailType, int, int]]:
    jobs: list[tuple[EmailType, int, int]] = []
    if config.release_a and now < user.created_at + 7 * DAY:
        jobs.extend(
            [
                ('welcome', now, user.created_at + 7 * DAY),
                ('activation_24h', user.created_at + DAY, user.created_at + 7 * DAY),
            ]
        )
    if config.release_b:
        if now < user.created_at + 7 * DAY:
            jobs.append(('paid_value_72h', user.created_at + 3 * DAY, user.created_at + 7 * DAY))
        jobs.append(('feedback_14d', user.created_at + 14 * DAY, user.created_at + 21 * DAY))
    return jobs


async def account_candidates(session: AsyncSession, config: EmailQueueConfig, now: int, limit: int) -> list[User]:
    if config.start_at <= 0:
        return []
    query = (
        select(User)
        .join(Auth, Auth.id == User.id)
        .join(EmailPreference, EmailPreference.user_id == User.id)
        .where(
            User.role == 'user',
            Auth.active.is_(True),
            User.email_verified.is_(True),
            EmailPreference.subscribed.is_(True),
            User.created_at >= max(config.start_at, now - 21 * DAY),
            or_(
                User.created_at > _account_cursor[0],
                and_(User.created_at == _account_cursor[0], User.id > _account_cursor[1]),
            ),
        )
        .order_by(User.created_at, User.id)
        .limit(limit)
    )
    if config.pilot_only:
        query = query.where(User.id.in_(config.pilot_user_ids))
    return list((await session.scalars(query)).all())


async def payment_candidates(session: AsyncSession, config: EmailQueueConfig, now: int, limit: int) -> list[Payment]:
    conditions = []
    if config.release_b and config.credited_start_at > 0:
        conditions.append(and_(credited_condition(), Payment.created_at >= config.credited_start_at))
    if config.release_b and config.start_at > 0:
        conditions.append(
            and_(
                canceled_condition(),
                Payment.created_at >= max(config.start_at, now - 7 * DAY),
            )
        )
    if not conditions:
        return []
    query = (
        select(Payment)
        .join(User, User.id == Payment.user_id)
        .where(
            or_(*conditions),
            or_(
                Payment.created_at > _payment_cursor[0],
                and_(Payment.created_at == _payment_cursor[0], Payment.id > _payment_cursor[1]),
            ),
        )
        .order_by(Payment.created_at, Payment.id)
        .limit(limit)
    )
    if config.pilot_only:
        query = query.where(Payment.user_id.in_(config.pilot_user_ids))
    return list((await session.scalars(query)).all())


async def plan_payment_email(
    session: AsyncSession, payment: Payment, now: int
) -> tuple[EmailType, int, int | None] | None:
    if payment.status == 'succeeded':
        return 'topup_credited', now, None
    user = await session.get(User, payment.user_id)
    if not user or user.role != 'user' or not (await preference_for_user(session, user, now)).can_receive:
        return None
    latest = await latest_help_payment(session, user.id, now)
    if not latest or latest.id != payment.id:
        return None
    return 'payment_help_72h', payment.created_at + 3 * DAY, payment.created_at + 7 * DAY


async def reconcile_email_candidates(config: EmailQueueConfig, limit: int = 100) -> int:
    """Recover missing jobs after source commits; no registration/payment transaction waits for SMTP."""
    global _account_cursor, _payment_cursor
    if not config.enabled:
        return 0
    now, count, limit = int(time.time()), 0, min(max(limit, 1), 100)
    async with get_async_db_context() as session:
        accounts = await account_candidates(session, config, now, limit)
        for user in accounts:
            if not (await preference_for_user(session, user, now)).can_receive:
                continue
            activated = bool(
                await session.scalar(select(TaskSuccess.operation_id).where(TaskSuccess.user_id == user.id).limit(1))
            )
            for email_type, due_at, expires_at in account_scenarios(user, config, now):
                if email_type == 'activation_24h' and activated:
                    continue
                count += 1
                if not config.dry_run:
                    await enqueue_email(session, user.id, email_type, ONBOARDING_VERSION, due_at, expires_at)
        payments = await payment_candidates(session, config, now, limit)
        for payment in payments:
            plan = await plan_payment_email(session, payment, now)
            if plan is not None:
                count += 1
                if not config.dry_run:
                    email_type, due_at, expires_at = plan
                    await enqueue_email(
                        session, payment.user_id, email_type, payment.id, due_at, expires_at, payment_id=payment.id
                    )
        await session.commit()
    _account_cursor = (accounts[-1].created_at, accounts[-1].id) if len(accounts) == limit else (0, '')
    _payment_cursor = (payments[-1].created_at, payments[-1].id) if len(payments) == limit else (0, '')
    return count
