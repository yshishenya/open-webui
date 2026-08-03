import time
import uuid
import secrets
import logging
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Boolean, Column, String, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from open_webui.internal.db import Base, get_async_db_context

log = logging.getLogger(__name__)


####################
# Password Reset Token DB Schema
####################


class PasswordResetToken(Base):
    __tablename__ = "password_reset_token"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False)
    token = Column(String, nullable=False, unique=True)
    expires_at = Column(BigInteger, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(BigInteger, nullable=False)


class PasswordResetTokenModel(BaseModel):
    id: str
    user_id: str
    token: str
    expires_at: int  # timestamp in epoch
    used: bool
    created_at: int  # timestamp in epoch

    model_config = ConfigDict(from_attributes=True)


####################
# Forms
####################


class PasswordResetRequestForm(BaseModel):
    email: str


class PasswordResetForm(BaseModel):
    token: str
    new_password: str


####################
# PasswordResetTokensTable
####################


class PasswordResetTokensTable:
    def generate_token(self) -> str:
        """Generate a secure URL-safe reset token"""
        return secrets.token_urlsafe(32)

    async def create_reset_token(
        self,
        user_id: str,
        expiry_hours: int = 1,
        db: AsyncSession | None = None,
    ) -> Optional[PasswordResetTokenModel]:
        """Create a new password reset token"""
        token = self.generate_token()
        expires_at = int(time.time()) + (expiry_hours * 3600)

        async with get_async_db_context(db) as session:
            reset_token = PasswordResetTokenModel(
                **{
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "token": token,
                    "expires_at": expires_at,
                    "used": False,
                    "created_at": int(time.time()),
                }
            )
            result = PasswordResetToken(**reset_token.model_dump())
            session.add(result)
            await session.commit()
            await session.refresh(result)
            if result:
                return PasswordResetTokenModel.model_validate(result)
            else:
                return None

    async def get_token_by_token_string(
        self, token: str, db: AsyncSession | None = None
    ) -> Optional[PasswordResetTokenModel]:
        """Get reset token by token string"""
        try:
            async with get_async_db_context(db) as session:
                result = await session.execute(select(PasswordResetToken).where(PasswordResetToken.token == token))
                token_record = result.scalar_one_or_none()
                return PasswordResetTokenModel.model_validate(token_record) if token_record else None
        except Exception as e:
            log.error(f"Error getting password reset token: {e}")
            return None

    async def get_tokens_by_user_id(
        self, user_id: str, db: AsyncSession | None = None
    ) -> list[PasswordResetTokenModel]:
        """Get all reset tokens for a user"""
        async with get_async_db_context(db) as session:
            result = await session.execute(select(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
            tokens = result.scalars().all()
            return [PasswordResetTokenModel.model_validate(t) for t in tokens]

    async def mark_token_as_used(self, token_id: str, db: AsyncSession | None = None) -> bool:
        """Mark a reset token as used"""
        try:
            async with get_async_db_context(db) as session:
                await session.execute(
                    update(PasswordResetToken).where(PasswordResetToken.id == token_id).values(used=True)
                )
                await session.commit()
                return True
        except Exception as e:
            log.error(f"Error marking reset token {token_id} as used: {e}")
            return False

    async def delete_token_by_id(self, token_id: str, db: AsyncSession | None = None) -> bool:
        """Delete a reset token by ID"""
        try:
            async with get_async_db_context(db) as session:
                await session.execute(delete(PasswordResetToken).where(PasswordResetToken.id == token_id))
                await session.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting reset token {token_id}: {e}")
            return False

    async def delete_tokens_by_user_id(self, user_id: str, db: AsyncSession | None = None) -> bool:
        """Delete all reset tokens for a user"""
        try:
            async with get_async_db_context(db) as session:
                await session.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
                await session.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting reset tokens for user {user_id}: {e}")
            return False

    async def is_token_valid(self, token: str, db: AsyncSession | None = None) -> bool:
        """Check if a token exists, is not expired, and not used"""
        token_record = await self.get_token_by_token_string(token, db=db)
        if not token_record:
            return False

        if token_record.used:
            return False

        if int(time.time()) > token_record.expires_at:
            # Token expired, delete it
            await self.delete_token_by_id(token_record.id, db=db)
            return False

        return True

    async def cleanup_expired_tokens(self, db: AsyncSession | None = None) -> int:
        """Remove all expired tokens"""
        try:
            async with get_async_db_context(db) as session:
                current_time = int(time.time())
                result = await session.execute(
                    delete(PasswordResetToken).where(PasswordResetToken.expires_at < current_time)
                )
                await session.commit()
                return result.rowcount or 0
        except Exception as e:
            log.error(f"Error cleaning up expired password reset tokens: {e}")
            return 0


PasswordResetTokens = PasswordResetTokensTable()
