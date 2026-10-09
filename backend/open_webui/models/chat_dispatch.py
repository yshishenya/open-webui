"""Content-free ownership of a foreground dispatch, committed before external work."""

import time

from open_webui.internal.db import Base, get_async_db
from open_webui.models.email_delivery import dialect_insert
from sqlalchemy import JSON, BigInteger, Column, ForeignKey, String, select, update


class ChatDispatch(Base):
    __tablename__ = 'airis_chat_dispatch'

    user_id = Column(String, ForeignKey('user.id', ondelete='CASCADE'), primary_key=True)
    operation_id = Column(String, primary_key=True)
    request_hash = Column(String, nullable=False)
    receipt = Column(JSON, nullable=True)
    created_at = Column(BigInteger, nullable=False)


async def get_dispatch(user_id: str, operation_id: str) -> ChatDispatch | None:
    """Read only this account's journal without reserving or starting work."""
    async with get_async_db() as db:
        return await db.scalar(select(ChatDispatch).filter_by(user_id=user_id, operation_id=operation_id))


async def reserve_dispatch(user_id: str, operation_id: str, digest: str) -> tuple[ChatDispatch, bool]:
    """One committed owner; a missing receipt remains unknown even after process death."""
    async with get_async_db() as db:
        inserted = await db.scalar(
            dialect_insert(db, ChatDispatch)
            .values(user_id=user_id, operation_id=operation_id, request_hash=digest, created_at=int(time.time()))
            .on_conflict_do_nothing(index_elements=['user_id', 'operation_id'])
            .returning(ChatDispatch.operation_id)
        )
        row = await db.scalar(select(ChatDispatch).filter_by(user_id=user_id, operation_id=operation_id))
        if row is None:
            raise RuntimeError('Dispatch reservation missing')
        await db.commit()
        return row, inserted is not None


async def accept_dispatch(user_id: str, operation_id: str, receipt: dict[str, object]) -> None:
    """Persist only the acknowledgement; provider output and billing keep their own records."""
    async with get_async_db() as db:
        result = await db.execute(
            update(ChatDispatch)
            .where(
                ChatDispatch.user_id == user_id,
                ChatDispatch.operation_id == operation_id,
                ChatDispatch.receipt.is_(None),
            )
            .values(receipt=receipt)
        )
        if result.rowcount != 1:
            raise RuntimeError('Dispatch owner missing or already acknowledged')
        await db.commit()
