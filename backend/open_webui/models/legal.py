from __future__ import annotations

import time
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Column, String, Text
from sqlalchemy.orm import Session

from open_webui.internal.db import Base, get_db_context


class LegalDocumentAcceptance(Base):
    __tablename__ = "legal_document_acceptance"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    doc_key = Column(String, nullable=False, index=True)
    doc_version = Column(String, nullable=False)
    accepted_at = Column(BigInteger, nullable=False, index=True)

    ip = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    method = Column(String, nullable=True)


class LegalDocumentAcceptanceModel(BaseModel):
    id: str
    user_id: str
    doc_key: str
    doc_version: str
    accepted_at: int
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    method: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LegalAcceptancesTable:
    def insert_acceptance(
        self,
        user_id: str,
        doc_key: str,
        doc_version: str,
        *,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        method: Optional[str] = None,
        accepted_at: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> LegalDocumentAcceptanceModel:
        with get_db_context(db) as db:
            now = int(time.time()) if accepted_at is None else accepted_at
            record = LegalDocumentAcceptance(
                id=str(uuid.uuid4()),
                user_id=user_id,
                doc_key=doc_key,
                doc_version=doc_version,
                accepted_at=now,
                ip=ip,
                user_agent=user_agent,
                method=method,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return LegalDocumentAcceptanceModel.model_validate(record)

    def get_latest_acceptance(
        self,
        user_id: str,
        doc_key: str,
        *,
        db: Optional[Session] = None,
    ) -> Optional[LegalDocumentAcceptanceModel]:
        with get_db_context(db) as db:
            record = (
                db.query(LegalDocumentAcceptance)
                .filter_by(user_id=user_id, doc_key=doc_key)
                .order_by(LegalDocumentAcceptance.accepted_at.desc())
                .first()
            )
            if not record:
                return None
            return LegalDocumentAcceptanceModel.model_validate(record)


LegalAcceptances = LegalAcceptancesTable()

