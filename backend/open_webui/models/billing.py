import time
import uuid
from typing import Optional, List
from enum import Enum

from open_webui.internal.db import Base, JSONField, get_db

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
    price = Column(Numeric(10, 2), nullable=False)  # Цена в рублях
    currency = Column(String, default="RUB", nullable=False)
    interval = Column(String, nullable=False)  # "month", "year"

    # Quotas
    quotas = Column(JSON, nullable=True)  # {"tokens_input": 1000000, "tokens_output": 500000}
    features = Column(JSON, nullable=True)  # ["gpt4", "claude", "api_access"]

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    metadata = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class PlanModel(BaseModel):
    id: str
    name: str
    name_ru: Optional[str] = None
    description: Optional[str] = None
    description_ru: Optional[str] = None

    price: float
    currency: str = "RUB"
    interval: str

    quotas: Optional[dict] = None
    features: Optional[List[str]] = None

    is_active: bool = True
    display_order: int = 0
    metadata: Optional[dict] = None

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
    trial_end = Column(BigInteger, nullable=True)

    # Metadata
    metadata = Column(JSON, nullable=True)

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
    trial_end: Optional[int] = None

    metadata: Optional[dict] = None

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
    metadata = Column(JSON, nullable=True)  # Additional context

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
    metadata: Optional[dict] = None

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
    metadata = Column(JSON, nullable=True)

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

    metadata: Optional[dict] = None

    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Table Operations
####################


class PlansTable:
    def __init__(self, db=None):
        self.db = db

    def get_all_plans(self, active_only: bool = True) -> List[PlanModel]:
        """Get all plans"""
        with get_db() as db:
            query = db.query(Plan)
            if active_only:
                query = query.filter(Plan.is_active == True)
            plans = query.order_by(Plan.display_order).all()
            return [PlanModel.model_validate(plan) for plan in plans]

    def get_plan_by_id(self, plan_id: str) -> Optional[PlanModel]:
        """Get plan by ID"""
        with get_db() as db:
            plan = db.query(Plan).filter(Plan.id == plan_id).first()
            return PlanModel.model_validate(plan) if plan else None

    def create_plan(self, plan_data: dict) -> PlanModel:
        """Create new plan"""
        with get_db() as db:
            result = Plan(**plan_data)
            db.add(result)
            db.commit()
            db.refresh(result)
            return PlanModel.model_validate(result)

    def update_plan_by_id(self, plan_id: str, updates: dict) -> Optional[PlanModel]:
        """Update plan by ID"""
        with get_db() as db:
            plan = db.query(Plan).filter(Plan.id == plan_id).first()
            if not plan:
                return None

            for key, value in updates.items():
                setattr(plan, key, value)

            db.commit()
            db.refresh(plan)
            return PlanModel.model_validate(plan)

    def delete_plan_by_id(self, plan_id: str) -> bool:
        """Delete plan by ID"""
        with get_db() as db:
            plan = db.query(Plan).filter(Plan.id == plan_id).first()
            if not plan:
                return False

            db.delete(plan)
            db.commit()
            return True


