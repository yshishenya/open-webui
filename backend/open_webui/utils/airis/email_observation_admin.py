"""Diagnostic administrative operations; no queue, SMTP or source mutations."""

import time
from typing import Annotated, Literal

from open_webui.internal.db import get_async_db_context
from open_webui.models.email_observation import ObservationClaim, claim_observation_run, declare_scope
from open_webui.models.email_observation_commands import EmailObservationCommand, reserve_command
from open_webui.models.email_observation_control import close_observation_scope
from open_webui.models.email_observation_schema import (
    EmailObservationMember,
    EmailObservationRun,
    EmailObservationScope,
)
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

Identifier = Annotated[str, Field(min_length=1, max_length=128, pattern=r'^[a-zA-Z0-9_-]+$')]
Timestamp = Annotated[int, Field(ge=0, le=4102444800, strict=True)]


class DiagnosticDeclaration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_key: Identifier
    user_ids: list[Identifier] = Field(min_length=1, max_length=500)
    registrations_from: Timestamp
    registrations_until: Timestamp
    payments_from: Timestamp
    payments_until: Timestamp

    @model_validator(mode='after')
    def check_bounds(self) -> 'DiagnosticDeclaration':
        if len(set(self.user_ids)) != len(self.user_ids):
            raise ValueError('Duplicate members')
        if self.registrations_from >= self.registrations_until or self.payments_from >= self.payments_until:
            raise ValueError('Invalid source bounds')
        return self


