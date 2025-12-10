"""
Audit logging for tracking administrative actions
"""

import time
from typing import Optional
from enum import Enum

from open_webui.internal.db import Base, get_db
from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Column, String, Text, JSON, Index


####################
# Audit Enums
####################


class AuditAction(str, Enum):
    """Types of auditable actions"""
    PLAN_CREATED = "plan_created"
    PLAN_UPDATED = "plan_updated"
    PLAN_DELETED = "plan_deleted"
    PLAN_ACTIVATED = "plan_activated"
    PLAN_DEACTIVATED = "plan_deactivated"
    PLAN_DUPLICATED = "plan_duplicated"


####################
# Audit Log DB Schema
####################


class AuditLog(Base):
    """Audit log for administrative actions"""

    __tablename__ = "billing_audit_log"

    id = Column(String, primary_key=True, unique=True)

    # Who did it
    user_id = Column(String, nullable=False, index=True)

    # What was done
    action = Column(String, nullable=False)  # AuditAction enum
    entity_type = Column(String, nullable=False)  # "plan", "subscription"
    entity_id = Column(String, nullable=False)  # ID of affected entity

    # Details
    description = Column(Text, nullable=True)
    changes = Column(JSON, nullable=True)  # {"price": {"old": 990, "new": 1490}}
    metadata = Column(JSON, nullable=True)

    # When
    created_at = Column(BigInteger, nullable=False)


# Indexes for faster queries
Index("idx_audit_user", AuditLog.user_id)
Index("idx_audit_entity", AuditLog.entity_type, AuditLog.entity_id)
Index("idx_audit_created", AuditLog.created_at)


class AuditLogModel(BaseModel):
    id: str
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    description: Optional[str] = None
    changes: Optional[dict] = None
    metadata: Optional[dict] = None
    created_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Table Class
####################


class AuditLogs:
    """Operations on audit logs"""

    @staticmethod
    def create_log(
        user_id: str,
        action: AuditAction,
        entity_type: str,
        entity_id: str,
        description: Optional[str] = None,
        changes: Optional[dict] = None,
        metadata: Optional[dict] = None,
    ) -> AuditLogModel:
        """Create an audit log entry"""
        import uuid

        with get_db() as db:
            log = AuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=action.value,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                changes=changes,
                metadata=metadata,
                created_at=int(time.time()),
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            return AuditLogModel.model_validate(log)

    @staticmethod
    def get_logs(
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditLogModel]:
        """Get audit logs with filters"""
        with get_db() as db:
            query = db.query(AuditLog)

            if entity_type:
                query = query.filter(AuditLog.entity_type == entity_type)
            if entity_id:
                query = query.filter(AuditLog.entity_id == entity_id)
            if user_id:
                query = query.filter(AuditLog.user_id == user_id)

            logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()
            return [AuditLogModel.model_validate(log) for log in logs]
