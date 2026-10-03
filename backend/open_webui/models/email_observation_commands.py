"""Durable administrative replay receipts; credentials are never part of generic views."""

import hashlib
import json
from typing import Literal

from open_webui.internal.db import Base
from open_webui.models.email_delivery import dialect_insert
from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Index, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession

CommandAction = Literal['declare', 'start']


class EmailObservationCommand(Base):
    __tablename__ = 'airis_email_observation_command'
    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_id = Column(String, nullable=False)
    request_key = Column(String, nullable=False)
    request_hash = Column(String, nullable=False)
    action = Column(String, nullable=False)
    scope_id = Column(String, ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE'), nullable=True)
    run_id = Column(String, ForeignKey('airis_email_observation_run.id', ondelete='CASCADE'), nullable=True)
    claim_id = Column(String, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    __table_args__ = (
        Index('uq_email_observation_command_replay', 'actor_id', 'request_key', unique=True),
        Index('ix_email_observation_command_scope', 'scope_id', 'action'),
        CheckConstraint("action IN ('declare','start')", name='ck_email_observation_command_action'),
    )


class ObservationCommandConflict(ValueError):
    """A previously used command key has different normalized content."""


def command_hash(action: CommandAction, content: dict[str, object]) -> str:
    """Hash canonical command content, including purpose and immutable bounds."""
    payload = json.dumps({'action': action, 'content': content}, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(payload.encode()).hexdigest()


async def reserve_command(
    session: AsyncSession, actor_id: str, key: str, action: CommandAction, content: dict[str, object], now: int
) -> tuple[EmailObservationCommand, bool]:
    """Reserve and finish in one transaction; concurrent replays wait for its receipt.

    Callers rollback any rejected operation. An incomplete reservation is never
    committed, so process death cannot leave a scope or lease without its receipt.
    """
    digest = command_hash(action, content)
    inserted = await session.scalar(
        dialect_insert(session, EmailObservationCommand)
        .values(
            actor_id=actor_id,
            request_key=key,
            request_hash=digest,
            action=action,
            created_at=now,
        )
        .on_conflict_do_nothing(index_elements=['actor_id', 'request_key'])
        .returning(EmailObservationCommand.id)
    )
    row = await session.scalar(
        select(EmailObservationCommand).where(
            EmailObservationCommand.actor_id == actor_id, EmailObservationCommand.request_key == key
        )
    )
    if not row or row.request_hash != digest or row.action != action:
        raise ObservationCommandConflict('request_key_conflict')
    return row, inserted is not None
