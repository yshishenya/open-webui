"""Bounded content-free history cleanup; preserve replay sources and unresolved sends."""

from __future__ import annotations

from open_webui.models.analytics import AnalyticsDelivery, AnalyticsEvent, AnalyticsIdentity
from open_webui.models.email_delivery import EmailDelivery
from open_webui.models.email_observation_commands import EmailObservationCommand
from open_webui.models.email_observation_schema import (
    EmailDecisionEvent,
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
    EmailScenarioObservation,
)
from open_webui.models.users import User
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

DAY = 86400
ANALYTICS_RETENTION_SECONDS = 90 * DAY
ORPHAN_MAIL_RETENTION_SECONDS = 30 * DAY
CLOSED_SCOPE_RETENTION_SECONDS = 730 * DAY
BATCH_SIZE = 1000
ANALYTICS_TERMINAL = ('delivered', 'unmatched', 'failed', 'suppressed')
MAIL_TERMINAL = ('accepted', 'suppressed', 'expired', 'failed')
_identity_cursor: str | None = None


class HistoryRetentionExpired(ValueError):
    """Retained metadata must not be reported as an empty complete history."""


def retained_touch(touch: dict[str, object], granted_at: int, now: int) -> dict[str, object]:
    """Each advertising touch has its own clock; renewing last never extends first."""
    timestamp = touch.get('occurred_at', granted_at)
    return touch if isinstance(timestamp, int) and timestamp > now - ANALYTICS_RETENTION_SECONDS else {}


def require_scope_history(scope: EmailObservationScope, now: int) -> None:
    if scope.closed_at is not None and scope.closed_at <= now - CLOSED_SCOPE_RETENTION_SECONDS:
        raise HistoryRetentionExpired('Observation history retention expired')


async def _analytics(session: AsyncSession, now: int) -> str | None:
    # ponytail: hourly keyset scan of1000 identities; durable cursor if sweep latency becomes material.
    query = select(AnalyticsIdentity).order_by(AnalyticsIdentity.id).limit(BATCH_SIZE)
    if _identity_cursor is not None:
        query = query.where(AnalyticsIdentity.id > _identity_cursor)
    identities = list((await session.scalars(query.with_for_update(skip_locked=True))).all())
    for identity in identities:
        identity.first_touch = retained_touch(identity.first_touch or {}, identity.granted_at, now)
        identity.last_touch = retained_touch(identity.last_touch or {}, identity.granted_at, now)
    owners = [identity.id for identity in identities]
    old = select(AnalyticsEvent.id).where(
        AnalyticsEvent.identity_id.in_(owners),
        AnalyticsEvent.occurred_at <= now - ANALYTICS_RETENTION_SECONDS,
        ~select(AnalyticsDelivery.id)
        .where(
            AnalyticsDelivery.event_id == AnalyticsEvent.id,
            AnalyticsDelivery.state.not_in(ANALYTICS_TERMINAL),
        )
        .exists(),
    )
    jobs = select(AnalyticsDelivery.id).where(AnalyticsDelivery.event_id.in_(old)).limit(BATCH_SIZE)
    await session.execute(delete(AnalyticsDelivery).where(AnalyticsDelivery.id.in_(jobs)))
    events = old.where(AnalyticsEvent.properties != {}).limit(BATCH_SIZE)
    await session.execute(update(AnalyticsEvent).where(AnalyticsEvent.id.in_(events)).values(properties={}))
    return identities[-1].id if len(identities) == BATCH_SIZE else None


async def _orphan_mail(session: AsyncSession, now: int) -> None:
    jobs = (
        select(EmailDelivery.id)
        .where(
            EmailDelivery.user_id.is_(None),
            EmailDelivery.status.in_(MAIL_TERMINAL),
            EmailDelivery.retryable.is_(False),
            EmailDelivery.lease_until.is_(None),
            EmailDelivery.updated_at <= now - ORPHAN_MAIL_RETENTION_SECONDS,
        )
        .order_by(EmailDelivery.updated_at, EmailDelivery.id)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )
    await session.execute(delete(EmailDelivery).where(EmailDelivery.id.in_(jobs)))


async def _closed_observations(session: AsyncSession, now: int) -> None:
    scope_ids = list(
        (
            await session.scalars(
                select(EmailObservationScope.id)
                .where(
                    EmailObservationScope.closed_at <= now - CLOSED_SCOPE_RETENTION_SECONDS,
                    select(EmailObservationMember.id)
                    .where(
                        EmailObservationMember.scope_id == EmailObservationScope.id,
                    )
                    .exists(),
                    ~select(EmailObservationRun.id)
                    .where(
                        EmailObservationRun.scope_id == EmailObservationScope.id,
                        EmailObservationRun.status == 'running',
                    )
                    .exists(),
                )
                .order_by(EmailObservationScope.closed_at, EmailObservationScope.id)
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
        ).all()
    )
    members = select(EmailObservationMember.id).where(EmailObservationMember.scope_id.in_(scope_ids))
    observations = select(EmailScenarioObservation.id).where(EmailScenarioObservation.member_id.in_(members))
    decisions = (
        select(EmailDecisionEvent.id).where(EmailDecisionEvent.observation_id.in_(observations)).limit(BATCH_SIZE)
    )
    await session.execute(delete(EmailDecisionEvent).where(EmailDecisionEvent.id.in_(decisions)))
    empty_observations = observations.where(
        ~select(EmailDecisionEvent.id)
        .where(
            EmailDecisionEvent.observation_id == EmailScenarioObservation.id,
        )
        .exists(),
    ).limit(BATCH_SIZE)
    await session.execute(delete(EmailScenarioObservation).where(EmailScenarioObservation.id.in_(empty_observations)))
    empty_members = members.where(
        ~select(EmailScenarioObservation.id)
        .where(
            EmailScenarioObservation.member_id == EmailObservationMember.id,
        )
        .exists(),
    ).limit(BATCH_SIZE)
    await session.execute(delete(EmailObservationMember).where(EmailObservationMember.id.in_(empty_members)))


async def cleanup_onboarding_records(session: AsyncSession, now: int) -> None:
    """Commit the caller's hourly cleanup, then advance only the disposable scan cursor."""
    global _identity_cursor
    cursor = await _analytics(session, now)
    await _orphan_mail(session, now)
    await _closed_observations(session, now)
    commands = (
        select(EmailObservationCommand.id)
        .where(
            EmailObservationCommand.created_at <= now - ORPHAN_MAIL_RETENTION_SECONDS,
            ~select(User.id).where(User.id == EmailObservationCommand.actor_id).exists(),
        )
        .limit(BATCH_SIZE)
    )
    await session.execute(delete(EmailObservationCommand).where(EmailObservationCommand.id.in_(commands)))
    await session.commit()
    _identity_cursor = cursor
