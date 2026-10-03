"""Content-free observation history; callers own transactions, never transport."""

import re
import uuid
from dataclasses import dataclass
from typing import Literal, get_args

from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import EmailDelivery, EmailType, dialect_insert
from open_webui.models.email_observation_schema import (
    EmailDecisionEvent,
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.models.users import User
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

RULE_VERSION = 'send_eligibility_v1'
LEASE_SECONDS = 180
MAX_MEMBERS = 10000
REASONS = frozenset(
    {
        'ready',
        'deleted_account',
        'inactive_account',
        'invalid_address',
        'consent',
        'no_consent',
        'unverified_address',
        'suppressed_address',
        'expired',
        'activation',
        'welcome_pending',
        'welcome_window',
        'no_activation',
        'credited',
        'payment_priority',
        'scenario_window',
        'frequency',
        'credit_unconfirmed',
        'invalid_scenario',
        'no_scenario',
        'source_unavailable',
        'historical_submission',
    }
)


@dataclass(frozen=True)
class ObservationClaim:
    run_id: str
    scope_id: str
    claim_id: str


@dataclass(frozen=True)
class ObservationDecision:
    type: EmailType
    scenario_key: str
    due_at: int
    expires_at: int | None
    reason: str
    defer_until: int | None = None
    payment_id: str | None = None
    delivery_id: str | None = None


@dataclass(frozen=True)
class ObservedMember:
    member_id: str
    decisions: tuple[ObservationDecision, ...] = ()


async def declare_scope(
    session: AsyncSession,
    user_ids: tuple[str, ...],
    now: int,
    *,
    registrations_from: int,
    registrations_until: int,
    payments_from: int,
    payments_until: int,
    mode: Literal['observe', 'dispatch'] = 'observe',
    rule_version: str = RULE_VERSION,
) -> str:
    """Freeze all declared ordinary members, including those without consent/address."""
    if (
        now <= 0
        or mode not in {'observe', 'dispatch'}
        or rule_version != RULE_VERSION
        or not 0 <= registrations_from < registrations_until <= now + 1
        or not 0 <= payments_from < payments_until
        or len(user_ids) > MAX_MEMBERS
        or len(set(user_ids)) != len(user_ids)
    ):
        raise ValueError('Invalid observation scope')
    async with session.begin_nested():
        found = list((await session.scalars(select(User).where(User.id.in_(user_ids)))).all()) if user_ids else []
        if len(found) != len(user_ids) or any(
            u.role != 'user' or not registrations_from <= u.created_at < registrations_until for u in found
        ):
            raise ValueError('Declared members do not match source boundaries')
        scope_id = str(uuid.uuid4())
        session.add(
            EmailObservationScope(
                id=scope_id,
                rule_version=rule_version,
                mode=mode,
                declared_at=now,
                observed_from=None,
                closed_at=None,
                registrations_from=registrations_from,
                registrations_until=registrations_until,
                payments_from=payments_from,
                payments_until=payments_until,
                member_count=len(found),
            )
        )
        await session.flush()
        session.add_all(
            [
                EmailObservationMember(
                    id=str(uuid.uuid4()), scope_id=scope_id, ordinal=n, user_id=user_id, included_at=now
                )
                for n, user_id in enumerate(sorted(user_ids), 1)
            ]
        )
        await session.flush()
    return scope_id


async def claim_observation_run(session: AsyncSession, scope_id: str, now: int) -> ObservationClaim | None:
    """Start or resume one leased run; the first actual start is never backfilled."""
    async with session.begin_nested():
        scope = await session.scalar(
            update(EmailObservationScope)
            .where(
                EmailObservationScope.id == scope_id,
                EmailObservationScope.closed_at.is_(None),
                EmailObservationScope.declared_at <= now,
            )
            .values(member_count=EmailObservationScope.member_count)
            .returning(EmailObservationScope)
            .execution_options(populate_existing=True)
        )
        if not scope:
            return None
        run_id, claim_id = str(uuid.uuid4()), str(uuid.uuid4())
        inserted = await session.scalar(
            dialect_insert(session, EmailObservationRun)
            .values(
                id=run_id,
                scope_id=scope_id,
                started_at=now,
                finished_at=None,
                upper_ordinal=scope.member_count,
                cursor=0,
                scanned_members=0,
                scanned_scenarios=0,
                status='running',
                claim_id=claim_id,
                lease_until=now + LEASE_SECONDS,
            )
            .on_conflict_do_nothing(index_elements=['scope_id'], index_where=EmailObservationRun.status == 'running')
            .returning(EmailObservationRun.id)
        )
        if not inserted:
            run_id = await session.scalar(
                update(EmailObservationRun)
                .where(
                    EmailObservationRun.scope_id == scope_id,
                    EmailObservationRun.status == 'running',
                    EmailObservationRun.lease_until <= now,
                    EmailObservationRun.started_at <= now,
                )
                .values(claim_id=claim_id, lease_until=now + LEASE_SECONDS)
                .returning(EmailObservationRun.id)
            )
            if not run_id:
                return None
        await session.execute(
            update(EmailObservationScope)
            .where(
                EmailObservationScope.id == scope_id,
                EmailObservationScope.observed_from.is_(None),
            )
            .values(observed_from=now)
        )
    return ObservationClaim(run_id, scope_id, claim_id)


async def observation_page(
    session: AsyncSession, claim: ObservationClaim, limit: int = 100
) -> list[EmailObservationMember]:
    """Read the next declared page; a page is not a coverage claim until saved."""
    if not 1 <= limit <= 100:
        raise ValueError('Invalid page size')
    run = await session.get(EmailObservationRun, claim.run_id, populate_existing=True)
    if not run or run.scope_id != claim.scope_id or run.claim_id != claim.claim_id or run.status != 'running':
        raise ValueError('Observation run is not owned')
    return list(
        (
            await session.scalars(
                select(EmailObservationMember)
                .where(
                    EmailObservationMember.scope_id == claim.scope_id,
                    EmailObservationMember.ordinal > run.cursor,
                    EmailObservationMember.ordinal <= run.upper_ordinal,
                )
                .order_by(EmailObservationMember.ordinal)
                .limit(limit)
            )
        ).all()
    )


def _validate_decision_input(decision: ObservationDecision, now: int) -> None:
    if (
        decision.type not in get_args(EmailType)
        or decision.reason not in REASONS
        or re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', decision.scenario_key) is None
        or decision.due_at < 0
        or (decision.expires_at is not None and decision.expires_at < decision.due_at)
        or (decision.defer_until is not None and decision.defer_until <= now)
        or (
            decision.reason == 'ready'
            and (
                decision.defer_until is not None
                or now < decision.due_at
                or (decision.expires_at is not None and now >= decision.expires_at)
            )
        )
    ):
        raise ValueError('Invalid observation decision')


async def _validate_payment_source(
    session: AsyncSession,
    scope: EmailObservationScope,
    member: EmailObservationMember,
    decision: ObservationDecision,
    existing: EmailScenarioObservation | None,
) -> None:
    payment_scenario = decision.type in {'topup_credited', 'payment_help_72h'}
    if not payment_scenario:
        if decision.scenario_key != 'onboarding_v1' or decision.payment_id is not None:
            raise ValueError('Account scenario identity does not match its source')
    elif decision.payment_id is not None:
        if decision.scenario_key != decision.payment_id:
            raise ValueError('Payment scenario key does not match its source')
    elif not (
        (decision.scenario_key == 'no_scenario_v1' and decision.reason in {'no_scenario', 'deleted_account'})
        or (
            existing is not None
            and existing.payment_id is None
            and decision.reason in {'source_unavailable', 'deleted_account'}
        )
    ):
        raise ValueError('Payment scenario without source is not a known orphan')
    orphaned_source = (
        member.user_id is None
        and decision.reason == 'deleted_account'
        and existing is not None
        and existing.payment_id == decision.payment_id
    )
    if decision.payment_id is not None:
        payment = await session.get(Payment, decision.payment_id)
        if (
            not payment
            or (payment.user_id != member.user_id and not orphaned_source)
            or not scope.payments_from <= payment.created_at < scope.payments_until
        ):
            raise ValueError('Payment does not match declared member/window')
    if (
        decision.type in {'topup_credited', 'payment_help_72h'}
        and decision.reason not in {'no_scenario', 'deleted_account', 'source_unavailable'}
        and decision.payment_id is None
    ):
        raise ValueError('Payment scenario requires its source')
    if member.user_id is None and decision.reason != 'deleted_account':
        raise ValueError('Deleted member requires a negative observation')


async def _link_delivery(
    session: AsyncSession,
    scope: EmailObservationScope,
    member: EmailObservationMember,
    decision: ObservationDecision,
    row: EmailScenarioObservation,
    now: int,
) -> None:
    if decision.delivery_id is not None and row.delivery_id != decision.delivery_id:
        job = await session.get(EmailDelivery, decision.delivery_id)
        if (
            decision.reason != 'ready'
            or row.linked_at is not None
            or row.delivery_id is not None
            or scope.mode != 'dispatch'
            or row.first_eligible_at is None
            or not job
            or job.user_id != member.user_id
            or job.type != decision.type
            or job.scenario_key != decision.scenario_key
            or job.payment_id != decision.payment_id
            or job.category != row.category
            or job.expires_at != row.expires_at
            or job.due_at > now
            or job.created_at < row.first_eligible_at
            or job.status not in {'pending', 'retry'}
        ):
            raise ValueError('Delivery does not match a new eligible scenario')
        row.delivery_id, row.linked_at = job.id, now


async def _write_decision(
    session: AsyncSession,
    scope: EmailObservationScope,
    member: EmailObservationMember,
    claim: ObservationClaim,
    decision: ObservationDecision,
    now: int,
) -> None:
    _validate_decision_input(decision, now)
    existing = await session.scalar(
        select(EmailScenarioObservation)
        .where(
            EmailScenarioObservation.member_id == member.id,
            EmailScenarioObservation.type == decision.type,
            EmailScenarioObservation.scenario_key == decision.scenario_key,
            EmailScenarioObservation.rule_version == scope.rule_version,
        )
        .with_for_update()
    )
    await _validate_payment_source(session, scope, member, decision, existing)
    row_id = await session.scalar(
        dialect_insert(session, EmailScenarioObservation)
        .values(
            id=str(uuid.uuid4()),
            member_id=member.id,
            type=decision.type,
            category='service' if decision.type == 'topup_credited' else 'product',
            scenario_key=decision.scenario_key,
            rule_version=scope.rule_version,
            due_at=decision.due_at,
            expires_at=decision.expires_at,
            payment_id=decision.payment_id,
            delivery_id=None,
            linked_at=None,
            first_observed_at=now,
            first_eligible_at=now if decision.reason == 'ready' else None,
            last_observed_at=now,
            reason=decision.reason,
            defer_until=decision.defer_until,
            revision=1,
        )
        .on_conflict_do_nothing(index_elements=['member_id', 'type', 'scenario_key', 'rule_version'])
        .returning(EmailScenarioObservation.id)
    )
    row = await session.scalar(
        select(EmailScenarioObservation)
        .where(
            EmailScenarioObservation.member_id == member.id,
            EmailScenarioObservation.type == decision.type,
            EmailScenarioObservation.scenario_key == decision.scenario_key,
            EmailScenarioObservation.rule_version == scope.rule_version,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not row or row.last_observed_at > now or row.due_at != decision.due_at or row.expires_at != decision.expires_at:
        raise ValueError('Observation is stale or immutable window changed')
    if row.payment_id != decision.payment_id:
        raise ValueError('Immutable payment source changed')
    changed = bool(row_id) or row.reason != decision.reason or row.defer_until != decision.defer_until
    if not row_id and changed:
        row.revision += 1
    row.last_observed_at, row.reason, row.defer_until = now, decision.reason, decision.defer_until
    if decision.reason == 'ready' and row.first_eligible_at is None:
        row.first_eligible_at = now
    await _link_delivery(session, scope, member, decision, row, now)
    if changed:
        session.add(
            EmailDecisionEvent(
                id=str(uuid.uuid4()),
                observation_id=row.id,
                run_id=claim.run_id,
                revision=row.revision,
                observed_at=now,
                reason=decision.reason,
                defer_until=decision.defer_until,
            )
        )
    await session.flush()


async def save_observation_page(
    session: AsyncSession,
    claim: ObservationClaim,
    observations: tuple[ObservedMember, ...],
    now: int,
) -> bool:
    """Commit-ready page boundary: decisions, transitions and cursor roll back together.

    The caller commits its transaction. Completed means every declared member was visited,
    not uninterrupted or semantically complete coverage of every scenario between runs.
    """
    if len(observations) > 100 or len({o.member_id for o in observations}) != len(observations):
        raise ValueError('Invalid observation page')
    async with session.begin_nested():
        run = await session.scalar(
            update(EmailObservationRun)
            .where(
                EmailObservationRun.id == claim.run_id,
                EmailObservationRun.scope_id == claim.scope_id,
                EmailObservationRun.claim_id == claim.claim_id,
                EmailObservationRun.status == 'running',
                EmailObservationRun.lease_until > now,
                EmailObservationRun.started_at <= now,
            )
            .values(lease_until=now + LEASE_SECONDS)
            .returning(EmailObservationRun)
            .execution_options(populate_existing=True)
        )
        if not run:
            raise ValueError('Observation lease is lost')
        scope = await session.get(EmailObservationScope, claim.scope_id, populate_existing=True)
        if not scope or scope.closed_at is not None:
            raise ValueError('Observation scope is closed')
        expected = await observation_page(session, claim, max(len(observations), 1))
        if [m.id for m in expected] != [o.member_id for o in observations]:
            raise ValueError('Observation page skips or repeats members')
        for member, observed in zip(expected, observations, strict=True):
            if len({(d.type, d.scenario_key) for d in observed.decisions}) != len(observed.decisions):
                raise ValueError('Duplicate scenario in page')
            for decision in observed.decisions:
                await _write_decision(session, scope, member, claim, decision, now)
        cursor = expected[-1].ordinal if expected else run.cursor
        if cursor - run.cursor != len(expected):
            raise ValueError('Declared membership has lost coverage')
        run.cursor = run.scanned_members = cursor
        run.scanned_scenarios += sum(len(o.decisions) for o in observations)
        completed = cursor == run.upper_ordinal
        if completed:
            run.status, run.finished_at, run.claim_id, run.lease_until = 'completed', now, None, None
        await session.flush()
    return completed


async def fail_observation_run(
    session: AsyncSession,
    claim: ObservationClaim,
    now: int,
    reason: Literal['observer_error', 'coverage_lost', 'operator_stop'],
    *,
    expected_cursor: int | None = None,
) -> bool:
    """Record incomplete coverage; interruption alone can instead resume the live run."""
    if reason not in {'observer_error', 'coverage_lost', 'operator_stop'}:
        raise ValueError('Invalid observation failure reason')
    changed = await session.scalar(
        update(EmailObservationRun)
        .where(
            EmailObservationRun.id == claim.run_id,
            EmailObservationRun.scope_id == claim.scope_id,
            EmailObservationRun.claim_id == claim.claim_id,
            EmailObservationRun.status == 'running',
            EmailObservationRun.lease_until > now,
            EmailObservationRun.started_at <= now,
            *([EmailObservationRun.cursor == expected_cursor] if expected_cursor is not None else []),
        )
        .values(status='failed', failure_reason=reason, finished_at=now, claim_id=None, lease_until=None)
        .returning(EmailObservationRun.id)
    )
    return changed is not None
