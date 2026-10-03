"""Bounded complete-population observation; no scheduler, queue insertion or transport."""

import asyncio
import logging
import time
from dataclasses import dataclass, replace
from typing import Literal

from open_webui.internal.db import get_async_db_context
from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import DeliveryView, EmailDelivery, EmailType
from open_webui.models.email_observation import (
    RULE_VERSION,
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
    EmailScenarioObservation,
    ObservationClaim,
    ObservationDecision,
    ObservedMember,
    claim_observation_run,
    fail_observation_run,
    observation_page,
    save_observation_page,
)
from open_webui.models.email_observation_control import ObservationStateConflict, lock_observation_page
from open_webui.models.users import User
from open_webui.utils.airis.email_eligibility import send_eligibility
from open_webui.utils.airis.email_scenarios import DAY, ONBOARDING_VERSION
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)
MAX_PAGE_MEMBERS = 25
MAX_MEMBER_PAYMENTS = 100
MAX_MEMBER_HISTORY = 256
PAGE_TIMEOUT_SECONDS = 30
ACCOUNT_WINDOWS: tuple[tuple[EmailType, int, int], ...] = (
    ('welcome', 0, 7),
    ('activation_24h', 1, 7),
    ('paid_value_72h', 3, 7),
    ('feedback_14d', 14, 21),
)
PAYMENT_TYPES: tuple[EmailType, ...] = ('topup_credited', 'payment_help_72h')


class ObservationPageError(RuntimeError):
    """Safe caller-facing page failure; partial decisions have rolled back."""


class ObservationPageConflict(ObservationPageError):
    """Safe replay/ownership conflict; the current run and its history are untouched."""


class ObservationCoverageError(ValueError):
    """A bounded page cannot prove coverage when a declared source exceeds its cap."""


@dataclass(frozen=True)
class ObservationPageResult:
    claim: ObservationClaim | None
    completed: bool = False
    scanned_members: int = 0
    scanned_scenarios: int = 0
    missing_source_members: int = 0


def _original(row: EmailScenarioObservation, reason: str) -> ObservationDecision:
    return ObservationDecision(
        row.type, row.scenario_key, row.due_at, row.expires_at, reason, payment_id=row.payment_id
    )


async def _history(session: AsyncSession, member_id: str) -> list[EmailScenarioObservation]:
    rows = list(
        (
            await session.scalars(
                select(EmailScenarioObservation)
                .where(EmailScenarioObservation.member_id == member_id)
                .order_by(EmailScenarioObservation.id)
                .limit(MAX_MEMBER_HISTORY + 1)
            )
        ).all()
    )
    if len(rows) > MAX_MEMBER_HISTORY:
        raise ObservationCoverageError('Historical scenario capacity exceeded')
    return rows


async def _payments(session: AsyncSession, scope: EmailObservationScope, user_id: str, now: int) -> list[Payment]:
    rows = list(
        (
            await session.scalars(
                select(Payment)
                .where(
                    Payment.user_id == user_id,
                    Payment.kind == 'topup',
                    Payment.created_at >= scope.payments_from,
                    Payment.created_at < scope.payments_until,
                    Payment.created_at <= now,
                )
                .order_by(Payment.created_at, Payment.id)
                .limit(MAX_MEMBER_PAYMENTS + 1)
            )
        ).all()
    )
    if len(rows) > MAX_MEMBER_PAYMENTS:
        raise ObservationCoverageError('Payment source capacity exceeded')
    return rows


def _payment_candidates(
    payments: list[Payment], history: list[EmailScenarioObservation], declared_at: int
) -> list[ObservationDecision]:
    candidates: list[ObservationDecision] = []
    for payment in payments:
        candidates.extend(
            [
                ObservationDecision(
                    'topup_credited', payment.id, payment.created_at, None, 'ready', payment_id=payment.id
                ),
                ObservationDecision(
                    'payment_help_72h',
                    payment.id,
                    payment.created_at + 3 * DAY,
                    payment.created_at + 7 * DAY,
                    'ready',
                    payment_id=payment.id,
                ),
            ]
        )
    live_ids = {p.id for p in payments}
    for row in history:
        if row.type in PAYMENT_TYPES and row.scenario_key != 'no_scenario_v1' and row.payment_id not in live_ids:
            candidates.append(_original(row, 'source_unavailable'))
    if not payments:
        placeholders = {row.type: row for row in history if row.scenario_key == 'no_scenario_v1'}
        candidates.extend(
            (
                _original(placeholders[kind], 'no_scenario')
                if kind in placeholders
                else ObservationDecision(kind, 'no_scenario_v1', declared_at, None, 'no_scenario')
            )
            for kind in PAYMENT_TYPES
        )
    return candidates


def _view(member: EmailObservationMember, candidate: ObservationDecision, job_id: str, now: int) -> DeliveryView:
    return DeliveryView(
        id=job_id,
        user_id=member.user_id,
        category='service' if candidate.type == 'topup_credited' else 'product',
        type=candidate.type,
        template_version='v1',
        scenario_key=candidate.scenario_key,
        payment_id=candidate.payment_id,
        due_at=candidate.due_at,
        expires_at=candidate.expires_at,
        status='pending',
        reason=None,
        attempts=0,
        retryable=False,
        claim_id=None,
        lease_until=None,
        submitted_at=None,
        accepted_at=None,
        provider_id='',
        delivered_at=None,
        bounced_at=None,
        complained_at=None,
        created_at=now,
        updated_at=now,
    )


