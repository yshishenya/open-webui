from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, ConfigDict
from sqlalchemy import (
    BigInteger,
    JSON,
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Text,
    Index,
)

from open_webui.internal.db import Base

####################
# Billing Enums
####################


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"
    PAUSED = "paused"


class TransactionStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class UsageMetric(str, Enum):
    TOKENS_INPUT = "tokens_input"
    TOKENS_OUTPUT = "tokens_output"
    REQUESTS = "requests"
    IMAGES = "images"
    AUDIO_MINUTES = "audio_minutes"


####################
# Plan DB Schema
####################


class Plan(Base):
    """Subscription plans (тарифные планы)"""

    __tablename__ = "billing_plan"

    id = Column(String, primary_key=True, unique=True)
    name = Column(String, nullable=False)  # "Free", "Pro", "Business"
    name_ru = Column(String, nullable=True)  # Русское название
    description = Column(Text, nullable=True)
    description_ru = Column(Text, nullable=True)

    # Pricing
    price = Column(Numeric(10, 2), nullable=False)  # Цена в рублях (UI)
    price_kopeks = Column(BigInteger, nullable=False, default=0)  # Источник истины
    currency = Column(String, default="RUB", nullable=False)
    interval = Column(String, nullable=False)  # "month", "year"
    included_kopeks_per_period = Column(BigInteger, nullable=False, default=0)
    discount_percent = Column(Integer, nullable=False, default=0)
    model_tiers_allowed = Column(JSON, nullable=True)
    images_per_period = Column(Integer, nullable=True)
    tts_seconds_per_period = Column(Integer, nullable=True)
    max_reply_cost_kopeks = Column(BigInteger, nullable=True)
    daily_cap_kopeks = Column(BigInteger, nullable=True)
    is_annual = Column(Boolean, nullable=False, default=False)

    # Quotas
    quotas = Column(JSON, nullable=True)  # {"tokens_input": 1000000, "tokens_output": 500000}
    features = Column(JSON, nullable=True)  # ["gpt4", "claude", "api_access"]

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    plan_extra_metadata = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class PlanModel(BaseModel):
    id: str
    name: str
    name_ru: Optional[str] = None
    description: Optional[str] = None
    description_ru: Optional[str] = None

    price: float
    price_kopeks: int = 0
    currency: str = "RUB"
    interval: str
    included_kopeks_per_period: int = 0
    discount_percent: int = 0
    model_tiers_allowed: Optional[list[str]] = None
    images_per_period: Optional[int] = None
    tts_seconds_per_period: Optional[int] = None
    max_reply_cost_kopeks: Optional[int] = None
    daily_cap_kopeks: Optional[int] = None
    is_annual: bool = False

    quotas: Optional[dict] = None
    features: Optional[List[str]] = None

    is_active: bool = True
    display_order: int = 0
    plan_extra_metadata: Optional[dict] = None

    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Subscription DB Schema
####################


class Subscription(Base):
    """User subscriptions"""

    __tablename__ = "billing_subscription"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    plan_id = Column(String, nullable=False)

    # Status
    status = Column(String, nullable=False)  # SubscriptionStatus enum

    # Payment provider data
    yookassa_payment_id = Column(String, nullable=True)
    yookassa_subscription_id = Column(String, nullable=True)

    # Billing period
    current_period_start = Column(BigInteger, nullable=False)
    current_period_end = Column(BigInteger, nullable=False)

    # Flags
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    auto_renew = Column(Boolean, default=False, nullable=False)
    trial_end = Column(BigInteger, nullable=True)

    # Metadata
    last_payment_id = Column(String, nullable=True)
    wallet_id = Column(String, nullable=True)
    payment_method_id = Column(String, nullable=True)
    next_plan_id = Column(String, nullable=True)
    extra_metadata = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


# Index for faster queries
Index("idx_subscription_user_status", Subscription.user_id, Subscription.status)


class SubscriptionModel(BaseModel):
    id: str
    user_id: str
    plan_id: str

    status: str

    yookassa_payment_id: Optional[str] = None
    yookassa_subscription_id: Optional[str] = None

    current_period_start: int
    current_period_end: int

    cancel_at_period_end: bool = False
    auto_renew: bool = False
    trial_end: Optional[int] = None
    last_payment_id: Optional[str] = None
    wallet_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    next_plan_id: Optional[str] = None

    extra_metadata: Optional[dict] = None

    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Usage DB Schema
####################


class Usage(Base):
    """Track user usage metrics"""

    __tablename__ = "billing_usage"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    subscription_id = Column(String, nullable=True)

    # Metric tracking
    metric = Column(String, nullable=False)  # UsageMetric enum
    amount = Column(BigInteger, nullable=False)  # Number of tokens/requests/etc

    # Period tracking
    period_start = Column(BigInteger, nullable=False)
    period_end = Column(BigInteger, nullable=False)

    # Context
    model_id = Column(String, nullable=True)  # Which AI model was used
    chat_id = Column(String, nullable=True)  # Related chat
    extra_metadata = Column(JSON, nullable=True)  # Additional context

    created_at = Column(BigInteger, nullable=False)


# Indexes for analytics queries
Index("idx_usage_user_metric", Usage.user_id, Usage.metric)
Index("idx_usage_period", Usage.period_start, Usage.period_end)


class UsageModel(BaseModel):
    id: str
    user_id: str
    subscription_id: Optional[str] = None

    metric: str
    amount: int

    period_start: int
    period_end: int

    model_id: Optional[str] = None
    chat_id: Optional[str] = None
    extra_metadata: Optional[dict] = None

    created_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Transaction DB Schema
####################


class Transaction(Base):
    """Payment transactions history"""

    __tablename__ = "billing_transaction"

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    subscription_id = Column(String, nullable=True)

    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="RUB", nullable=False)
    status = Column(String, nullable=False)  # TransactionStatus enum

    # Payment provider
    yookassa_payment_id = Column(String, nullable=True, unique=True)
    yookassa_status = Column(String, nullable=True)

    # Description
    description = Column(Text, nullable=True)
    description_ru = Column(Text, nullable=True)

    # Receipt URL (ЮКасса provides this)
    receipt_url = Column(Text, nullable=True)

    # Metadata
    extra_metadata = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


Index("idx_transaction_user", Transaction.user_id)
Index("idx_transaction_yookassa", Transaction.yookassa_payment_id)


class TransactionModel(BaseModel):
    id: str
    user_id: str
    subscription_id: Optional[str] = None

    amount: float
    currency: str = "RUB"
    status: str

    yookassa_payment_id: Optional[str] = None
    yookassa_status: Optional[str] = None

    description: Optional[str] = None
    description_ru: Optional[str] = None

    receipt_url: Optional[str] = None

    extra_metadata: Optional[dict] = None

    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Plan Subscriber Info
####################


class PlanSubscriberInfo(BaseModel):
    """Extended subscriber info with user data and usage"""

    subscription_id: str
    user_id: str
    user_name: str
    user_email: str
    user_role: str
    user_profile_image_url: Optional[str] = None
    plan_id: str
    status: str
    current_period_start: int
    current_period_end: int
    created_at: int
    # Usage data
    tokens_input_used: int = 0
    tokens_input_limit: Optional[int] = None
    tokens_output_used: int = 0
    tokens_output_limit: Optional[int] = None
    requests_used: int = 0
    requests_limit: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
