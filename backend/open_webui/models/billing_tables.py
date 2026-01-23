import time
import uuid
from typing import Dict, List, Optional

from open_webui.internal.db import get_db
from open_webui.models.billing_models import (
    Plan,
    PlanModel,
    PlanSubscriberInfo,
    Subscription,
    SubscriptionModel,
    SubscriptionStatus,
    Transaction,
    TransactionModel,
    Usage,
    UsageMetric,
    UsageModel,
)


PlanUpdates = Dict[str, object]
SubscriptionUpdates = Dict[str, object]


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

    def create_plan(self, plan_data: PlanUpdates) -> PlanModel:
        """Create new plan"""
        with get_db() as db:
            result = Plan(**plan_data)
            db.add(result)
            db.commit()
            db.refresh(result)
            return PlanModel.model_validate(result)

    def update_plan_by_id(self, plan_id: str, updates: PlanUpdates) -> Optional[PlanModel]:
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
                    Subscription.status.in_(
                        [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
                    ),
                )
                .first()
            )
            return SubscriptionModel.model_validate(subscription) if subscription else None

    def get_subscription_by_id(self, subscription_id: str) -> Optional[SubscriptionModel]:
        """Get subscription by ID"""
        with get_db() as db:
            subscription = (
                db.query(Subscription).filter(Subscription.id == subscription_id).first()
            )
            return SubscriptionModel.model_validate(subscription) if subscription else None

    def get_latest_subscription_by_user_id(
        self, user_id: str
    ) -> Optional[SubscriptionModel]:
        """Get latest subscription for user regardless of status"""
        with get_db() as db:
            subscription = (
                db.query(Subscription)
                .filter(Subscription.user_id == user_id)
                .order_by(Subscription.created_at.desc())
                .first()
            )
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
        self, subscription_id: str, updates: SubscriptionUpdates
    ) -> Optional[SubscriptionModel]:
        """Update subscription"""
        with get_db() as db:
            subscription = (
                db.query(Subscription).filter(Subscription.id == subscription_id).first()
            )
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

    def get_plan_subscribers_with_usage(
        self, plan_id: str, status: Optional[str] = None, skip: int = 0, limit: int = 50
    ) -> Dict[str, object]:
        """
        Get all subscribers of a plan with their usage data.
        Returns dict with 'subscribers' list and 'total' count.
        """
        from open_webui.models.users import User
        from sqlalchemy import func

        with get_db() as db:
            # Get plan for quotas
            plan = db.query(Plan).filter(Plan.id == plan_id).first()
            if not plan:
                return {"subscribers": [], "total": 0}

            quotas = plan.quotas or {}

            # Base query for subscriptions with user join
            query = (
                db.query(Subscription, User)
                .join(User, Subscription.user_id == User.id)
                .filter(Subscription.plan_id == plan_id)
            )

            if status:
                query = query.filter(Subscription.status == status)
            else:
                # Default: only active subscriptions
                query = query.filter(
                    Subscription.status.in_(
                        [
                            SubscriptionStatus.ACTIVE.value,
                            SubscriptionStatus.TRIALING.value,
                        ]
                    )
                )

            # Get total count
            total = query.count()

            # Apply pagination
            results = (
                query.order_by(Subscription.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

            subscribers: List[PlanSubscriberInfo] = []
            for sub, user in results:
                # Get usage for current period
                tokens_input_used = 0
                tokens_output_used = 0
                requests_used = 0

                # Query usage for this user in current period
                usage_query = (
                    db.query(Usage.metric, func.sum(Usage.amount).label("total"))
                    .filter(
                        Usage.user_id == user.id,
                        Usage.created_at >= sub.current_period_start,
                        Usage.created_at <= sub.current_period_end,
                    )
                    .group_by(Usage.metric)
                )

                for usage_row in usage_query.all():
                    if usage_row.metric == UsageMetric.TOKENS_INPUT.value:
                        tokens_input_used = int(usage_row.total or 0)
                    elif usage_row.metric == UsageMetric.TOKENS_OUTPUT.value:
                        tokens_output_used = int(usage_row.total or 0)
                    elif usage_row.metric == UsageMetric.REQUESTS.value:
                        requests_used = int(usage_row.total or 0)

                subscriber_info = PlanSubscriberInfo(
                    subscription_id=sub.id,
                    user_id=user.id,
                    user_name=user.name,
                    user_email=user.email,
                    user_role=user.role,
                    user_profile_image_url=user.profile_image_url,
                    plan_id=sub.plan_id,
                    status=sub.status,
                    current_period_start=sub.current_period_start,
                    current_period_end=sub.current_period_end,
                    created_at=sub.created_at,
                    tokens_input_used=tokens_input_used,
                    tokens_input_limit=quotas.get("tokens_input"),
                    tokens_output_used=tokens_output_used,
                    tokens_output_limit=quotas.get("tokens_output"),
                    requests_used=requests_used,
                    requests_limit=quotas.get("requests"),
                )
                subscribers.append(subscriber_info)

            return {"subscribers": subscribers, "total": total}

    def get_all_subscriptions_with_plans(
        self, skip: int = 0, limit: int = 50
    ) -> List[Dict[str, object]]:
        """Get all active subscriptions with plan info for admin view"""
        with get_db() as db:
            results = (
                db.query(Subscription, Plan)
                .join(Plan, Subscription.plan_id == Plan.id)
                .filter(
                    Subscription.status.in_(
                        [
                            SubscriptionStatus.ACTIVE.value,
                            SubscriptionStatus.TRIALING.value,
                        ]
                    )
                )
                .order_by(Subscription.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

            return [
                {
                    "subscription": SubscriptionModel.model_validate(sub),
                    "plan": PlanModel.model_validate(plan),
                }
                for sub, plan in results
            ]

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
        self,
        user_id: str,
        period_start: int,
        period_end: int,
        metric: Optional[str] = None,
    ) -> List[UsageModel]:
        """Get usage for a specific period"""
        with get_db() as db:
            query = db.query(Usage).filter(
                Usage.user_id == user_id,
                Usage.period_start >= period_start,
                Usage.period_end <= period_end,
            )

            if metric:
                query = query.filter(Usage.metric == metric)

            usages = query.all()
            return [UsageModel.model_validate(usage) for usage in usages]

    def get_total_usage(
        self, user_id: str, period_start: int, period_end: int, metric: str
    ) -> int:
        """Get total usage for a metric in a period"""
        from sqlalchemy import func

        with get_db() as db:
            total = (
                db.query(func.sum(Usage.amount))
                .filter(
                    Usage.user_id == user_id,
                    Usage.metric == metric,
                    Usage.created_at >= period_start,
                    Usage.created_at <= period_end,
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
            transaction = (
                db.query(Transaction).filter(Transaction.id == transaction_id).first()
            )
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
        self, transaction_id: str, updates: Dict[str, object]
    ) -> Optional[TransactionModel]:
        """Update transaction"""
        with get_db() as db:
            transaction = (
                db.query(Transaction).filter(Transaction.id == transaction_id).first()
            )
            if not transaction:
                return None

            for key, value in updates.items():
                setattr(transaction, key, value)

            transaction.updated_at = int(time.time())
            db.commit()
            db.refresh(transaction)
            return TransactionModel.model_validate(transaction)


Plans = PlansTable()
Subscriptions = SubscriptionsTable()
UsageTracking = UsageTable()
Transactions = TransactionsTable()
