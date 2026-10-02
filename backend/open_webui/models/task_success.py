"""Content-free foreground success and recovery from server-only checkpoints."""

import asyncio
import logging
from typing import Literal, TypedDict

from open_webui.internal.db import Base, get_async_db_context
from open_webui.models.users import User
from pydantic import BaseModel
from sqlalchemy import BigInteger, Column, ForeignKey, Index, String, case, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


class SuccessCheckpoint(TypedDict):
    operation_id: str
    kind: Literal['foreground_chat']
    completed_at: int
    source: Literal['saved_chat', 'temporary_chat', 'api']


def pending_checkpoints(
    pending: list[SuccessCheckpoint] | None, checkpoint: SuccessCheckpoint | None
) -> list[SuccessCheckpoint] | None:
    if checkpoint is None:
        return pending
    # ponytail: pending proofs stay on the message; split a table if recovery backlog makes rows large.
    proofs = {proof['operation_id']: proof for proof in pending or []}
    previous = proofs.get(checkpoint['operation_id'])
    proofs[checkpoint['operation_id']] = (
        previous if previous and previous['completed_at'] < checkpoint['completed_at'] else checkpoint
    )
    return list(proofs.values())


class TaskSuccess(Base):
    __tablename__ = 'airis_task_success'

    user_id = Column(String, ForeignKey('user.id', ondelete='CASCADE'), primary_key=True)
    operation_id = Column(String, primary_key=True)
    kind = Column(String, primary_key=True)
    completed_at = Column(BigInteger, nullable=False)
    source = Column(String, nullable=False)
    __table_args__ = (Index('ix_airis_task_success_user_time', 'user_id', 'completed_at'),)


class SuccessSummary(BaseModel):
    count: int
    first_at: int | None
    last_at: int | None


async def insert_success(
    user_id: str, checkpoint: SuccessCheckpoint, db: AsyncSession | None = None, *, message_row_id: str | None = None
) -> None:
    async with get_async_db_context(db) as session:
        # Serialize with common account deletion; a disappeared account is not recreated.
        if not await session.scalar(select(User.id).where(User.id == user_id).with_for_update()):
            return
        insert = pg_insert if session.get_bind().dialect.name == 'postgresql' else sqlite_insert
        await session.execute(
            insert(TaskSuccess)
            .values(user_id=user_id, **checkpoint)
            .on_conflict_do_update(
                index_elements=['user_id', 'operation_id', 'kind'],
                set_={
                    'completed_at': case(
                        (TaskSuccess.completed_at > checkpoint['completed_at'], checkpoint['completed_at']),
                        else_=TaskSuccess.completed_at,
                    )
                },
            )
        )
        if message_row_id:
            from open_webui.models.chat_messages import ChatMessage

            message = await session.scalar(
                select(ChatMessage)
                .where(ChatMessage.id == message_row_id, ChatMessage.user_id == user_id)
                .with_for_update()
            )
            if message and message.success_checkpoints:
                remaining = [
                    proof
                    for proof in message.success_checkpoints
                    if proof['operation_id'] != checkpoint['operation_id']
                ]
                message.success_checkpoints = remaining or None
        await session.commit()


async def record_success(
    user_id: str, checkpoint: SuccessCheckpoint | None, *, message_row_id: str | None = None
) -> bool:
    if checkpoint is None:
        return False
    for attempt in range(3):
        try:
            await asyncio.wait_for(insert_success(user_id, checkpoint, message_row_id=message_row_id), timeout=5)
            return True
        except (SQLAlchemyError, TimeoutError) as error:
            log.warning('Foreground success write attempt=%s error_type=%s', attempt + 1, type(error).__name__)
            if attempt < 2:
                await asyncio.sleep(0.1 * (attempt + 1))
    log.error('Foreground success write exhausted; saved checkpoints require reconciliation')
    return False


async def success_summary(user_id: str, db: AsyncSession | None = None) -> SuccessSummary:
    async with get_async_db_context(db) as session:
        row = (
            await session.execute(
                select(func.count(), func.min(TaskSuccess.completed_at), func.max(TaskSuccess.completed_at))
                .select_from(TaskSuccess)
                .where(TaskSuccess.user_id == user_id)
            )
        ).one()
        return SuccessSummary(count=row[0], first_at=row[1], last_at=row[2])


async def delete_task_success(session: AsyncSession, user_id: str) -> None:
    await session.execute(delete(TaskSuccess).where(TaskSuccess.user_id == user_id))


async def reconcile_success(limit: int = 100) -> int:
    """Only trust server checkpoints, never arbitrary old/imported assistant messages."""
    from open_webui.models.chat_messages import ChatMessage

    async with get_async_db_context() as session:
        rows = (
            await session.execute(
                select(ChatMessage.id, ChatMessage.user_id, ChatMessage.success_checkpoints)
                .join(User, User.id == ChatMessage.user_id)
                .where(ChatMessage.success_checkpoints.is_not(None))
                .order_by(ChatMessage.id)
                .limit(min(max(limit, 1), 100))
            )
        ).all()
    for message_id, user_id, proofs in rows:
        for proof in proofs:
            await insert_success(user_id, proof, message_row_id=message_id)
    return len(rows)


async def reconcile_success_if_due(next_run: float, now: float) -> float:
    if now < next_run:
        return next_run
    try:
        repaired = await asyncio.wait_for(reconcile_success(), timeout=15)
        if repaired:
            log.info('Foreground success checkpoints reconciled=%s', repaired)
    except (SQLAlchemyError, TimeoutError) as error:
        log.error('Foreground success reconciliation error_type=%s', type(error).__name__)
    return now + 300