async def _evaluate(
    session: AsyncSession,
    member: EmailObservationMember,
    user: User,
    candidate: ObservationDecision,
    now: int,
) -> ObservationDecision:
    if candidate.reason in {'no_scenario', 'source_unavailable'}:
        return candidate
    job = await session.scalar(
        select(EmailDelivery).where(
            EmailDelivery.user_id == user.id,
            EmailDelivery.type == candidate.type,
            EmailDelivery.scenario_key == candidate.scenario_key,
        )
    )
    # Existing queue facts inform permission/frequency but are never linked or changed here.
    job_id = job.id if job else f'observation-{member.id}-{candidate.type}-{candidate.scenario_key}'
    result = await send_eligibility(session, user, _view(member, candidate, job_id, now), None, now)
    if result.reason == 'ready' and job and (job.submitted_at is not None or job.status in {'accepted', 'unknown'}):
        return replace(candidate, reason='historical_submission')
    return replace(candidate, reason=result.reason, defer_until=result.defer_until)


async def _member(
    session: AsyncSession,
    scope: EmailObservationScope,
    member: EmailObservationMember,
    now: int,
) -> tuple[ObservedMember, bool]:
    history = await _history(session, member.id)
    user = await session.get(User, member.user_id) if member.user_id else None
    if not user:
        # The original registration window cannot be reconstructed after deletion.
        return ObservedMember(member.id, tuple(_original(row, 'deleted_account') for row in history)), True
    candidates = [
        ObservationDecision(
            kind, ONBOARDING_VERSION, user.created_at + due * DAY, user.created_at + expiry * DAY, 'ready'
        )
        for kind, due, expiry in ACCOUNT_WINDOWS
    ]
    candidates.extend(_payment_candidates(await _payments(session, scope, user.id, now), history, scope.declared_at))
    identities = {(row.type, row.scenario_key) for row in history}
    identities.update((candidate.type, candidate.scenario_key) for candidate in candidates)
    if len(identities) > MAX_MEMBER_HISTORY:
        raise ObservationCoverageError('Current scenario capacity exceeded')
    decisions = tuple([await _evaluate(session, member, user, candidate, now) for candidate in candidates])
    return ObservedMember(member.id, decisions), False


async def _save_page(
    claim: ObservationClaim,
    now: int,
    limit: int,
    expected_cursor: int | None,
    mode: Literal['observe', 'dispatch'] = 'observe',
) -> ObservationPageResult:
    async with get_async_db_context() as session:
        scope = await lock_observation_page(session, claim, now, expected_cursor, mode=mode)
        members = await observation_page(session, claim, limit)
        page: list[ObservedMember] = []
        for member in members:
            observed, _ = await _member(session, scope, member, now)
            page.append(observed)
        completed = await save_observation_page(session, claim, tuple(page), now)
        run = await session.get(EmailObservationRun, claim.run_id)
        assert run is not None
        missing = await session.scalar(
            select(func.count())
            .select_from(EmailObservationMember)
            .where(
                EmailObservationMember.scope_id == claim.scope_id,
                EmailObservationMember.ordinal <= run.cursor,
                EmailObservationMember.user_id.is_(None),
            )
        )
        result = ObservationPageResult(claim, completed, run.scanned_members, run.scanned_scenarios, missing or 0)
        await session.commit()
    return result


async def observe_scope_page(
    scope_id: str,
    *,
    claim: ObservationClaim | None = None,
    now: int | None = None,
    limit: int = MAX_PAGE_MEMBERS,
    expected_cursor: int | None = None,
    mode: Literal['observe', 'dispatch'] = 'observe',
) -> ObservationPageResult:
    """Observe one bounded page; current-time injection is for controlled tests, never HTTP input.

    Returned completion means all frozen members visited. Deleted/missing sources and
    unknown gaps cannot be interpreted as complete eligibility coverage by a report.
    """
    now = int(time.time()) if now is None else now
    if (
        now <= 0
        or mode not in {'observe', 'dispatch'}
        or not 1 <= limit <= MAX_PAGE_MEMBERS
        or (claim is not None and claim.scope_id != scope_id)
        or (expected_cursor is not None and (expected_cursor < 0 or claim is None))
    ):
        raise ValueError('Invalid observation page request')
    if claim is None:
        async with get_async_db_context() as session:
            scope = await session.get(EmailObservationScope, scope_id)
            if not scope or scope.mode != mode or scope.rule_version != RULE_VERSION:
                raise ValueError('Scope is not an observation-only population')
            claim = await claim_observation_run(session, scope_id, now)
            await session.commit()
        if claim is None:
            return ObservationPageResult(None)
    try:
        async with asyncio.timeout(PAGE_TIMEOUT_SECONDS):
            return await _save_page(claim, now, limit, expected_cursor, mode)
    except ObservationStateConflict as exc:
        raise ObservationPageConflict(str(exc)) from None
    except Exception as exc:
        reason = 'coverage_lost' if isinstance(exc, ObservationCoverageError) else 'observer_error'
        async with get_async_db_context() as session:
            await fail_observation_run(session, claim, now, reason, expected_cursor=expected_cursor)
            await session.commit()
        log.warning('Mail observation page failed', extra={'reason': reason, 'error_type': type(exc).__name__})
        raise ObservationPageError(reason) from None
