"""Verified provider refunds, independent of consent-bound analytics events."""

from open_webui.internal.db import Base
from sqlalchemy import BigInteger, Column, String


class AnalyticsRefund(Base):
    __tablename__ = 'airis_verified_refund'

    id = Column(String, primary_key=True)
    payment_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    amount_kopeks = Column(BigInteger, nullable=False)
    currency = Column(String, nullable=False)
    occurred_at = Column(BigInteger, nullable=False, index=True)


class AnalyticsFirstPayment(Base):
    """Immutable first successful payment marker, independent of analytics consent."""

    __tablename__ = 'airis_first_payment'

    user_id = Column(String, primary_key=True)
    payment_id = Column(String, nullable=False, unique=True)
    occurred_at = Column(BigInteger, nullable=False)
