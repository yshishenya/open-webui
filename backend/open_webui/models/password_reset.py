import time
import uuid
import secrets
import logging
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, String, BigInteger, Boolean
from open_webui.internal.db import Base, get_db

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

    def create_reset_token(
        self, user_id: str, expiry_hours: int = 1
    ) -> Optional[PasswordResetTokenModel]:
        """Create a new password reset token"""
        token = self.generate_token()
        expires_at = int(time.time()) + (expiry_hours * 3600)

        with get_db() as db:
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
            db.add(result)
            db.commit()
            db.refresh(result)
            if result:
                return PasswordResetTokenModel.model_validate(result)
            else:
                return None

    def get_token_by_token_string(self, token: str) -> Optional[PasswordResetTokenModel]:
        """Get reset token by token string"""
        try:
            with get_db() as db:
                token_record = (
                    db.query(PasswordResetToken).filter_by(token=token).first()
                )
                return (
                    PasswordResetTokenModel.model_validate(token_record)
                    if token_record
                    else None
                )
        except Exception as e:
            log.error(f"Error getting password reset token: {e}")
            return None

    def get_tokens_by_user_id(self, user_id: str) -> list[PasswordResetTokenModel]:
        """Get all reset tokens for a user"""
        with get_db() as db:
            tokens = db.query(PasswordResetToken).filter_by(user_id=user_id).all()
            return [PasswordResetTokenModel.model_validate(t) for t in tokens]

    def mark_token_as_used(self, token_id: str) -> bool:
        """Mark a reset token as used"""
        try:
            with get_db() as db:
                db.query(PasswordResetToken).filter_by(id=token_id).update({"used": True})
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error marking reset token {token_id} as used: {e}")
            return False

    def delete_token_by_id(self, token_id: str) -> bool:
        """Delete a reset token by ID"""
        try:
            with get_db() as db:
                db.query(PasswordResetToken).filter_by(id=token_id).delete()
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting reset token {token_id}: {e}")
            return False

    def delete_tokens_by_user_id(self, user_id: str) -> bool:
        """Delete all reset tokens for a user"""
        try:
            with get_db() as db:
                db.query(PasswordResetToken).filter_by(user_id=user_id).delete()
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting reset tokens for user {user_id}: {e}")
            return False

    def is_token_valid(self, token: str) -> bool:
        """Check if a token exists, is not expired, and not used"""
        token_record = self.get_token_by_token_string(token)
        if not token_record:
            return False
        
        if token_record.used:
            return False
        
        if int(time.time()) > token_record.expires_at:
            # Token expired, delete it
            self.delete_token_by_id(token_record.id)
            return False
        
        return True

    def cleanup_expired_tokens(self) -> int:
        """Remove all expired tokens"""
        try:
            with get_db() as db:
                current_time = int(time.time())
                deleted_count = (
                    db.query(PasswordResetToken)
                    .filter(PasswordResetToken.expires_at < current_time)
                    .delete()
                )
                db.commit()
                return deleted_count
        except Exception as e:
            log.error(f"Error cleaning up expired password reset tokens: {e}")
            return 0


PasswordResetTokens = PasswordResetTokensTable()
