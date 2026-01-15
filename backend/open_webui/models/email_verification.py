import time
import uuid
import secrets
import logging
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, String, BigInteger
from open_webui.internal.db import Base, get_db

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

    def create_verification_token(
        self, user_id: str, email: str, expiry_hours: int = 24
    ) -> Optional[EmailVerificationTokenModel]:
        """Create a new email verification token"""
        token = self.generate_token()
        expires_at = int(time.time()) + (expiry_hours * 3600)

        with get_db() as db:
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
            db.add(result)
            db.commit()
            db.refresh(result)
            if result:
                return EmailVerificationTokenModel.model_validate(result)
            else:
                return None

    def get_token_by_token_string(self, token: str) -> Optional[EmailVerificationTokenModel]:
        """Get verification token by token string"""
        try:
            with get_db() as db:
                token_record = (
                    db.query(EmailVerificationToken).filter_by(token=token).first()
                )
                return (
                    EmailVerificationTokenModel.model_validate(token_record)
                    if token_record
                    else None
                )
        except Exception as e:
            log.error(f"Error getting verification token: {e}")
            return None

    def get_tokens_by_user_id(self, user_id: str) -> list[EmailVerificationTokenModel]:
        """Get all verification tokens for a user"""
        with get_db() as db:
            tokens = db.query(EmailVerificationToken).filter_by(user_id=user_id).all()
            return [EmailVerificationTokenModel.model_validate(t) for t in tokens]

    def delete_token_by_id(self, token_id: str) -> bool:
        """Delete a verification token by ID"""
        try:
            with get_db() as db:
                db.query(EmailVerificationToken).filter_by(id=token_id).delete()
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting verification token {token_id}: {e}")
            return False

    def delete_tokens_by_user_id(self, user_id: str) -> bool:
        """Delete all verification tokens for a user"""
        try:
            with get_db() as db:
                db.query(EmailVerificationToken).filter_by(user_id=user_id).delete()
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting verification tokens for user {user_id}: {e}")
            return False

    def is_token_valid(self, token: str) -> bool:
        """Check if a token exists and is not expired"""
        token_record = self.get_token_by_token_string(token)
        if not token_record:
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
                    db.query(EmailVerificationToken)
                    .filter(EmailVerificationToken.expires_at < current_time)
                    .delete()
                )
                db.commit()
                return deleted_count
        except Exception as e:
            log.error(f"Error cleaning up expired verification tokens: {e}")
            return 0


EmailVerificationTokens = EmailVerificationTokensTable()