class DiagnosticStart(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_key: Identifier
    expected_run_id: Identifier | None


class DiagnosticPage(BaseModel):
    model_config = ConfigDict(extra='forbid')
    run_id: Identifier
    claim_id: Identifier
    expected_cursor: int = Field(ge=0, le=10000, strict=True)


class DiagnosticRun(BaseModel):
    id: str
    started_at: int
    finished_at: int | None
    status: Literal['running', 'completed', 'failed']
    cursor: int
    upper_ordinal: int
    scanned_members: int
    scanned_scenarios: int
    missing_source_members: int
    failure_reason: str | None
    lease_until: int | None


class DiagnosticScope(BaseModel):
    id: str
    purpose: Literal['diagnostic'] = 'diagnostic'
    administrative: bool
    declared_at: int
    observed_from: int | None
    closed_at: int | None
    registrations_from: int
    registrations_until: int
    payments_from: int
    payments_until: int
    member_count: int
    last_run: DiagnosticRun | None


class DiagnosticScopes(BaseModel):
    items: list[DiagnosticScope]
    next_cursor: str | None


class DiagnosticLease(BaseModel):
    scope: DiagnosticScope
    run_id: str
    claim_id: str | None


class DiagnosticOperationConflict(ValueError):
    """Safe state conflict; callers may reread current state."""


class DiagnosticNotFound(ValueError):
    """Missing or non-diagnostic group."""


async def _latest_run(session: AsyncSession, scope_id: str) -> EmailObservationRun | None:
    run = await session.scalar(
        select(EmailObservationRun)
        .where(EmailObservationRun.scope_id == scope_id)
        .order_by(EmailObservationRun.started_at.desc(), EmailObservationRun.id.desc())
        .limit(1)
        .execution_options(populate_existing=True)
    )
    managed = await session.scalar(
        select(EmailObservationRun)
        .join(EmailObservationCommand, EmailObservationCommand.run_id == EmailObservationRun.id)
        .where(EmailObservationCommand.scope_id == scope_id, EmailObservationCommand.action == 'start')
        .order_by(EmailObservationCommand.id.desc())
        .limit(1)
        .execution_options(populate_existing=True)
    )
    # Receipt sequence resolves separate runs started within the same second.
    return managed if managed and (not run or managed.started_at >= run.started_at) else run


async def _run_view(session: AsyncSession, scope_id: str, run: EmailObservationRun | None) -> DiagnosticRun | None:
    if run is None:
        return None
    missing = await session.scalar(
        select(func.count())
        .select_from(EmailObservationMember)
        .where(
            EmailObservationMember.scope_id == scope_id,
            EmailObservationMember.ordinal <= run.cursor,
            EmailObservationMember.user_id.is_(None),
        )
    )
    return DiagnosticRun(
        id=run.id,
        started_at=run.started_at,
        finished_at=run.finished_at,
        status=run.status,
        cursor=run.cursor,
        upper_ordinal=run.upper_ordinal,
        scanned_members=run.scanned_members,
        scanned_scenarios=run.scanned_scenarios,
        missing_source_members=missing or 0,
        failure_reason=run.failure_reason,
        lease_until=run.lease_until,
    )


async def _view(session: AsyncSession, scope_id: str) -> DiagnosticScope:
    scope = await session.get(EmailObservationScope, scope_id, populate_existing=True)
    if not scope or scope.mode != 'observe':
        raise DiagnosticNotFound('diagnostic_scope_missing')
    run = await _latest_run(session, scope_id)
    administrative = await session.scalar(
        select(EmailObservationCommand.id)
        .where(EmailObservationCommand.scope_id == scope_id, EmailObservationCommand.action == 'declare')
        .limit(1)
    )
    run_view = await _run_view(session, scope_id, run)
    return DiagnosticScope(
        id=scope.id,
        administrative=administrative is not None,
        declared_at=scope.declared_at,
        observed_from=scope.observed_from,
        closed_at=scope.closed_at,
        registrations_from=scope.registrations_from,
        registrations_until=scope.registrations_until,
        payments_from=scope.payments_from,
        payments_until=scope.payments_until,
        member_count=scope.member_count,
        last_run=run_view,
    )


async def diagnostic_scope(scope_id: str) -> DiagnosticScope:
    """Read only; completion describes frozen traversal, never historical eligibility."""
    async with get_async_db_context() as session:
        return await _view(session, scope_id)


async def diagnostic_scopes(after: str | None, limit: int) -> DiagnosticScopes:
    """Use immutable ID keyset pagination; insertions never repeat previous pages."""
    async with get_async_db_context() as session:
        query = select(EmailObservationScope.id).where(EmailObservationScope.mode == 'observe')
        if after is not None:
            query = query.where(EmailObservationScope.id > after)
        ids = list((await session.scalars(query.order_by(EmailObservationScope.id).limit(limit + 1))).all())
        return DiagnosticScopes(
            items=[await _view(session, scope_id) for scope_id in ids[:limit]],
            next_cursor=ids[limit - 1] if len(ids) > limit else None,
        )


async def declare_diagnostic(actor_id: str, form: DiagnosticDeclaration) -> DiagnosticScope:
    """Freeze all requested ordinary members, then commit a durable replay receipt."""
    now = int(time.time())
    content = form.model_dump(exclude={'request_key'})
    content['user_ids'] = sorted(form.user_ids)
    async with get_async_db_context() as session:
        receipt, created = await reserve_command(session, actor_id, form.request_key, 'declare', content, now)
        if created:
            if form.registrations_until > now:
                raise ValueError('Future registration boundary')
            receipt.scope_id = await declare_scope(
                session,
                tuple(form.user_ids),
                now,
                registrations_from=form.registrations_from,
                registrations_until=form.registrations_until,
                payments_from=form.payments_from,
                payments_until=form.payments_until,
            )
            await session.flush()
        assert receipt.scope_id is not None
        result = await _view(session, receipt.scope_id)
        await session.commit()
        return result


async def start_diagnostic(actor_id: str, scope_id: str, form: DiagnosticStart) -> DiagnosticLease:
    """Start/resume once; replay of a completed command never starts another run."""
    now = int(time.time())
    async with get_async_db_context() as session:
        content: dict[str, object] = {'scope_id': scope_id, 'expected_run_id': form.expected_run_id}
        receipt, created = await reserve_command(session, actor_id, form.request_key, 'start', content, now)
        if created:
            scope = await session.scalar(
                update(EmailObservationScope)
                .where(
                    EmailObservationScope.id == scope_id,
                    EmailObservationScope.mode == 'observe',
                    EmailObservationScope.closed_at.is_(None),
                )
                .values(member_count=EmailObservationScope.member_count)
                .returning(EmailObservationScope)
            )
            if not scope:
                raise DiagnosticOperationConflict('scope_closed_or_missing')
            current = (await _view(session, scope_id)).last_run
            if (current.id if current else None) != form.expected_run_id:
                raise DiagnosticOperationConflict('stale_run')
            claim = await claim_observation_run(session, scope_id, now)
            if claim is None:
                raise DiagnosticOperationConflict('busy')
            receipt.scope_id, receipt.run_id, receipt.claim_id = scope_id, claim.run_id, claim.claim_id
            await session.flush()
        assert receipt.run_id is not None
        run = await session.get(EmailObservationRun, receipt.run_id, populate_existing=True)
        owned = run and run.status == 'running' and run.claim_id == receipt.claim_id and run.lease_until > now
        result = DiagnosticLease(
            scope=await _view(session, scope_id), run_id=receipt.run_id, claim_id=receipt.claim_id if owned else None
        )
        await session.commit()
        return result


async def close_diagnostic(scope_id: str) -> DiagnosticScope:
    """Close only observations; repeat closure preserves the original closure time."""
    async with get_async_db_context() as session:
        if not await close_observation_scope(session, scope_id, int(time.time())):
            raise DiagnosticNotFound('diagnostic_scope_missing')
        result = await _view(session, scope_id)
        await session.commit()
        return result


async def owned_diagnostic_claim(actor_id: str, scope_id: str, form: DiagnosticPage) -> ObservationClaim:
    """The separate page credential is bound to the command's authenticated actor."""
    async with get_async_db_context() as session:
        receipt = await session.scalar(
            select(EmailObservationCommand.id).where(
                EmailObservationCommand.actor_id == actor_id,
                EmailObservationCommand.scope_id == scope_id,
                EmailObservationCommand.run_id == form.run_id,
                EmailObservationCommand.claim_id == form.claim_id,
                EmailObservationCommand.action == 'start',
            )
        )
        if not receipt:
            raise DiagnosticOperationConflict('lease_not_owned')
        return ObservationClaim(form.run_id, scope_id, form.claim_id)
