"""Observed queue units are separate from unrecorded eligibility and delivery coverage."""

from collections import defaultdict
from typing import Literal, get_args

from open_webui.models.email_delivery import EmailDelivery, EmailType
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

MAIL_STATES = ('pending', 'claimed', 'retry', 'accepted', 'unknown', 'suppressed', 'expired', 'failed')
REASON_STATES = ('suppressed', 'expired', 'failed', 'unknown')


class MailOutcome(BaseModel):
    """Recorded jobs grouped by current type, template, status and reason."""

    type: str
    template_version: str
    status: str
    reason: str | None
    jobs: int
    delivery_receipts: int
    bounce_records: int
    complaint_records: int


class MailReasonCount(BaseModel):
    """Current reason count for suppressed, expired, failed or unknown jobs."""

    status: str
    reason: str | None
    jobs: int


class MailTypeSummary(BaseModel):
    """Cumulative recorded jobs, including waiting and terminal states, and distinct accounts.

    Zero observations never establish a historical denominator or receipt coverage.
    """

    type: str
    state_snapshot_at: int
    queued_jobs: int
    queued_accounts: int
    states_now: dict[str, int]
    reasons_now: list[MailReasonCount]
    delivery_receipts: int
    bounce_records: int
    complaint_records: int
    source: Literal['recorded_queue_jobs'] = 'recorded_queue_jobs'
    job_unit: Literal['queue_job'] = 'queue_job'
    eligibility_coverage: Literal['unavailable'] = 'unavailable'
    eligible_accounts: None = None
    eligibility_observed_from: None = None
    accepted_over_eligible_fraction: None = None
    receipt_coverage: Literal['unavailable'] = 'unavailable'
    delivered_over_accepted_fraction: None = None
    inbox: None = None


async def mail_outcomes(session: AsyncSession, ids: list[str], now: int) -> list[MailOutcome]:
    """Recorded queue and receipt facts never establish delivery coverage."""
    rows = (
        await session.execute(
            select(
                EmailDelivery.type,
                EmailDelivery.template_version,
                EmailDelivery.status,
                EmailDelivery.reason,
                func.count(),
                func.count(case((EmailDelivery.delivered_at <= now, 1))),
                func.count(case((EmailDelivery.bounced_at <= now, 1))),
                func.count(case((EmailDelivery.complained_at <= now, 1))),
            )
            .where(EmailDelivery.user_id.in_(ids), EmailDelivery.created_at <= now)
            .group_by(EmailDelivery.type, EmailDelivery.template_version, EmailDelivery.status, EmailDelivery.reason)
            .order_by(EmailDelivery.type, EmailDelivery.template_version, EmailDelivery.status, EmailDelivery.reason)
        )
    ).all()
    return [
        MailOutcome(
            type=kind,
            template_version=version,
            status=status,
            reason=reason,
            jobs=count,
            delivery_receipts=delivered,
            bounce_records=bounced,
            complaint_records=complained,
        )
        for kind, version, status, reason, count, delivered, bounced, complained in rows
    ]


def summarize_mail_outcomes(outcomes: list[MailOutcome], accounts: dict[str, int], now: int) -> list[MailTypeSummary]:
    """Conserve every recorded job; preserve unexpected legacy types rather than dropping rows."""
    kinds = list(get_args(EmailType))
    kinds.extend(sorted({row.type for row in outcomes} - set(kinds)))
    summaries: list[MailTypeSummary] = []
    for kind in kinds:
        rows = [row for row in outcomes if row.type == kind]
        states = dict.fromkeys(MAIL_STATES, 0)
        reasons: dict[tuple[str, str | None], int] = defaultdict(int)
        for row in rows:
            states[row.status] = states.get(row.status, 0) + row.jobs
            if row.status in REASON_STATES:
                reasons[(row.status, row.reason)] += row.jobs
        summaries.append(
            MailTypeSummary(
                type=kind,
                state_snapshot_at=now,
                queued_jobs=sum(states.values()),
                queued_accounts=accounts.get(kind, 0),
                states_now=states,
                reasons_now=[
                    MailReasonCount(status=status, reason=reason, jobs=count)
                    for (status, reason), count in sorted(
                        reasons.items(), key=lambda item: (item[0][0], item[0][1] is not None, item[0][1] or '')
                    )
                ],
                delivery_receipts=sum(row.delivery_receipts for row in rows),
                bounce_records=sum(row.bounce_records for row in rows),
                complaint_records=sum(row.complaint_records for row in rows),
            )
        )
    return summaries


async def mail_snapshot(
    session: AsyncSession, ids: list[str], now: int
) -> tuple[list[MailOutcome], list[MailTypeSummary]]:
    """Keep distinct recipient accounts independent of scenario/payment job counts."""
    outcomes = await mail_outcomes(session, ids, now)
    accounts = dict(
        (
            await session.execute(
                select(EmailDelivery.type, func.count(func.distinct(EmailDelivery.user_id)))
                .where(EmailDelivery.user_id.in_(ids), EmailDelivery.created_at <= now)
                .group_by(EmailDelivery.type)
            )
        ).all()
    )
    return outcomes, summarize_mail_outcomes(outcomes, accounts, now)
