"""Observed population facts; no inference of continuous eligibility or delivery coverage."""

import time
from collections import Counter, defaultdict
from typing import Literal, get_args

from open_webui.internal.db import get_async_db_context
from open_webui.models.email_delivery import EmailDelivery, EmailType
from open_webui.models.email_observation import REASONS, RULE_VERSION
from open_webui.models.email_observation_schema import (
    EmailObservationMember,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.utils.airis.email_observation_admin import DiagnosticNotFound
from open_webui.utils.airis.email_observer import (
    PAYMENT_TYPES,
)
from open_webui.utils.airis.email_scope_report_data import ScopeCoverage, scope_facts
from open_webui.utils.airis.mail_outcome_report import (
    MAIL_STATES,
    MailOutcome,
    MailTypeSummary,
    summarize_mail_outcomes,
)
from pydantic import BaseModel

SAFE_REASONS = REASONS | {
    'smtp_unknown',
    'smtp_temporary',
    'smtp_terminal',
    'claim_expired',
    'submission_interrupted',
    'transport_capacity',
    'release_disabled',
    'content_changed',
    'observation_unlinked',
    'admin_retry',
}


class ObservedRate(BaseModel):
    unit: Literal['account', 'scenario']
    numerator: int
    denominator: int | None
    fraction: float | None
    unavailable_reason: str | None


class ScopeMailType(BaseModel):
    type: str
    scenario_unit: Literal['account', 'payment_attempt']
    observed_scenarios: int
    observed_eligible_accounts: int
    observed_eligible_scenarios: int
    latest_reasons: dict[str, int]
    queue: MailTypeSummary
    unlinked_queue_jobs: int
    lost_delivery_links: int
    accepted_over_observed_accounts: ObservedRate
    accepted_over_observed_scenarios: ObservedRate


class ScopeMailReport(BaseModel):
    version: Literal['mail-scope-v1'] = 'mail-scope-v1'
    generated_at: int
    scope_id: str
    purpose: Literal['diagnostic', 'dispatch']
    rule_version: str
    declared_at: int
    observed_from: int | None
    closed_at: int | None
    registrations_from: int
    registrations_until: int
    payments_from: int
    payments_until: int
    coverage: ScopeCoverage
    types: list[ScopeMailType]
    limitations: list[str]


def _safe_reason(reason: str | None) -> str | None:
    return reason if reason is None or reason in SAFE_REASONS else 'unknown'


def _rate(unit: Literal['account', 'scenario'], numerator: int, denominator: int, reason: str | None) -> ObservedRate:
    return ObservedRate(
        unit=unit,
        numerator=numerator,
        denominator=None if reason else denominator,
        fraction=numerator / denominator if reason is None and denominator else None,
        unavailable_reason=reason or ('zero_observed_denominator' if not denominator else None),
    )


def _valid_association(
    scope: EmailObservationScope,
    member: EmailObservationMember,
    row: EmailScenarioObservation,
    job: EmailDelivery,
    now: int,
) -> bool:
    return (
        scope.mode == 'dispatch'
        and row.linked_at is not None
        and row.linked_at <= now
        and job.type == row.type
        and job.scenario_key == row.scenario_key
        and job.user_id == member.user_id
        and job.payment_id == row.payment_id
        and job.category == row.category
        and job.expires_at == row.expires_at
        and scope.declared_at <= job.created_at <= row.linked_at
    )


def _associations(
    scope: EmailObservationScope,
    members: dict[str, EmailObservationMember],
    rows: list[EmailScenarioObservation],
    jobs: dict[str, EmailDelivery],
    now: int,
) -> tuple[list[tuple[EmailScenarioObservation, EmailDelivery]], bool]:
    pairs: list[tuple[EmailScenarioObservation, EmailDelivery]] = []
    invalid = False
    for row in rows:
        job = jobs.get(row.delivery_id)
        if job is None:
            continue
        if not _valid_association(scope, members[row.member_id], row, job, now):
            invalid = True
            continue
        pairs.append((row, job))
        invalid |= job.status not in MAIL_STATES
        if job.status == 'accepted':
            invalid |= (
                job.accepted_at is None
                or job.accepted_at > now
                or job.accepted_at < row.linked_at
                or row.first_eligible_at is None
                or row.first_eligible_at > job.accepted_at
            )
    return pairs, invalid


def _queue_summary(
    kind: str,
    pairs: list[tuple[EmailScenarioObservation, EmailDelivery]],
    now: int,
) -> MailTypeSummary:
    outcomes: dict[tuple[str, str, str | None], list[EmailDelivery]] = defaultdict(list)
    for row, job in pairs:
        version = job.template_version if job.template_version in {'onboarding_v1', 'credited_v1'} else 'unknown'
        status = job.status if job.status in MAIL_STATES else 'unknown'
        outcomes[(version, status, _safe_reason(job.reason))].append(job)
    grouped = [
        MailOutcome(
            type=kind,
            template_version=version,
            status=status,
            reason=reason,
            jobs=len(group),
            delivery_receipts=sum(job.delivered_at is not None and job.delivered_at <= now for job in group),
            bounce_records=sum(job.bounced_at is not None and job.bounced_at <= now for job in group),
            complaint_records=sum(job.complained_at is not None and job.complained_at <= now for job in group),
        )
        for (version, status, reason), group in sorted(
            outcomes.items(), key=lambda item: (item[0][0], item[0][1], item[0][2] or '')
        )
    ]
    accounts = {kind: len({row.member_id for row, job in pairs})}
    return next(item for item in summarize_mail_outcomes(grouped, accounts, now) if item.type == kind)


def _type_result(
    kind: str,
    rows: list[EmailScenarioObservation],
    pairs: list[tuple[EmailScenarioObservation, EmailDelivery]],
    jobs: dict[str, EmailDelivery],
    reason: str | None,
    cutoff: int,
    now: int,
) -> ScopeMailType:
    scenarios = [row for row in rows if row.scenario_key != 'no_scenario_v1']
    positive = [row for row in scenarios if row.first_eligible_at is not None and row.first_eligible_at <= cutoff]
    positive_ids = {row.id for row in positive}
    accepted = [
        row
        for row, job in pairs
        if (
            job.status == 'accepted'
            and job.accepted_at is not None
            and job.accepted_at <= now
            and row.id in positive_ids
            and row.first_eligible_at <= job.accepted_at
            and job.accepted_at >= row.linked_at
        )
    ]
    linked_ids = {job.id for row, job in pairs}
    return ScopeMailType(
        type=kind,
        scenario_unit='payment_attempt' if kind in PAYMENT_TYPES else 'account',
        observed_scenarios=len(scenarios),
        observed_eligible_accounts=len({row.member_id for row in positive}),
        observed_eligible_scenarios=len(positive),
        latest_reasons=dict(Counter(_safe_reason(row.reason) or 'unknown' for row in rows)),
        queue=_queue_summary(kind, pairs, now),
        unlinked_queue_jobs=sum(job.type == kind and job.id not in linked_ids for job in jobs.values()),
        lost_delivery_links=sum(row.linked_at is not None and row.delivery_id not in jobs for row in scenarios),
        accepted_over_observed_accounts=_rate(
            'account',
            len({row.member_id for row in accepted}),
            len({row.member_id for row in positive}),
            reason,
        ),
        accepted_over_observed_scenarios=_rate('scenario', len(accepted), len(positive), reason),
    )


def _types(
    scope: EmailObservationScope,
    members: list[EmailObservationMember],
    observations: list[EmailScenarioObservation],
    jobs: list[EmailDelivery],
    coverage: ScopeCoverage,
    now: int,
) -> list[ScopeMailType]:
    """Conserve exact receipts; numerator never includes unlinked historical submissions."""
    by_job = {job.id: job for job in jobs}
    by_member = {member.id: member for member in members}
    fractions_reason = (
        'diagnostic_scope' if scope.mode != 'dispatch' else coverage.reasons[0] if coverage.reasons else None
    )
    output: list[ScopeMailType] = []
    for kind in get_args(EmailType):
        rows = [row for row in observations if row.type == kind and row.first_observed_at <= coverage.source_cutoff_at]
        scenarios = [row for row in rows if row.scenario_key != 'no_scenario_v1']
        pairs, invalid = _associations(scope, by_member, scenarios, by_job, now)
        reason = 'invalid_queue_association' if invalid else fractions_reason
        output.append(_type_result(kind, rows, pairs, by_job, reason, coverage.source_cutoff_at, now))
    return output


async def scope_mail_report(scope_id: str) -> ScopeMailReport:
    """An explicit scope and a stable read transaction; no observation/dispatch side effect."""
    now = int(time.time())
    async with get_async_db_context() as session:
        if session.get_bind().dialect.name == 'postgresql':
            await session.connection(execution_options={'isolation_level': 'REPEATABLE READ'})
        # ORM SAVEPOINT starts a real SQLite read transaction even with the legacy driver mode.
        async with session.begin_nested():
            scope = await session.get(EmailObservationScope, scope_id)
            if scope is None:
                raise DiagnosticNotFound('observation_scope_missing')
            members, observations, jobs, coverage = await scope_facts(session, scope, now)
            return ScopeMailReport(
                generated_at=now,
                scope_id=scope.id,
                purpose='diagnostic' if scope.mode == 'observe' else 'dispatch',
                rule_version=scope.rule_version if scope.rule_version == RULE_VERSION else 'unsupported',
                declared_at=scope.declared_at,
                observed_from=scope.observed_from,
                closed_at=scope.closed_at,
                registrations_from=scope.registrations_from,
                registrations_until=scope.registrations_until,
                payments_from=scope.payments_from,
                payments_until=scope.payments_until,
                coverage=coverage,
                types=_types(scope, members, observations, jobs, coverage, now),
                limitations=[
                    'First observed positive facts only; states between bounded passes cannot be reconstructed.',
                    'Complete traversal covers declared members and observed sources, not continuous history.',
                    'Queue states are current; the time cutoff limits source/acceptance/receipt facts, '
                    'not past states.',
                    'Scheduled jobs may be linked before first business eligibility; queue count is not eligibility.',
                    'Legacy unlinked jobs and lost sources do not contribute to observed acceptance fractions.',
                    'SMTP acceptance is not delivery or Inbox; '
                    'external receipt coverage and delivery fractions are unknown.',
                    'Small or immature groups do not establish usefulness, causal effects or mature pilot conversion.',
                ],
            )
