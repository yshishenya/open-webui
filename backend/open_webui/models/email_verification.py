import time
import uuid
import secrets
import logging
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Column, String, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from open_webui.internal.db import Base, get_async_db_context

log = logging.getLogger(__name__)


####################
# Email Verification Token DB Schema
####################


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_token"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False)
    email = Column(String, nullable=False)
    token = Column(String, nullable=False, unique=True)
    expires_at = Column(BigInteger, nullable=False)
    created_at = Column(BigInteger, nullable=False)


class EmailVerificationTokenModel(BaseModel):
    id: str
    user_id: str
    email: str
    token: str
    expires_at: int  # timestamp in epoch
    created_at: int  # timestamp in epoch

    model_config = ConfigDict(from_attributes=True)


####################
# Forms
####################


class ResendVerificationForm(BaseModel):
    email: str


####################
# EmailVerificationTokensTable
####################


class EmailVerificationTokensTable:
    def generate_token(self) -> str:
        """Generate a secure URL-safe verification token"""
        return secrets.token_urlsafe(32)

    async def create_verification_token(
        self,
        user_id: str,
        email: str,
        expiry_hours: int = 24,
        db: AsyncSession | None = None,
    ) -> Optional[EmailVerificationTokenModel]:
        """Create a new email verification token"""
        token = self.generate_token()
        expires_at = int(time.time()) + (expiry_hours * 3600)

        async with get_async_db_context(db) as session:
            verification_token = EmailVerificationTokenModel(
                **{
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "email": email,
                    "token": token,
                    "expires_at": expires_at,
                    "created_at": int(time.time()),
                }
            )
            result = EmailVerificationToken(**verification_token.model_dump())
            session.add(result)
            await session.commit()
            await session.refresh(result)
            if result:
                return EmailVerificationTokenModel.model_validate(result)
            else:
                return None

    async def get_token_by_token_string(
        self, token: str, db: AsyncSession | None = None
    ) -> Optional[EmailVerificationTokenModel]:
        """Get verification token by token string"""
        try:
            async with get_async_db_context(db) as session:
                result = await session.execute(
                    select(EmailVerificationToken).where(EmailVerificationToken.token == token)
                )
                token_record = result.scalar_one_or_none()
                return EmailVerificationTokenModel.model_validate(token_record) if token_record else None
        except Exception as e:
            log.error(f"Error getting verification token: {e}")
            return None

    async def get_tokens_by_user_id(
        self, user_id: str, db: AsyncSession | None = None
    ) -> list[EmailVerificationTokenModel]:
        """Get all verification tokens for a user"""
        async with get_async_db_context(db) as session:
            result = await session.execute(
                select(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
            )
            tokens = result.scalars().all()
            return [EmailVerificationTokenModel.model_validate(t) for t in tokens]

    async def delete_token_by_id(self, token_id: str, db: AsyncSession | None = None) -> bool:
        """Delete a verification token by ID"""
        try:
            async with get_async_db_context(db) as session:
                await session.execute(delete(EmailVerificationToken).where(EmailVerificationToken.id == token_id))
                await session.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting verification token {token_id}: {e}")
            return False

    async def delete_tokens_by_user_id(self, user_id: str, db: AsyncSession | None = None) -> bool:
        """Delete all verification tokens for a user"""
        try:
            async with get_async_db_context(db) as session:
                await session.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id))
                await session.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting verification tokens for user {user_id}: {e}")
            return False

    async def is_token_valid(self, token: str, db: AsyncSession | None = None) -> bool:
        """Check if a token exists and is not expired"""
        token_record = await self.get_token_by_token_string(token, db=db)
        if not token_record:
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
                    delete(EmailVerificationToken).where(EmailVerificationToken.expires_at < current_time)
                )
                await session.commit()
                return result.rowcount or 0
        except Exception as e:
            log.error(f"Error cleaning up expired verification tokens: {e}")
            return 0


EmailVerificationTokens = EmailVerificationTokensTable()
