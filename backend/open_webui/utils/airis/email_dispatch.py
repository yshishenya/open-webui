"""Atomic new queue receipts and current facts for an explicitly selected population."""

import asyncio
from dataclasses import replace

from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import DeliveryView, EmailType, enqueue_email
from open_webui.models.email_observation import RULE_VERSION, ObservationDecision, _write_decision
from open_webui.models.email_observation_schema import (
    EmailObservationMember,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.models.users import User
from open_webui.utils.airis.email_eligibility import send_eligibility
from open_webui.utils.airis.email_observer import ACCOUNT_WINDOWS, _view
from open_webui.utils.airis.email_scenarios import DAY, EmailQueueConfig, ScenarioDecision
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession


async def _lock_dispatch_scope(
    session: AsyncSession, config: EmailQueueConfig, now: int
) -> EmailObservationScope | None:
    """Acquire before source/queue locks; an invalid selection never bypasses the journal."""
    if not config.observation_scope_id:
        return None
    # ponytail: one writer per group; partition populations if measured lock contention requires it.
    scope = await session.scalar(
        update(EmailObservationScope)
        .where(
            EmailObservationScope.id == config.observation_scope_id,
            EmailObservationScope.mode == 'dispatch',
            EmailObservationScope.rule_version == RULE_VERSION,
            EmailObservationScope.closed_at.is_(None),
            EmailObservationScope.declared_at <= now,
        )
        .values(member_count=EmailObservationScope.member_count)
        .returning(EmailObservationScope)
        .execution_options(populate_existing=True)
    )
    if not scope:
        raise ValueError('Dispatch observation scope unavailable')
    return scope


async def lock_dispatch_scope(
    session: AsyncSession, config: EmailQueueConfig, now: int
) -> EmailObservationScope | None:
    """Drain a SQLite RETURNING operation before cancellation closes its session."""
    if not config.observation_scope_id:
        return None
    if session.get_bind().dialect.name != 'sqlite':
        return await _lock_dispatch_scope(session, config, now)
    task = asyncio.create_task(_lock_dispatch_scope(session, config, now))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        try:
            await task
        finally:
            await session.rollback()
        raise


async def _dispatch_member(
    session: AsyncSession, scope: EmailObservationScope, user: User
) -> EmailObservationMember | None:
    if user.role != 'user' or not scope.registrations_from <= user.created_at < scope.registrations_until:
        return None
    return await session.scalar(
        select(EmailObservationMember).where(
            EmailObservationMember.scope_id == scope.id, EmailObservationMember.user_id == user.id
        )
    )


async def _candidate(
    session: AsyncSession,
    scope: EmailObservationScope,
    user: User,
    kind: EmailType,
    scenario_key: str,
    payment_id: str | None,
) -> ObservationDecision:
    if kind in {'topup_credited', 'payment_help_72h'}:
        payment = await session.get(Payment, payment_id) if payment_id else None
        if (
            not payment
            or payment.user_id != user.id
            or not scope.payments_from <= payment.created_at < scope.payments_until
        ):
            raise ValueError('Dispatch payment source unavailable')
        due_at = payment.created_at + (3 * DAY if kind == 'payment_help_72h' else 0)
        expires_at = payment.created_at + 7 * DAY if kind == 'payment_help_72h' else None
    else:
        _, due, expiry = next(window for window in ACCOUNT_WINDOWS if window[0] == kind)
        due_at, expires_at = user.created_at + due * DAY, user.created_at + expiry * DAY
    return ObservationDecision(kind, scenario_key, due_at, expires_at, 'ready', payment_id=payment_id)


async def enqueue_observed_email(
    session: AsyncSession,
    scope: EmailObservationScope | None,
    user: User,
    email_type: EmailType,
    scenario_key: str,
    due_at: int,
    expires_at: int | None,
    *,
    now: int,
    payment_id: str | None = None,
) -> str | None:
    """Only INSERT's returned new ID can acquire a receipt, in the same transaction."""
    if scope is None:
        return await enqueue_email(
            session, user.id, email_type, scenario_key, due_at, expires_at, payment_id=payment_id
        )
    member = await _dispatch_member(session, scope, user)
    if member is None:
        return None
    async with session.begin_nested():
        candidate = await _candidate(session, scope, user, email_type, scenario_key, payment_id)
        job_id = await enqueue_email(
            session, user.id, email_type, scenario_key, due_at, expires_at, payment_id=payment_id
        )
        if job_id is None:
            return None
        result = await send_eligibility(session, user, _view(member, candidate, job_id, now), None, now)
        await _write_decision(
            session,
            scope,
            member,
            None,
            replace(candidate, reason=result.reason, defer_until=result.defer_until, delivery_id=job_id),
            now,
            newly_enqueued=True,
        )
    return job_id


async def record_dispatch_permission(
    session: AsyncSession,
    scope: EmailObservationScope | None,
    user: User | None,
    job: DeliveryView,
    expected_email: str | None,
    now: int,
) -> ScenarioDecision | None:
    """Write a single business fact, without claiming complete population coverage."""
    if scope is None:
        return None
    if user is None:
        return ScenarioDecision('deleted_account')
    member = await _dispatch_member(session, scope, user)
    if member is None:
        return ScenarioDecision('observation_unlinked')
    row = await session.scalar(
        select(EmailScenarioObservation).where(
            EmailScenarioObservation.member_id == member.id,
            EmailScenarioObservation.rule_version == scope.rule_version,
            EmailScenarioObservation.type == job.type,
            EmailScenarioObservation.scenario_key == job.scenario_key,
            EmailScenarioObservation.delivery_id == job.id,
            EmailScenarioObservation.linked_at.is_not(None),
        )
    )
    if not row or row.category != job.category or row.payment_id != job.payment_id or row.expires_at != job.expires_at:
        return ScenarioDecision('observation_unlinked')
    candidate = await _candidate(session, scope, user, job.type, job.scenario_key, job.payment_id)
    result = await send_eligibility(session, user, _view(member, candidate, job.id, now), expected_email, now)
    await _write_decision(
        session,
        scope,
        member,
        None,
        replace(candidate, reason=result.reason, defer_until=result.defer_until, delivery_id=job.id),
        now,
    )
    return result
