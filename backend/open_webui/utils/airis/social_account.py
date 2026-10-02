"""Social login uses the same credentials and address proof as email signup."""

import logging
import secrets
import time

from fastapi import HTTPException
from open_webui.internal.db import get_async_db_context
from open_webui.models.auths import Auth, Auths
from open_webui.models.config import Config
from open_webui.models.email_preferences import valid_product_address
from open_webui.models.email_verification import EmailVerificationTokens
from open_webui.models.users import User, UserModel, Users
from open_webui.utils.auth import get_password_hash
from pydantic import BaseModel, EmailStr, StrictStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


class VKIdentity(BaseModel):
    """Only construct from the authenticated server user_info response."""

    user_id: StrictStr
    email: EmailStr
    first_name: str = ''
    last_name: str = ''
    avatar: str = ''

    @field_validator('user_id', mode='before')
    @classmethod
    def positive_id(cls, value: object) -> str:
        if isinstance(value, bool) or not isinstance(value, (str, int)):
            raise ValueError('Missing VK identity')
        result = str(value)
        if not result.isascii() or not result.isdecimal() or int(result) <= 0:
            raise ValueError('Invalid VK identity')
        return str(int(result))


async def require_active_social_account(
    user: UserModel, db: AsyncSession | None, *, repair_legacy_vk: bool = False
) -> None:
    """Repair only a provider-authenticated legacy VK user; never reactivate Auth."""
    async with get_async_db_context(db) as session:
        stored = await session.scalar(select(User).where(User.id == user.id).with_for_update())
        if stored is None:
            raise HTTPException(403, detail='Account is unavailable')
        credential = await session.get(Auth, user.id, populate_existing=True)
        if credential is None and repair_legacy_vk:
            credential = Auth(
                id=user.id, email=stored.email, password=await get_password_hash(secrets.token_urlsafe(32)), active=True
            )
            session.add(credential)
        if credential is None or not credential.active:
            await session.rollback()
            raise HTTPException(403, detail='Account is unavailable')
        await session.commit()


async def verify_social_address(user: UserModel, db: AsyncSession | None) -> None:
    """Request proof after login, without repeated mail while a live token exists."""
    from open_webui.utils.email import email_service

    if not valid_product_address(user.email) or not email_service.is_configured():
        return
    try:
        async with get_async_db_context(db) as session:
            stored = await session.scalar(select(User).where(User.id == user.id).with_for_update())
            credential = await session.get(Auth, user.id, populate_existing=True)
            if (
                stored is None
                or stored.email != user.email
                or stored.email_verified
                or credential is None
                or not credential.active
            ):
                await session.commit()
                return
            now = int(time.time())
            tokens = await EmailVerificationTokens.get_tokens_by_user_id(user.id, db=session)
            if any(t.email == user.email and t.expires_at > now for t in tokens):
                await session.commit()
                return
            token = await EmailVerificationTokens.create_verification_token(user.id, user.email, db=session)
        if token:
            await email_service.send_verification_email(user.email, user.name, token.token)
    except Exception as error:
        if db is not None:
            await db.rollback()
        log.error('Social verification user=%s error_type=%s', user.id, type(error).__name__)


async def create_vk_account(name: str, email: str, image: str, subject: str, db: AsyncSession) -> UserModel:
    """VK signup shares the email/shared-OAuth credential lifecycle."""
    user = await Auths.insert_new_auth(
        email=email,
        password=await get_password_hash(secrets.token_urlsafe(32)),
        name=name,
        profile_image_url=image,
        role=await Config.get('ui.default_user_role'),
        oauth={'vk': {'sub': subject}},
        db=db,
    )
    if not user:
        raise HTTPException(500, detail='Failed to create user')
    if await Users.get_num_users(db=db) == 1:
        await Users.update_user_role_by_id(user.id, 'admin', db=db)
        user = await Users.get_user_by_id(user.id, db=db)
        await Config.upsert({'ui.enable_signup': False})
    return user
