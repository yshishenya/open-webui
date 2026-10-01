"""Server-owned consent for optional product mail; service mail is independent."""

import hashlib
import logging
import os
import secrets
import time
import uuid
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from open_webui.internal.db import Base, get_async_db_context
from open_webui.models.auths import Auth
from open_webui.models.users import User
from pydantic import BaseModel
from sqlalchemy import BigInteger, Boolean, Column, Index, String, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

CONSENT_VERSION = 'product-email-v1-2026-10-02'
TOKEN_DAYS = int(os.getenv('AIRIS_EMAIL_UNSUBSCRIBE_TOKEN_DAYS', '180'))
HISTORY_DAYS = int(os.getenv('AIRIS_EMAIL_CONSENT_HISTORY_DAYS', '730'))
SUPPRESSION_DAYS = int(os.getenv('AIRIS_EMAIL_SUPPRESSION_DAYS', '365'))
if not 30 <= TOKEN_DAYS <= 365 or not 1 <= SUPPRESSION_DAYS <= HISTORY_DAYS <= 3650:
    raise ValueError('Invalid product email retention configuration')


class EmailPreference(Base):
    __tablename__ = 'airis_email_preference'

    user_id = Column(String, primary_key=True)
    email_hash = Column(String, nullable=False)
    subscribed = Column(Boolean, nullable=False, default=False)
    consent_version = Column(String, nullable=False)
    accepted_at = Column(BigInteger, nullable=True)
    withdrawn_at = Column(BigInteger, nullable=True)
    updated_at = Column(BigInteger, nullable=False)