class SubscriptionsTable:
    def __init__(self, db=None):
        self.db = db

    def get_subscription_by_user_id(self, user_id: str) -> Optional[SubscriptionModel]:
        """Get active subscription for user"""
        with get_db() as db:
            subscription = (
                db.query(Subscription)
                .filter(
                    Subscription.user_id == user_id,
                    Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
                )
                .first()
            )
            return SubscriptionModel.model_validate(subscription) if subscription else None

    def get_subscription_by_id(self, subscription_id: str) -> Optional[SubscriptionModel]:
        """Get subscription by ID"""
        with get_db() as db:
            subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
            return SubscriptionModel.model_validate(subscription) if subscription else None

    def create_subscription(self, subscription: SubscriptionModel) -> SubscriptionModel:
        """Create new subscription"""
        with get_db() as db:
            result = Subscription(**subscription.model_dump())
            db.add(result)
            db.commit()
            db.refresh(result)
            return SubscriptionModel.model_validate(result)

    def update_subscription(
        self, subscription_id: str, updates: dict
    ) -> Optional[SubscriptionModel]:
        """Update subscription"""
        with get_db() as db:
            subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
            if not subscription:
                return None

            for key, value in updates.items():
                setattr(subscription, key, value)

            subscription.updated_at = int(time.time())
            db.commit()
            db.refresh(subscription)
            return SubscriptionModel.model_validate(subscription)

    def get_subscriptions_by_plan(
        self, plan_id: str, status: Optional[str] = None
    ) -> List[SubscriptionModel]:
        """Get all subscriptions for a specific plan"""
        with get_db() as db:
            query = db.query(Subscription).filter(Subscription.plan_id == plan_id)

            if status:
                query = query.filter(Subscription.status == status)

            subscriptions = query.order_by(Subscription.created_at.desc()).all()
            return [SubscriptionModel.model_validate(sub) for sub in subscriptions]


class UsageTable:
    def __init__(self, db=None):
        self.db = db

    def track_usage(self, usage: UsageModel) -> UsageModel:
        """Track usage"""
        with get_db() as db:
            result = Usage(**usage.model_dump())
            db.add(result)
            db.commit()
            db.refresh(result)
            return UsageModel.model_validate(result)

    def get_usage_for_period(
        self, user_id: str, period_start: int, period_end: int, metric: Optional[str] = None
    ) -> List[UsageModel]:
        """Get usage for a specific period"""
        with get_db() as db:
            query = db.query(Usage).filter(
                Usage.user_id == user_id,
                Usage.period_start >= period_start,
                Usage.period_end <= period_end
            )

            if metric:
                query = query.filter(Usage.metric == metric)

            usages = query.all()
            return [UsageModel.model_validate(usage) for usage in usages]

    def get_total_usage(
        self, user_id: str, period_start: int, period_end: int, metric: str
    ) -> int:
        """Get total usage for a metric in a period"""
        with get_db() as db:
            from sqlalchemy import func

            total = (
                db.query(func.sum(Usage.amount))
                .filter(
                    Usage.user_id == user_id,
                    Usage.metric == metric,
                    Usage.created_at >= period_start,
                    Usage.created_at <= period_end
                )
                .scalar()
            )
            return int(total) if total else 0


class TransactionsTable:
    def __init__(self, db=None):
        self.db = db

    def create_transaction(self, transaction: TransactionModel) -> TransactionModel:
        """Create new transaction"""
        with get_db() as db:
            result = Transaction(**transaction.model_dump())
            db.add(result)
            db.commit()
            db.refresh(result)
            return TransactionModel.model_validate(result)

    def get_transaction_by_id(self, transaction_id: str) -> Optional[TransactionModel]:
        """Get transaction by ID"""
        with get_db() as db:
            transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
            return TransactionModel.model_validate(transaction) if transaction else None

    def get_transactions_by_user(
        self, user_id: str, limit: int = 50, skip: int = 0
    ) -> List[TransactionModel]:
        """Get user's transactions"""
        with get_db() as db:
            transactions = (
                db.query(Transaction)
                .filter(Transaction.user_id == user_id)
                .order_by(Transaction.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
            return [TransactionModel.model_validate(tx) for tx in transactions]

    def update_transaction(
        self, transaction_id: str, updates: dict
    ) -> Optional[TransactionModel]:
        """Update transaction"""
        with get_db() as db:
            transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
            if not transaction:
                return None

            for key, value in updates.items():
                setattr(transaction, key, value)

            transaction.updated_at = int(time.time())
            db.commit()
            db.refresh(transaction)
            return TransactionModel.model_validate(transaction)


####################
# Singleton Instances
####################

Plans = PlansTable()
Subscriptions = SubscriptionsTable()
UsageTracking = UsageTable()
Transactions = TransactionsTable()
