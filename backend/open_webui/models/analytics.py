"""Consent-bound first-party funnel facts and durable delivery queue."""

from open_webui.internal.db import Base, JSONField
from sqlalchemy import BigInteger, Boolean, Column, Integer, Text, UniqueConstraint


class AnalyticsIdentity(Base):
    __tablename__ = 'airis_analytics_identity'
    id = Column(Text, primary_key=True)
    anonymous_id = Column(Text, unique=True, nullable=False)
    user_id = Column(Text, unique=True, nullable=True)
    consent = Column(Boolean, nullable=False, default=False)
    granted_at = Column(BigInteger, nullable=False)
    client_id = Column(Text, nullable=True)
    first_touch = Column(JSONField, nullable=False, default=dict)
    last_touch = Column(JSONField, nullable=False, default=dict)
    lifetime = Column(JSONField, nullable=False, default=dict)


class AnalyticsEvent(Base):
    __tablename__ = 'airis_analytics_event'
    id = Column(Text, primary_key=True)
    identity_id = Column(Text, index=True, nullable=False)
    event_name = Column(Text, nullable=False)
    occurred_at = Column(BigInteger, index=True, nullable=False)
    properties = Column(JSONField, nullable=False, default=dict)


class AnalyticsDelivery(Base):
    __tablename__ = 'airis_analytics_delivery'
    __table_args__ = (UniqueConstraint('event_id', 'destination', name='uq_analytics_delivery_event_destination'),)
    id = Column(Text, primary_key=True)
    event_id = Column(Text, nullable=False)
    destination = Column(Text, nullable=False)
    state = Column(Text, nullable=False, default='pending')
    attempts = Column(Integer, nullable=False, default=0)
    available_at = Column(BigInteger, nullable=False, default=0)
    upload_id = Column(Text, nullable=True)


class AnalyticsBinding(Base):
    __tablename__ = 'airis_analytics_binding'
    anonymous_id = Column(Text, primary_key=True)
    identity_id = Column(Text, nullable=False, index=True)