class EmailPreferenceEvent(Base):
    __tablename__ = 'airis_email_preference_event'

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    email_hash = Column(String, nullable=False)
    action = Column(String, nullable=False)
    consent_version = Column(String, nullable=False)
    source = Column(String, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    __table_args__ = (
        Index('ix_email_preference_event_user_time', 'user_id', 'created_at'),
        Index('ix_email_preference_event_address_time', 'email_hash', 'created_at'),
    )


class EmailUnsubscribeToken(Base):
    __tablename__ = 'airis_email_unsubscribe_token'

    token_hash = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    email_hash = Column(String, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False, index=True)


class ProductEmailPreference(BaseModel):
    subscribed: bool
    email_verified: bool
    can_receive: bool
    reason: str
    consent_version: str = CONSENT_VERSION


def email_fingerprint(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def valid_product_address(email: str) -> bool:
    try:
        address = validate_email(email, check_deliverability=False)
    except EmailNotValidError:
        return False
    domain = address.domain.lower()
    return not (
        domain.endswith(('.local', '.localhost', '.invalid', '.test', '.example'))
        or any(
            domain == reserved or domain.endswith(f'.{reserved}')
            for reserved in ('localhost', 'example.com', 'example.org', 'example.net')
        )
    )


def record_event(
    session: AsyncSession, user_id: str | None, email_hash: str, action: str, source: str, now: int
) -> None:
    session.add(
        EmailPreferenceEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            email_hash=email_hash,
            action=action,
            consent_version=CONSENT_VERSION,
            source=source,
            created_at=now,
        )
    )


async def preference_for_user(session: AsyncSession, user: User, now: int) -> ProductEmailPreference:
    preference = await session.get(EmailPreference, user.id, populate_existing=True)
    address_hash = email_fingerprint(user.email)
    subscribed = bool(preference and preference.subscribed and preference.email_hash == address_hash)
    auth = await session.get(Auth, user.id, populate_existing=True)
    reason = 'ready'
    if user.role not in {'user', 'admin'} or not auth or not auth.active:
        reason = 'inactive_account'
    elif not subscribed:
        reason = 'no_consent'
    elif not valid_product_address(user.email):
        reason = 'invalid_address'
    elif not user.email_verified:
        reason = 'unverified_address'
    elif await session.scalar(
        select(EmailPreferenceEvent.id)
        .where(
            EmailPreferenceEvent.email_hash == address_hash,
            EmailPreferenceEvent.action.in_(['hard_bounce', 'complaint']),
            EmailPreferenceEvent.created_at >= now - SUPPRESSION_DAYS * 86400,
        )
        .limit(1)
    ):
        reason = 'suppressed_address'
    return ProductEmailPreference(
        subscribed=subscribed,
        email_verified=bool(user.email_verified),
        can_receive=reason == 'ready',
        reason=reason,
    )


async def get_product_preference(user_id: str, db: AsyncSession | None = None) -> ProductEmailPreference:
    async with get_async_db_context(db) as session:
        user = await session.get(User, user_id, populate_existing=True)
        if not user:
            raise LookupError('Account unavailable')
        return await preference_for_user(session, user, int(time.time()))


async def product_email_allowed(user_id: str, expected_email: str) -> bool:
    async with get_async_db_context() as session:
        user = await session.scalar(select(User).where(User.id == user_id).with_for_update())
        return bool(
            user
            and user.email == expected_email
            and (await preference_for_user(session, user, int(time.time()))).can_receive
        )


async def set_preference_in_session(session: AsyncSession, user: User, subscribed: bool, source: str, now: int) -> None:
    address_hash = email_fingerprint(user.email)
    preference = await session.get(EmailPreference, user.id, populate_existing=True)
    if preference and preference.subscribed == subscribed and preference.email_hash == address_hash:
        return
    if not preference:
        preference = EmailPreference(user_id=user.id)
        session.add(preference)
    preference.email_hash = address_hash
    preference.subscribed = subscribed
    preference.consent_version = CONSENT_VERSION
    preference.updated_at = now
    if subscribed:
        preference.accepted_at = now
        preference.withdrawn_at = None
    else:
        preference.withdrawn_at = now
    record_event(session, user.id, address_hash, 'opt_in' if subscribed else 'opt_out', source, now)
    await session.flush()


async def set_product_preference(
    user_id: str, subscribed: bool, source: Literal['signup', 'settings'], db: AsyncSession | None = None
) -> ProductEmailPreference:
    async with get_async_db_context(db) as session:
        user = await session.scalar(
            select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
        )
        if not user:
            raise LookupError('Account unavailable')
        await set_preference_in_session(session, user, subscribed, source, int(time.time()))
        await session.commit()
        return await preference_for_user(session, user, int(time.time()))


async def create_product_unsubscribe_token(user_id: str) -> str | None:
    """Check current consent and bind a fresh link to the current address."""
    async with get_async_db_context() as session:
        user = await session.scalar(
            select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
        )
        now = int(time.time())
        if not user or not (await preference_for_user(session, user, now)).can_receive:
            return None
        token = secrets.token_urlsafe(32)
        session.add(
            EmailUnsubscribeToken(
                token_hash=hashlib.sha256(token.encode()).hexdigest(),
                user_id=user.id,
                email_hash=email_fingerprint(user.email),
                created_at=now,
                expires_at=now + TOKEN_DAYS * 86400,
            )
        )
        await session.commit()
        return token


async def unsubscribe_product_email(token: str, db: AsyncSession | None = None) -> None:
    if not 32 <= len(token) <= 128:
        return
    async with get_async_db_context(db) as session:
        record = await session.get(EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest())
        now = int(time.time())
        if not record or record.expires_at <= now:
            return
        user_id = record.user_id
        user = await session.scalar(
            select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
        )
        record = await session.get(
            EmailUnsubscribeToken, hashlib.sha256(token.encode()).hexdigest(), populate_existing=True
        )
        if (
            not record
            or record.expires_at <= int(time.time())
            or not user
            or email_fingerprint(user.email) != record.email_hash
        ):
            return
        await set_preference_in_session(session, user, False, 'unsubscribe', now)
        await session.commit()


async def invalidate_product_address(session: AsyncSession, user_id: str, old_email: str) -> None:
    """Called inside the common user update transaction before its commit."""
    now = int(time.time())
    preference = await session.get(EmailPreference, user_id)
    if preference:
        preference.subscribed = False
        preference.withdrawn_at = now
        preference.updated_at = now
        record_event(session, user_id, email_fingerprint(old_email), 'address_changed', 'account', now)
    await session.execute(delete(EmailUnsubscribeToken).where(EmailUnsubscribeToken.user_id == user_id))


async def delete_product_preferences(session: AsyncSession, user_id: str) -> None:
    await session.execute(delete(EmailPreference).where(EmailPreference.user_id == user_id))
    await session.execute(delete(EmailUnsubscribeToken).where(EmailUnsubscribeToken.user_id == user_id))
    await session.execute(
        update(EmailPreferenceEvent).where(EmailPreferenceEvent.user_id == user_id).values(user_id=None)
    )


async def suppress_product_address(
    email: str, reason: Literal['hard_bounce', 'complaint'], db: AsyncSession | None = None
) -> None:
    async with get_async_db_context(db) as session:
        record_event(session, None, email_fingerprint(email), reason, 'admin', int(time.time()))
        await session.commit()


async def cleanup_product_email_records() -> None:
    """Bounded, idempotent cleanup; every scheduler instance may run it."""
    now = int(time.time())
    async with get_async_db_context() as session:
        tokens = select(EmailUnsubscribeToken.token_hash).where(EmailUnsubscribeToken.expires_at <= now).limit(1000)
        events = (
            select(EmailPreferenceEvent.id)
            .where(EmailPreferenceEvent.created_at < now - HISTORY_DAYS * 86400)
            .limit(1000)
        )
        await session.execute(delete(EmailUnsubscribeToken).where(EmailUnsubscribeToken.token_hash.in_(tokens)))
        await session.execute(delete(EmailPreferenceEvent).where(EmailPreferenceEvent.id.in_(events)))
        await session.commit()


async def cleanup_product_email_if_due(next_cleanup: float, now: float) -> float:
    """Hourly retention is independent of user automation settings."""
    if now < next_cleanup:
        return next_cleanup
    try:
        await cleanup_product_email_records()
    except Exception:
        logging.getLogger(__name__).exception('Product email retention cleanup failed')
    return now + 3600
