"""Durable, content-free email jobs and shared SMTP capacity."""

import time
import uuid
from typing import Literal, get_args

from open_webui.internal.db import Base, get_async_db_context
from pydantic import BaseModel, ConfigDict
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    and_,
    case,
    delete,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import Insert as PgInsert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import Insert as SqliteInsert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

EmailType = Literal['welcome', 'activation_24h', 'paid_value_72h', 'payment_help_72h', 'feedback_14d', 'topup_credited']
LEASE_SECONDS = 180
SUBMISSION_WINDOW_SECONDS = 100  # 90-second operation plus SMTP cleanup timeout.
RETRY_SECONDS = (300, 1800, 7200)
WAITING = ('pending', 'retry', 'claimed')


class EmailDelivery(Base):
    __tablename__ = 'airis_email_delivery'

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    category = Column(String, nullable=False)
    type = Column(String, nullable=False)
    template_version = Column(String, nullable=False)
    scenario_key = Column(String, nullable=False)
    payment_id = Column(String, nullable=True)
    due_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=True)
    status = Column(String, nullable=False, default='pending')
    reason = Column(String, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    retryable = Column(Boolean, nullable=False, default=False)
    claim_id = Column(String, nullable=True)
    lease_until = Column(BigInteger, nullable=True)
    submitted_at = Column(BigInteger, nullable=True)
    accepted_at = Column(BigInteger, nullable=True)
    provider_id = Column(String, nullable=False)
    delivered_at = Column(BigInteger, nullable=True)
    bounced_at = Column(BigInteger, nullable=True)
    complained_at = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    __table_args__ = (
        UniqueConstraint('user_id', 'type', 'scenario_key', name='uq_email_delivery_scenario'),
        CheckConstraint("category IN ('product', 'service')", name='ck_email_delivery_category'),
        CheckConstraint(
            "status IN ('pending','claimed','retry','accepted','unknown','suppressed','expired','failed')",
            name='ck_email_delivery_status',
        ),
        Index('ix_email_delivery_due', 'status', 'category', 'due_at'),
        Index('ix_email_delivery_user_time', 'user_id', 'category', 'submitted_at'),
        Index('ix_email_delivery_lease', 'status', 'lease_until'),
    )


class EmailTransportWindow(Base):
    __tablename__ = 'airis_email_transport_window'

    transport_key = Column(String, primary_key=True)
    minute = Column(BigInteger, primary_key=True)
    total = Column(Integer, nullable=False)
    product = Column(Integer, nullable=False)


class DeliveryView(BaseModel):
    """Administrative output never includes addresses, tokens or message bodies."""

    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str | None
    category: str
    type: str
    template_version: str
    scenario_key: str
    payment_id: str | None
    due_at: int
    expires_at: int | None
    status: str
    reason: str | None
    attempts: int
    retryable: bool
    claim_id: str | None
    lease_until: int | None
    submitted_at: int | None
    accepted_at: int | None
    provider_id: str
    delivered_at: int | None
    bounced_at: int | None
    complained_at: int | None
    created_at: int
    updated_at: int


def dialect_insert(session: AsyncSession, model: type[Base]) -> PgInsert | SqliteInsert:
    return (pg_insert if session.get_bind().dialect.name == 'postgresql' else sqlite_insert)(model)


async def enqueue_email(
    session: AsyncSession,
    user_id: str,
    email_type: EmailType,
    scenario_key: str,
    due_at: int,
    expires_at: int | None,
    *,
    payment_id: str | None = None,
) -> str | None:
    """Insert in the caller's transaction; repeated source facts are harmless."""
    if email_type not in get_args(EmailType) or not 1 <= len(scenario_key) <= 128:
        raise ValueError('Invalid email scenario')
    if email_type != 'topup_credited' and expires_at is None:
        raise ValueError('Optional email requires expiry')
    if expires_at is not None and expires_at < due_at:
        raise ValueError('Email window ends before it starts')
    job_id = str(uuid.uuid4())
    now = int(time.time())
    return await session.scalar(
        dialect_insert(session, EmailDelivery)
        .values(
            id=job_id,
            user_id=user_id,
            category='service' if email_type == 'topup_credited' else 'product',
            type=email_type,
            template_version='credited_v1' if email_type == 'topup_credited' else 'onboarding_v1',
            scenario_key=scenario_key,
            payment_id=payment_id,
            due_at=due_at,
            expires_at=expires_at,
            status='pending',
            attempts=0,
            retryable=False,
            provider_id=f'<airis-{job_id}@airis.you>',
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_nothing(index_elements=['user_id', 'type', 'scenario_key'])
        .returning(EmailDelivery.id)
    )


async def cancel_optional_email(session: AsyncSession, user_id: str, reason: str, now: int) -> None:
    """Do not relabel an already-submitting operation as proven unsent."""
    await session.execute(
        update(EmailDelivery)
        .where(
            EmailDelivery.user_id == user_id,
            EmailDelivery.category == 'product',
            EmailDelivery.status.in_(WAITING),
            EmailDelivery.submitted_at.is_(None),
        )
        .values(status='suppressed', reason=reason, retryable=False, claim_id=None, lease_until=None, updated_at=now)
    )


async def delete_account_deliveries(session: AsyncSession, user_id: str) -> None:
    now = int(time.time())
    await session.execute(
        update(EmailDelivery)
        .where(EmailDelivery.user_id == user_id)
        .values(
            user_id=None,
            status=case(
                (and_(EmailDelivery.status == 'claimed', EmailDelivery.submitted_at.is_not(None)), 'unknown'),
                (EmailDelivery.status.in_(WAITING), 'suppressed'),
                else_=EmailDelivery.status,
            ),
            reason='deleted_account',
            retryable=False,
            updated_at=now,
        )
    )


async def claim_email(now: int, db: AsyncSession | None = None) -> DeliveryView | None:
    """Compare-and-set also prevents duplicate ownership in SQLite tests."""
    async with get_async_db_context(db) as session:
        stale = (
            select(EmailDelivery.id)
            .where(
                EmailDelivery.status == 'claimed',
                EmailDelivery.lease_until <= now,
            )
            .order_by(EmailDelivery.lease_until)
            .limit(100)
        )
        await session.execute(
            update(EmailDelivery)
            .where(EmailDelivery.id.in_(stale), EmailDelivery.status == 'claimed', EmailDelivery.lease_until <= now)
            .values(
                status=case(
                    (EmailDelivery.submitted_at.is_not(None), 'unknown'),
                    (EmailDelivery.attempts >= 4, 'failed'),
                    else_='retry',
                ),
                reason=case((EmailDelivery.submitted_at.is_not(None), 'submission_interrupted'), else_='claim_expired'),
                retryable=EmailDelivery.submitted_at.is_(None),
                lease_until=None,
                due_at=now,
                updated_at=now,
            )
        )
        expired = (
            select(EmailDelivery.id)
            .where(
                EmailDelivery.status.in_(['pending', 'retry']),
                EmailDelivery.expires_at <= now,
            )
            .order_by(EmailDelivery.expires_at)
            .limit(100)
        )
        await session.execute(
            update(EmailDelivery)
            .where(
                EmailDelivery.id.in_(expired),
                EmailDelivery.status.in_(['pending', 'retry']),
                EmailDelivery.expires_at <= now,
            )
            .values(status='expired', reason='expired', updated_at=now)
        )
        candidate = await session.scalar(
            select(EmailDelivery.id)
            .where(
                EmailDelivery.status.in_(['pending', 'retry']),
                EmailDelivery.due_at <= now,
                or_(EmailDelivery.expires_at.is_(None), EmailDelivery.expires_at > now),
                EmailDelivery.user_id.is_not(None),
            )
            .order_by(EmailDelivery.category.desc(), EmailDelivery.due_at, EmailDelivery.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if not candidate:
            await session.commit()
            return None
        owner = str(uuid.uuid4())
        row = await session.scalar(
            update(EmailDelivery)
            .where(
                EmailDelivery.id == candidate,
                EmailDelivery.status.in_(['pending', 'retry']),
            )
            .values(status='claimed', claim_id=owner, lease_until=now + LEASE_SECONDS, updated_at=now)
            .returning(EmailDelivery)
        )
        result = DeliveryView.model_validate(row) if row else None
        await session.commit()
        return result


async def finish_email(
    job: DeliveryView,
    status: Literal['accepted', 'failed', 'unknown'],
    retryable: bool,
    now: int,
) -> None:
    async with get_async_db_context() as session:
        row = await session.scalar(
            select(EmailDelivery)
            .where(
                EmailDelivery.id == job.id,
                EmailDelivery.claim_id == job.claim_id,
                EmailDelivery.status.in_(['claimed', 'unknown']),
            )
            .with_for_update()
        )
        if not row:
            return
        row.status = status
        row.retryable = retryable and status == 'failed'
        row.reason = {
            'accepted': None,
            'unknown': 'smtp_unknown',
            'failed': 'smtp_temporary' if retryable else 'smtp_terminal',
        }[status]
        if row.user_id is None:
            row.reason = 'deleted_account'
            row.retryable = False
        if status == 'accepted':
            row.accepted_at = now
        elif status == 'failed':
            row.submitted_at = None  # Explicit refusal proves no accepted submission.
            if retryable and row.user_id is not None and row.attempts <= len(RETRY_SECONDS):
                row.status = 'retry'
                row.due_at = now + RETRY_SECONDS[max(row.attempts - 1, 0)]
                if row.expires_at is not None and row.due_at >= row.expires_at:
                    row.status, row.reason = 'expired', 'expired'
        row.lease_until = None
        row.updated_at = now
        await session.commit()


async def defer_email_capacity(job: DeliveryView, now: int) -> None:
    """Only the current, proven-unsent claim can wait without losing a retry."""
    async with get_async_db_context() as session:
        await session.execute(
            update(EmailDelivery)
            .where(
                EmailDelivery.id == job.id,
                EmailDelivery.claim_id == job.claim_id,
                EmailDelivery.status == 'claimed',
                EmailDelivery.submitted_at.is_(None),
                EmailDelivery.attempts > 0,
            )
            .values(
                status=case((EmailDelivery.expires_at <= now + RETRY_SECONDS[0], 'expired'), else_='pending'),
                reason=case(
                    (EmailDelivery.expires_at <= now + RETRY_SECONDS[0], 'expired'), else_='transport_capacity'
                ),
                attempts=EmailDelivery.attempts - 1,
                due_at=now + RETRY_SECONDS[0],
                retryable=False,
                claim_id=None,
                lease_until=None,
                updated_at=now,
            )
        )
        await session.commit()


async def reserve_transport(
    key: str,
    product: bool,
    total_limit: int,
    product_limit: int,
    now: int,
    daily_total_limit: int = 100,
    daily_product_limit: int = 50,
) -> bool:
    """Atomically reserve fixed-minute and UTC-day capacity; no SMTP locks."""
    windows = [(key, 60, total_limit, product_limit), (key + ':day', 86400, daily_total_limit, daily_product_limit)]
    for _, _, total, optional in windows:
        if not 1 <= total <= 10000 or not 0 <= optional < total:
            raise ValueError('Invalid shared SMTP capacity')
    if product and (product_limit == 0 or daily_product_limit == 0):
        return False
    async with get_async_db_context() as session:
        for transport_key, seconds, total, optional in windows:
            if not await _reserve_transport_window(session, transport_key, seconds, product, total, optional, now):
                await session.rollback()
                return False
        await session.commit()
        return True


async def _reserve_transport_window(
    session: AsyncSession, key: str, seconds: int, product: bool, total: int, optional: int, now: int
) -> bool:
    """Reuse the existing bucket column; namespace cleanup by key and window units."""
    result = await session.scalar(
        dialect_insert(session, EmailTransportWindow)
        .values(transport_key=key, minute=now // seconds, total=1, product=int(product))
        .on_conflict_do_update(
            index_elements=['transport_key', 'minute'],
            set_={'total': EmailTransportWindow.total + 1, 'product': EmailTransportWindow.product + int(product)},
            where=and_(EmailTransportWindow.total < total, or_(not product, EmailTransportWindow.product < optional)),
        )
        .returning(EmailTransportWindow.total)
    )
    old = (
        select(EmailTransportWindow.minute)
        .where(
            EmailTransportWindow.transport_key == key, EmailTransportWindow.minute < now // seconds - 86400 // seconds
        )
        .limit(100)
    )
    await session.execute(
        delete(EmailTransportWindow).where(
            EmailTransportWindow.transport_key == key, EmailTransportWindow.minute.in_(old)
        )
    )
    return result is not None


async def requeue_email(job_id: str, now: int) -> bool:
    """Only retry proven-unsent temporary failures; never accepted/unknown."""
    async with get_async_db_context() as session:
        result = await session.scalar(
            update(EmailDelivery)
            .where(
                EmailDelivery.id == job_id,
                EmailDelivery.status == 'failed',
                EmailDelivery.retryable.is_(True),
                EmailDelivery.submitted_at.is_(None),
                EmailDelivery.user_id.is_not(None),
                or_(EmailDelivery.expires_at.is_(None), EmailDelivery.expires_at > now),
            )
            .values(status='pending', attempts=0, due_at=now, reason='admin_retry', updated_at=now)
            .returning(EmailDelivery.id)
        )
        await session.commit()
        return result is not None
