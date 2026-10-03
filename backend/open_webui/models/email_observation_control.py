"""Serialize diagnostic pages and operator closure without touching source data."""

import asyncio

from open_webui.models.email_observation import ObservationClaim
from open_webui.models.email_observation_schema import EmailObservationRun, EmailObservationScope
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession


class ObservationStateConflict(ValueError):
    """A closed scope, lost lease or stale cursor must never fail a healthy run."""


async def _lock_observation_page(
    session: AsyncSession,
    claim: ObservationClaim,
    now: int,
    expected_cursor: int | None = None,
) -> EmailObservationScope:
    """Hold scope then run locks until page commit, in the same order as claiming/closing.

    No-op journal updates also serialize writers on SQLite, where SELECT FOR UPDATE
    does not acquire a row lock. Source tables and decision history remain unchanged.
    """
    scope = await session.scalar(
        update(EmailObservationScope)
        .where(
            EmailObservationScope.id == claim.scope_id,
            EmailObservationScope.mode == 'observe',
            EmailObservationScope.closed_at.is_(None),
        )
        .values(member_count=EmailObservationScope.member_count)
        .returning(EmailObservationScope)
        .execution_options(populate_existing=True)
    )
    if not scope:
        raise ObservationStateConflict('scope_unavailable')
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
        .values(cursor=EmailObservationRun.cursor)
        .returning(EmailObservationRun)
        .execution_options(populate_existing=True)
    )
    if not run:
        raise ObservationStateConflict('lease_lost')
    if expected_cursor is not None and run.cursor != expected_cursor:
        raise ObservationStateConflict('stale_cursor')
    return scope


async def close_observation_scope(session: AsyncSession, scope_id: str, now: int) -> bool:
    """Close only a diagnostic scope; retain its members, runs and decision history."""
    if now <= 0:
        raise ValueError('Invalid closure time')
    scope = await session.scalar(
        update(EmailObservationScope)
        .where(
            EmailObservationScope.id == scope_id,
            EmailObservationScope.mode == 'observe',
            EmailObservationScope.declared_at <= now,
        )
        .values(member_count=EmailObservationScope.member_count)
        .returning(EmailObservationScope)
        .execution_options(populate_existing=True)
    )
    if not scope:
        return False
    if scope.closed_at is None:
        scope.closed_at = now
    await session.execute(
        update(EmailObservationRun)
        .where(EmailObservationRun.scope_id == scope_id, EmailObservationRun.status == 'running')
        .values(status='failed', failure_reason='operator_stop', finished_at=now, claim_id=None, lease_until=None)
    )
    await session.flush()
    return True


async def lock_observation_page(
    session: AsyncSession, claim: ObservationClaim, now: int, expected_cursor: int | None = None
) -> EmailObservationScope:
    """Drain in-flight driver work before cancellation rolls back the owning session.

    SQLite uses a worker thread; abandoning a RETURNING cursor during cancellation
    can otherwise retain its write lock after the async connection is invalidated.
    """
    if session.get_bind().dialect.name != 'sqlite':
        return await _lock_observation_page(session, claim, now, expected_cursor)
    task = asyncio.create_task(_lock_observation_page(session, claim, now, expected_cursor))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        try:
            await task
        finally:
            await session.rollback()
        raise
