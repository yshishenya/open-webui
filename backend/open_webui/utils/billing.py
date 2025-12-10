"""
Billing business logic
Handles subscriptions, quotas, usage tracking, and payment processing
"""

import time
import uuid
import logging
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime, timedelta

from open_webui.models.billing import (
    Plans,
    Subscriptions,
    UsageTracking,
    Transactions,
    PlanModel,
    SubscriptionModel,
    UsageModel,
    TransactionModel,
    SubscriptionStatus,
    TransactionStatus,
    UsageMetric,
)
from open_webui.utils.yookassa import YooKassaClient, get_yookassa_client
from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))


class QuotaExceededError(Exception):
    """Raised when user exceeds their quota"""

    pass


class BillingService:
    """Billing service for managing subscriptions and usage"""

    def __init__(self):
        self.plans = Plans
        self.subscriptions = Subscriptions
        self.usage_tracking = UsageTracking
        self.transactions = Transactions

    # ==================== Plan Management ====================

    def get_active_plans(self) -> List[PlanModel]:
        """Get all active subscription plans"""
        return self.plans.get_all_plans(active_only=True)

    def get_plan(self, plan_id: str) -> Optional[PlanModel]:
        """Get plan by ID"""
        return self.plans.get_plan_by_id(plan_id)

    def create_plan(
        self,
        name: str,
        price: float,
        interval: str,
        quotas: Optional[Dict[str, int]] = None,
        features: Optional[List[str]] = None,
        **kwargs,
    ) -> PlanModel:
        """Create a new subscription plan"""
        now = int(time.time())

        plan = PlanModel(
            id=str(uuid.uuid4()),
            name=name,
            price=price,
            interval=interval,
            quotas=quotas or {},
            features=features or [],
            created_at=now,
            updated_at=now,
            **kwargs,
        )

        return self.plans.create_plan(plan)

    # ==================== Subscription Management ====================

    def get_user_subscription(self, user_id: str) -> Optional[SubscriptionModel]:
        """Get user's active subscription"""
        return self.subscriptions.get_subscription_by_user_id(user_id)

    def has_active_subscription(self, user_id: str) -> bool:
        """Check if user has an active subscription"""
        subscription = self.get_user_subscription(user_id)
        if not subscription:
            return False

        # Check if subscription is active and not expired
        return subscription.status in [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
        ] and subscription.current_period_end > int(time.time())

    def create_subscription(
        self,
        user_id: str,
        plan_id: str,
        trial_days: Optional[int] = None,
    ) -> SubscriptionModel:
        """
        Create a new subscription for user

        Args:
            user_id: User ID
            plan_id: Plan ID
            trial_days: Optional trial period in days

        Returns:
            Created subscription
        """
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

        now = int(time.time())

        # Calculate period
        if plan.interval == "month":
            period_end = now + (30 * 24 * 60 * 60)  # 30 days
        elif plan.interval == "year":
            period_end = now + (365 * 24 * 60 * 60)  # 365 days
        else:
            raise ValueError(f"Invalid interval: {plan.interval}")

        # Set trial if provided
        trial_end = None
        status = SubscriptionStatus.ACTIVE
        if trial_days and trial_days > 0:
            trial_end = now + (trial_days * 24 * 60 * 60)
            status = SubscriptionStatus.TRIALING

        subscription = SubscriptionModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            plan_id=plan_id,
            status=status,
            current_period_start=now,
            current_period_end=period_end,
            trial_end=trial_end,
            created_at=now,
            updated_at=now,
        )

        created = self.subscriptions.create_subscription(subscription)
        log.info(f"Created subscription {created.id} for user {user_id}")
        return created

    def cancel_subscription(
        self, subscription_id: str, immediate: bool = False
    ) -> Optional[SubscriptionModel]:
        """
        Cancel subscription

        Args:
            subscription_id: Subscription ID
            immediate: If True, cancel immediately. Otherwise, cancel at period end.

        Returns:
            Updated subscription
        """
        updates = {}

        if immediate:
            updates["status"] = SubscriptionStatus.CANCELED
            updates["current_period_end"] = int(time.time())
        else:
            updates["cancel_at_period_end"] = True

        updated = self.subscriptions.update_subscription(subscription_id, updates)

        if updated:
            log.info(
                f"Canceled subscription {subscription_id} (immediate={immediate})"
            )

        return updated

    def renew_subscription(self, subscription_id: str) -> Optional[SubscriptionModel]:
        """
        Renew subscription for next period

        Args:
            subscription_id: Subscription ID

        Returns:
            Updated subscription
        """
        subscription = self.subscriptions.get_subscription_by_id(subscription_id)
        if not subscription:
            return None

        plan = self.get_plan(subscription.plan_id)
        if not plan:
            return None

        now = int(time.time())

        # Calculate new period
        if plan.interval == "month":
            new_period_end = subscription.current_period_end + (30 * 24 * 60 * 60)
        elif plan.interval == "year":
            new_period_end = subscription.current_period_end + (365 * 24 * 60 * 60)
        else:
            return None

        updates = {
            "current_period_start": subscription.current_period_end,
            "current_period_end": new_period_end,
            "status": SubscriptionStatus.ACTIVE,
            "cancel_at_period_end": False,
        }

        updated = self.subscriptions.update_subscription(subscription_id, updates)
        log.info(f"Renewed subscription {subscription_id}")
        return updated

    # ==================== Usage Tracking ====================

    def track_usage(
        self,
        user_id: str,
        metric: UsageMetric,
        amount: int,
        model_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UsageModel:
        """
        Track user usage

        Args:
            user_id: User ID
            metric: Usage metric (tokens_input, tokens_output, etc.)
            amount: Amount to track
            model_id: AI model ID (optional)
            chat_id: Chat ID (optional)
            metadata: Additional metadata (optional)

        Returns:
            Created usage record
        """
        now = int(time.time())
        subscription = self.get_user_subscription(user_id)

        usage = UsageModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            subscription_id=subscription.id if subscription else None,
            metric=metric,
            amount=amount,
            period_start=now,
            period_end=now,
            model_id=model_id,
            chat_id=chat_id,
            metadata=metadata,
            created_at=now,
        )

        created = self.usage_tracking.track_usage(usage)
        log.debug(f"Tracked {amount} {metric} for user {user_id}")
        return created

    def get_usage_for_period(
        self,
        user_id: str,
        period_start: int,
        period_end: int,
        metric: Optional[UsageMetric] = None,
    ) -> List[UsageModel]:
        """Get usage records for a period"""
        return self.usage_tracking.get_usage_for_period(
            user_id, period_start, period_end, metric
        )

    def get_current_period_usage(
        self, user_id: str, metric: UsageMetric
    ) -> int:
        """
        Get total usage for current billing period

        Args:
            user_id: User ID
            metric: Usage metric

        Returns:
            Total usage amount
        """
        subscription = self.get_user_subscription(user_id)

        if subscription:
            period_start = subscription.current_period_start
            period_end = subscription.current_period_end
        else:
            # If no subscription, use current month
            now = int(time.time())
            period_start = now - (30 * 24 * 60 * 60)
            period_end = now

        return self.usage_tracking.get_total_usage(
            user_id, period_start, period_end, metric
        )

    def check_quota(
        self, user_id: str, metric: UsageMetric, amount: int = 1
    ) -> bool:
        """
        Check if user can use specified amount without exceeding quota

        Args:
            user_id: User ID
            metric: Usage metric
            amount: Amount to check

        Returns:
            True if within quota, False otherwise
        """
        subscription = self.get_user_subscription(user_id)

        if not subscription:
            # No subscription = no quota = unlimited (or blocked, depending on your policy)
            log.debug(f"User {user_id} has no subscription, allowing usage")
            return True

        plan = self.get_plan(subscription.plan_id)
        if not plan or not plan.quotas:
            # No plan or no quotas = unlimited
            return True

        quota_limit = plan.quotas.get(metric)
        if quota_limit is None:
            # No limit for this metric = unlimited
            return True

        current_usage = self.get_current_period_usage(user_id, metric)
        would_exceed = (current_usage + amount) > quota_limit

        if would_exceed:
            log.warning(
                f"User {user_id} would exceed {metric} quota: "
                f"{current_usage + amount} > {quota_limit}"
            )

        return not would_exceed

    def enforce_quota(
        self, user_id: str, metric: UsageMetric, amount: int = 1
    ) -> None:
        """
        Enforce quota limit - raises exception if exceeded

        Args:
            user_id: User ID
            metric: Usage metric
            amount: Amount to check

        Raises:
            QuotaExceededError: If quota would be exceeded
        """
        if not self.check_quota(user_id, metric, amount):
            raise QuotaExceededError(
                f"Quota exceeded for {metric}. Please upgrade your plan."
            )

    # ==================== Payment Processing ====================

    async def create_payment(
        self,
        user_id: str,
        plan_id: str,
        return_url: str,
    ) -> Dict[str, Any]:
        """
        Create payment for subscription

        Args:
            user_id: User ID
            plan_id: Plan ID to subscribe to
            return_url: URL to redirect after payment

        Returns:
            Payment data with confirmation URL
        """
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

        yookassa = get_yookassa_client()
        if not yookassa:
            raise RuntimeError("YooKassa client not initialized")

        # Create transaction record
        transaction = TransactionModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            amount=plan.price,
            currency=plan.currency,
            status=TransactionStatus.PENDING,
            description=f"Subscription: {plan.name}",
            description_ru=f"Подписка: {plan.name_ru or plan.name}",
            metadata={"plan_id": plan_id},
            created_at=int(time.time()),
            updated_at=int(time.time()),
        )

        created_transaction = self.transactions.create_transaction(transaction)

        # Create payment via YooKassa
        payment = await yookassa.create_payment(
            amount=Decimal(str(plan.price)),
            currency=plan.currency,
            description=transaction.description,
            return_url=return_url,
            metadata={
                "user_id": user_id,
                "plan_id": plan_id,
                "transaction_id": created_transaction.id,
            },
        )

        # Update transaction with YooKassa payment ID
        self.transactions.update_transaction(
            created_transaction.id,
            {
                "yookassa_payment_id": payment["id"],
                "yookassa_status": payment["status"],
            },
        )

        log.info(
            f"Created payment {payment['id']} for user {user_id}, plan {plan_id}"
        )

        return {
            "transaction_id": created_transaction.id,
            "payment_id": payment["id"],
            "confirmation_url": payment["confirmation"]["confirmation_url"],
            "status": payment["status"],
        }

    async def process_payment_webhook(
        self, webhook_data: Dict[str, Any]
    ) -> Optional[SubscriptionModel]:
        """
        Process payment webhook from YooKassa

        Args:
            webhook_data: Parsed webhook data

        Returns:
            Created/updated subscription if payment succeeded
        """
        event_type = webhook_data.get("event_type")
        payment_id = webhook_data.get("payment_id")
        metadata = webhook_data.get("metadata", {})

        log.info(f"Processing webhook: {event_type} for payment {payment_id}")

        # Find transaction
        transaction_id = metadata.get("transaction_id")
        if not transaction_id:
            log.error("Transaction ID not found in webhook metadata")
            return None

        transaction = self.transactions.get_transaction_by_id(transaction_id)
        if not transaction:
            log.error(f"Transaction {transaction_id} not found")
            return None

        # Update transaction status
        if event_type == "payment.succeeded":
            self.transactions.update_transaction(
                transaction_id,
                {
                    "status": TransactionStatus.SUCCEEDED,
                    "yookassa_status": webhook_data.get("status"),
                },
            )

            # Create or renew subscription
            user_id = metadata.get("user_id")
            plan_id = metadata.get("plan_id")

            if not user_id or not plan_id:
                log.error("User ID or Plan ID not found in webhook metadata")
                return None

            # Check if user already has a subscription
            existing_subscription = self.get_user_subscription(user_id)

            if existing_subscription:
                # Renew existing subscription
                return self.renew_subscription(existing_subscription.id)
            else:
                # Create new subscription
                return self.create_subscription(user_id, plan_id)

        elif event_type == "payment.canceled":
            self.transactions.update_transaction(
                transaction_id,
                {
                    "status": TransactionStatus.CANCELED,
                    "yookassa_status": webhook_data.get("status"),
                },
            )

        elif event_type == "payment.waiting_for_capture":
            # Payment authorized but not captured yet
            self.transactions.update_transaction(
                transaction_id,
                {
                    "yookassa_status": webhook_data.get("status"),
                },
            )

        return None

    # ==================== Utility Methods ====================

    def get_user_billing_info(self, user_id: str) -> Dict[str, Any]:
        """
        Get complete billing information for user

        Args:
            user_id: User ID

        Returns:
            Dictionary with subscription, usage, and transaction info
        """
        subscription = self.get_user_subscription(user_id)
        plan = None
        usage = {}

        if subscription:
            plan = self.get_plan(subscription.plan_id)

            # Get usage for all metrics
            for metric in UsageMetric:
                usage[metric.value] = {
                    "current": self.get_current_period_usage(user_id, metric),
                    "limit": (
                        plan.quotas.get(metric.value) if plan and plan.quotas else None
                    ),
                }

        # Get recent transactions
        transactions = self.transactions.get_transactions_by_user(user_id, limit=10)

        return {
            "subscription": subscription.model_dump() if subscription else None,
            "plan": plan.model_dump() if plan else None,
            "usage": usage,
            "transactions": [tx.model_dump() for tx in transactions],
        }


# Global billing service instance
billing_service = BillingService()
