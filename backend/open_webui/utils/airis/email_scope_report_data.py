"""Bounded source reads and explicit gaps for an observation scope."""

from collections import Counter, defaultdict
from typing import Literal

from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import EmailDelivery
from open_webui.models.email_observation import RULE_VERSION
from open_webui.models.email_observation_schema import (
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.models.users import User
from open_webui.utils.airis.email_observer import (
    ACCOUNT_WINDOWS,
    MAX_MEMBER_HISTORY,
    MAX_MEMBER_PAYMENTS,
    PAYMENT_TYPES,
)
from open_webui.utils.airis.email_scenarios import DAY, ONBOARDING_VERSION
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

MAX_REPORT_MEMBERS = 500


class ScopeCoverage(BaseModel):
    state: Literal['complete_traversal', 'partial', 'unavailable']
    reasons: list[str]
    declared_members: int
    stored_members: int
    visited_members: int
    last_run_started_at: int | None
    last_run_finished_at: int | None
    last_run_status: str | None
    missing_source_members: int
    unobserved_account_scenarios: int
    unobserved_payment_scenarios: int
    lost_payment_scenarios: int
    lost_delivery_links: int
    source_cutoff_at: int
    continuous_history: Literal['unavailable'] = 'unavailable'


async def _members(session: AsyncSession, scope: EmailObservationScope) -> list[EmailObservationMember]:
    members = list(
        (
            await session.scalars(
                select(EmailObservationMember)
                .where(EmailObservationMember.scope_id == scope.id)
                .order_by(EmailObservationMember.ordinal)
                .limit(MAX_REPORT_MEMBERS + 1)
            )
        ).all()
    )
    if len(members) > MAX_REPORT_MEMBERS or scope.member_count > MAX_REPORT_MEMBERS:
        raise ValueError('Report member capacity exceeded')
    return members


async def _observations(session: AsyncSession, scope: EmailObservationScope) -> list[EmailScenarioObservation]:
    rows = list(
        (
            await session.scalars(
                select(EmailScenarioObservation)
                .join(EmailObservationMember)
                .where(
                    EmailObservationMember.scope_id == scope.id,
                    EmailScenarioObservation.rule_version == scope.rule_version,
                )
                .order_by(EmailScenarioObservation.id)
                .limit(MAX_REPORT_MEMBERS * MAX_MEMBER_HISTORY + 1)
            )
        ).all()
    )
    if len(rows) > MAX_REPORT_MEMBERS * MAX_MEMBER_HISTORY:
        raise ValueError('Report history capacity exceeded')
    if any(count > MAX_MEMBER_HISTORY for count in Counter(row.member_id for row in rows).values()):
        raise ValueError('Report member history capacity exceeded')
    return rows


async def _payments(
    session: AsyncSession, scope: EmailObservationScope, ids: list[str], cutoff: int
) -> dict[str, list[tuple[str, int]]]:
    rows = (
        await session.execute(
            select(Payment.id, Payment.user_id, Payment.created_at)
            .where(
                Payment.user_id.in_(ids),
                Payment.kind == 'topup',
                Payment.created_at >= scope.payments_from,
                Payment.created_at < scope.payments_until,
                Payment.created_at <= cutoff,
            )
            .limit(MAX_REPORT_MEMBERS * MAX_MEMBER_PAYMENTS + 1)
        )
    ).all()
    if len(rows) > MAX_REPORT_MEMBERS * MAX_MEMBER_PAYMENTS:
        raise ValueError('Report payment capacity exceeded')
    by_user: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for payment_id, user_id, created in rows:
        by_user[user_id].append((payment_id, created))
    if any(len(group) > MAX_MEMBER_PAYMENTS for group in by_user.values()):
        raise ValueError('Report member payment capacity exceeded')
    return by_user


async def _legacy_jobs(
    session: AsyncSession,
    members: list[EmailObservationMember],
    now: int,
) -> list[EmailDelivery]:
    ids = [member.user_id for member in members if member.user_id is not None]
    legacy = list(
        (
            await session.scalars(
                select(EmailDelivery)
                .where(EmailDelivery.created_at <= now)
                .where(EmailDelivery.user_id.in_(ids))
                .options(
                    load_only(
                        EmailDelivery.id,
                        EmailDelivery.user_id,
                        EmailDelivery.type,
                        EmailDelivery.scenario_key,
                        EmailDelivery.payment_id,
                        EmailDelivery.created_at,
                    )
                )
                .limit(MAX_REPORT_MEMBERS * MAX_MEMBER_HISTORY + 1)
            )
        ).all()
    )
    if len(legacy) > MAX_REPORT_MEMBERS * MAX_MEMBER_HISTORY:
        raise ValueError('Report queue capacity exceeded')
    return legacy


async def _jobs(
    session: AsyncSession,
    scope: EmailObservationScope,
    members: list[EmailObservationMember],
    observations: list[EmailScenarioObservation],
    payments: dict[str, list[tuple[str, int]]],
    now: int,
) -> list[EmailDelivery]:
    query = select(EmailDelivery).where(EmailDelivery.created_at <= now)
    # ponytail: bounded group snapshot; SQL aggregates if 128k-scenario memory becomes material.
    linked = list(
        (
            await session.scalars(
                query.join(
                    EmailScenarioObservation,
                    EmailScenarioObservation.delivery_id == EmailDelivery.id,
                )
                .join(EmailObservationMember, EmailObservationMember.id == EmailScenarioObservation.member_id)
                .where(
                    EmailObservationMember.scope_id == scope.id,
                    EmailScenarioObservation.rule_version == scope.rule_version,
                )
            )
        ).all()
    )
    legacy = await _legacy_jobs(session, members, now)
    payment_keys = {(user_id, payment_id) for user_id, group in payments.items() for payment_id, created in group}
    member_users = {member.id: member.user_id for member in members}
    payment_keys.update(
        (member_users[row.member_id], row.scenario_key)
        for row in observations
        if row.type in PAYMENT_TYPES and row.scenario_key != 'no_scenario_v1'
    )
    jobs = {
        job.id: job
        for job in legacy
        if (
            (job.user_id, job.scenario_key) in payment_keys
            if job.type in PAYMENT_TYPES
            else job.scenario_key == ONBOARDING_VERSION
        )
    }
    jobs.update({job.id: job for job in linked})
    return list(jobs.values())


def _account_gaps(
    scope: EmailObservationScope,
    members: list[EmailObservationMember],
    users: dict[str, int],
    keys: dict[tuple[str, str, str], EmailScenarioObservation],
) -> tuple[int, bool]:
    missing = 0
    changed = False
    for member in members:
        if member.user_id not in users:
            continue
        registered = users[member.user_id]
        changed |= not scope.registrations_from <= registered < scope.registrations_until
        for kind, due, expiry in ACCOUNT_WINDOWS:
            row = keys.get((member.id, kind, ONBOARDING_VERSION))
            if row is None:
                missing += 1
            elif row.due_at != registered + due * DAY or row.expires_at != registered + expiry * DAY:
                changed = True
    return missing, changed


def _payment_window_matches(row: EmailScenarioObservation, payment_id: str, created: int) -> bool:
    help_message = row.type == 'payment_help_72h'
    return (
        row.payment_id == payment_id
        and row.due_at == created + (3 * DAY if help_message else 0)
        and row.expires_at == (created + 7 * DAY if help_message else None)
    )


def _payment_gaps(
    members: list[EmailObservationMember],
    payments: dict[str, list[tuple[str, int]]],
    keys: dict[tuple[str, str, str], EmailScenarioObservation],
) -> tuple[int, bool]:
    missing = 0
    changed = False
    for member in members:
        for payment_id, created in payments.get(member.user_id, []):
            for kind in PAYMENT_TYPES:
                row = keys.get((member.id, kind, payment_id))
                if row is None:
                    missing += 1
                elif not _payment_window_matches(row, payment_id, created):
                    changed = True
    return missing, changed


async def _runs(session: AsyncSession, scope_id: str) -> list[EmailObservationRun]:
    return list(
        (
            await session.scalars(
                select(EmailObservationRun)
                .where(
                    EmailObservationRun.scope_id == scope_id,
                )
                .order_by(EmailObservationRun.started_at.desc())
                .limit(2)
            )
        ).all()
    )


def _run_reasons(scope: EmailObservationScope, runs: list[EmailObservationRun]) -> list[str]:
    last = runs[0] if runs else None
    checks = {
        'unsupported_rule': scope.rule_version != RULE_VERSION,
        'no_complete_latest_run': last is None or last.status != 'completed' or last.cursor != scope.member_count,
        'unobserved_start': last is not None and scope.observed_from is None,
        'ambiguous_latest_run': len(runs) == 2 and runs[0].started_at == runs[1].started_at,
    }
    return [reason for reason, applies in checks.items() if applies]


def _future_facts(
    scope: EmailObservationScope,
    runs: list[EmailObservationRun],
    observations: list[EmailScenarioObservation],
    now: int,
    cutoff: int,
) -> bool:
    return (
        scope.declared_at > now
        or (scope.closed_at is not None and scope.closed_at > now)
        or (scope.observed_from is not None and scope.observed_from > cutoff)
        or any(run.started_at > cutoff for run in runs)
        or any(run.finished_at is not None and run.finished_at > cutoff for run in runs)
        or any(row.first_observed_at > cutoff or row.last_observed_at > cutoff for row in observations)
    )


def _lost_payments(
    observations: list[EmailScenarioObservation],
    payments: dict[str, list[tuple[str, int]]],
) -> int:
    live_payments = {payment_id for group in payments.values() for payment_id, created in group}
    return sum(
        row.type in PAYMENT_TYPES and row.scenario_key != 'no_scenario_v1' and row.payment_id not in live_payments
        for row in observations
    )


def _coverage(
    scope: EmailObservationScope,
    members: list[EmailObservationMember],
    users: dict[str, int],
    observations: list[EmailScenarioObservation],
    payments: dict[str, list[tuple[str, int]]],
    jobs: list[EmailDelivery],
    runs: list[EmailObservationRun],
    now: int,
    cutoff: int,
) -> ScopeCoverage:
    keys = {(row.member_id, row.type, row.scenario_key): row for row in observations}
    accounts_missing, accounts_changed = _account_gaps(scope, members, users, keys)
    payments_missing, payments_changed = _payment_gaps(members, payments, keys)
    lost_payments = _lost_payments(observations, payments)
    job_ids = {job.id for job in jobs}
    lost_jobs = sum(row.linked_at is not None and row.delivery_id not in job_ids for row in observations)
    missing = sum(member.user_id not in users for member in members)
    reasons = _run_reasons(scope, runs)
    checks = {
        'membership_mismatch': len(members) != scope.member_count,
        'missing_members': missing > 0,
        'unobserved_sources': accounts_missing + payments_missing > 0,
        'changed_source_windows': accounts_changed or payments_changed,
        'lost_scenario_sources': lost_payments > 0
        or any(row.reason in {'source_unavailable', 'deleted_account'} for row in observations),
        'lost_delivery_links': lost_jobs > 0,
        'future_observation': _future_facts(scope, runs, observations, now, cutoff),
    }
    reasons.extend(reason for reason, applies in checks.items() if applies)
    last = runs[0] if runs else None
    ambiguous = 'ambiguous_latest_run' in reasons
    return ScopeCoverage(
        state='unavailable' if 'unsupported_rule' in reasons else 'partial' if reasons else 'complete_traversal',
        reasons=reasons,
        declared_members=scope.member_count,
        stored_members=len(members),
        visited_members=last.scanned_members if last and not ambiguous else 0,
        last_run_started_at=last.started_at if last and not ambiguous else None,
        last_run_finished_at=last.finished_at if last and not ambiguous else None,
        last_run_status='ambiguous' if ambiguous else last.status if last else None,
        missing_source_members=missing,
        unobserved_account_scenarios=accounts_missing,
        unobserved_payment_scenarios=payments_missing,
        lost_payment_scenarios=lost_payments,
        lost_delivery_links=lost_jobs,
        source_cutoff_at=cutoff,
    )


async def scope_facts(
    session: AsyncSession, scope: EmailObservationScope, now: int
) -> tuple[list[EmailObservationMember], list[EmailScenarioObservation], list[EmailDelivery], ScopeCoverage]:
    """Read one bounded snapshot; never mutate sources or reconstruct unknown states."""
    members = await _members(session, scope)
    ids = [member.user_id for member in members if member.user_id is not None]
    users = dict((await session.execute(select(User.id, User.created_at).where(User.id.in_(ids)))).all())
    cutoff = min(now, scope.closed_at) if scope.closed_at is not None else now
    observations = await _observations(session, scope)
    payments = await _payments(session, scope, ids, cutoff)
    jobs = await _jobs(session, scope, members, observations, payments, now)
    runs = await _runs(session, scope.id)
    coverage = _coverage(scope, members, users, observations, payments, jobs, runs, now, cutoff)
    return members, observations, jobs, coverage
