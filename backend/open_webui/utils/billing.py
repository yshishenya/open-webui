"""
Billing business logic
Handles subscriptions, quotas, usage tracking, and payment processing
"""

import time
import uuid
import logging
from dataclasses import dataclass
from typing import Optional, Dict, List
from decimal import Decimal

from open_webui.models.users import Users
from open_webui.models.billing import (
    Plans,
    Subscriptions,
    UsageTracking,
    Transactions,
    Payments,
    PlanModel,
    PaymentKind,
    PaymentModel,
    PaymentStatus,
    SubscriptionModel,
    UsageModel,
    TransactionModel,
    SubscriptionStatus,
    TransactionStatus,
    UsageMetric,
    WalletModel,
    Wallets,
)
from open_webui.utils.yookassa import get_yookassa_client
from open_webui.env import (
    BILLING_DEFAULT_CURRENCY,
    BILLING_RECEIPT_ENABLED,
    BILLING_RECEIPT_PAYMENT_MODE,
    BILLING_RECEIPT_PAYMENT_SUBJECT,
    BILLING_RECEIPT_TAX_SYSTEM_CODE,
    BILLING_RECEIPT_VAT_CODE,
    BILLING_TOPUP_PACKAGES_KOPEKS,
    BILLING_TOPUP_TTL_DAYS,
    SRC_LOG_LEVELS,
)
from open_webui.models.billing_wallet import JsonDict
from open_webui.utils.wallet import wallet_service
from open_webui.utils.lead_magnet import (
    calculate_remaining,
    get_lead_magnet_config,
    get_lead_magnet_state,
)

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

AUTO_TOPUP_MAX_FAILURES = 3


class QuotaExceededError(Exception):
    """Raised when user exceeds their quota"""

    pass


class WebhookVerificationError(Exception):
    """Non-retryable webhook validation error."""


class WebhookRetryableError(Exception):
    """Retryable webhook processing error (provider should retry)."""


@dataclass(frozen=True)
class AutoTopupResult:
    attempted: bool
    status: str
    payment_id: Optional[str] = None
    message: Optional[str] = None


class BillingService:
    """Billing service for managing subscriptions and usage"""

    def __init__(self):
        self.plans = Plans
        self.subscriptions = Subscriptions
        self.usage_tracking = UsageTracking
        self.transactions = Transactions
        self.payments = Payments
        self.wallets = Wallets

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
            log.info(f"Canceled subscription {subscription_id} (immediate={immediate})")

        return updated

    def resume_subscription(self, subscription_id: str) -> Optional[SubscriptionModel]:
        """
        Resume a subscription that was set to cancel at period end.

        Args:
            subscription_id: Subscription ID

        Returns:
            Updated subscription
        """
        updated = self.subscriptions.update_subscription(
            subscription_id, {"cancel_at_period_end": False}
        )

        if updated:
            log.info(f"Resumed subscription {subscription_id}")

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

        base_start = max(int(subscription.current_period_end), now)

        # Calculate new period
        if plan.interval == "month":
            new_period_end = base_start + (30 * 24 * 60 * 60)
        elif plan.interval == "year":
            new_period_end = base_start + (365 * 24 * 60 * 60)
        else:
            return None

        updates = {
            "current_period_start": base_start,
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
        metadata: Optional[Dict[str, object]] = None,
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
        period_start = subscription.current_period_start if subscription else now
        period_end = subscription.current_period_end if subscription else now

        usage = UsageModel(
            id=str(uuid.uuid4()),
            user_id=user_id,
            subscription_id=subscription.id if subscription else None,
            metric=metric,
            amount=amount,
            period_start=period_start,
            period_end=period_end,
            model_id=model_id,
            chat_id=chat_id,
            extra_metadata=metadata,
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

    def get_current_period_usage(self, user_id: str, metric: UsageMetric) -> int:
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

    def check_quota(self, user_id: str, metric: UsageMetric, amount: int = 1) -> bool:
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

        quota_limit = plan.quotas.get(metric.value)
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

    def enforce_quota(self, user_id: str, metric: UsageMetric, amount: int = 1) -> None:
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

    @staticmethod
    def _clean_contact(value: object) -> Optional[str]:
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        return cleaned if cleaned else None

    def _resolve_receipt_customer(self, user_id: str) -> Dict[str, str]:
        user = Users.get_user_by_id(user_id)
        if not user:
            log.warning("Unable to load user for receipt generation: %s", user_id)
            raise ValueError(
                "Set billing contact email or phone in billing settings to issue a payment receipt"
            )

        user_info = user.info if isinstance(user.info, dict) else {}

        contact_email = self._clean_contact(user_info.get("billing_contact_email"))
        if not contact_email:
            contact_email = self._clean_contact(user.email)

        contact_phone = self._clean_contact(user_info.get("billing_contact_phone"))

        customer: Dict[str, str] = {}
        if contact_email:
            customer["email"] = contact_email
        if contact_phone:
            customer["phone"] = contact_phone

        if customer:
            return customer

        raise ValueError(
            "Set billing contact email or phone in billing settings to issue a payment receipt"
        )

    def _build_receipt(
        self,
        user_id: str,
        amount: Decimal,
        currency: str,
        description: str,
    ) -> Optional[Dict[str, object]]:
        if not BILLING_RECEIPT_ENABLED:
            return None

        receipt_description = description.strip() or "AIris payment"
        receipt_description = receipt_description[:128]
        rounded_amount = amount.quantize(Decimal("0.01"))

        receipt_item: Dict[str, object] = {
            "description": receipt_description,
            "quantity": "1.00",
            "amount": {
                "value": str(rounded_amount),
                "currency": currency,
            },
            "vat_code": BILLING_RECEIPT_VAT_CODE,
            "payment_mode": BILLING_RECEIPT_PAYMENT_MODE,
            "payment_subject": BILLING_RECEIPT_PAYMENT_SUBJECT,
        }

        receipt: Dict[str, object] = {
            "customer": self._resolve_receipt_customer(user_id),
            "items": [receipt_item],
        }

        if BILLING_RECEIPT_TAX_SYSTEM_CODE is not None:
            receipt["tax_system_code"] = BILLING_RECEIPT_TAX_SYSTEM_CODE

        return receipt

    # ==================== Payment Processing ====================

    async def create_payment(
        self,
        user_id: str,
        plan_id: str,
        return_url: str,
    ) -> Dict[str, object]:
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
        payment_amount = Decimal(str(plan.price))
        receipt = self._build_receipt(
            user_id=user_id,
            amount=payment_amount,
            currency=plan.currency,
            description=transaction.description or f"Subscription: {plan.name}",
        )

        # Create payment via YooKassa
        payment = await yookassa.create_payment(
            amount=payment_amount,
            currency=plan.currency,
            description=transaction.description,
            return_url=return_url,
            metadata={
                "user_id": user_id,
                "plan_id": plan_id,
                "transaction_id": created_transaction.id,
            },
            receipt=receipt,
        )

        # Update transaction with YooKassa payment ID
        self.transactions.update_transaction(
            created_transaction.id,
            {
                "yookassa_payment_id": payment["id"],
                "yookassa_status": payment["status"],
            },
        )

        log.info(f"Created payment {payment['id']} for user {user_id}, plan {plan_id}")

        return {
            "transaction_id": created_transaction.id,
            "payment_id": payment["id"],
            "confirmation_url": payment["confirmation"]["confirmation_url"],
            "status": payment["status"],
        }

    async def create_topup_payment(
        self,
        user_id: str,
        wallet_id: str,
        amount_kopeks: int,
        return_url: str,
    ) -> Dict[str, object]:
        """
        Create topup payment for wallet.

        Args:
            user_id: User ID
            wallet_id: Wallet ID
            amount_kopeks: Amount in kopeks
            return_url: URL to redirect after payment

        Returns:
            Payment data with confirmation URL
        """
        if amount_kopeks <= 0:
            raise ValueError("Topup amount must be positive")
        if (
            BILLING_TOPUP_PACKAGES_KOPEKS
            and amount_kopeks not in BILLING_TOPUP_PACKAGES_KOPEKS
        ):
            raise ValueError("Invalid topup amount")

        save_payment_method = None
        wallet = self.wallets.get_wallet_by_id(wallet_id)
        if wallet and wallet.auto_topup_enabled:
            save_payment_method = True

        yookassa = get_yookassa_client()
        if not yookassa:
            raise RuntimeError("YooKassa client not initialized")

        amount_rub = (Decimal(amount_kopeks) / Decimal(100)).quantize(Decimal("0.01"))
        metadata: JsonDict = {
            "kind": PaymentKind.TOPUP.value,
            "user_id": user_id,
            "wallet_id": wallet_id,
            "amount_kopeks": amount_kopeks,
        }
        topup_description = (
            f"Top-up wallet {amount_rub} {BILLING_DEFAULT_CURRENCY}"
        )
        receipt = self._build_receipt(
            user_id=user_id,
            amount=amount_rub,
            currency=BILLING_DEFAULT_CURRENCY,
            description=topup_description,
        )

        payment = await yookassa.create_payment(
            amount=amount_rub,
            currency=BILLING_DEFAULT_CURRENCY,
            description=topup_description,
            return_url=return_url,
            metadata=metadata,
            receipt=receipt,
            save_payment_method=save_payment_method,
        )

        now = int(time.time())
        payment_method_id = None
        payment_method = payment.get("payment_method")
        if isinstance(payment_method, dict):
            payment_method_id = payment_method.get("id")

        payment_record = PaymentModel(
            id=str(uuid.uuid4()),
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=amount_kopeks,
            currency=BILLING_DEFAULT_CURRENCY,
            idempotency_key=str(uuid.uuid4()),
            provider_payment_id=payment.get("id"),
            payment_method_id=payment_method_id,
            status_details={"yookassa_status": payment.get("status")},
            metadata_json=metadata,
            raw_payload_json=self._sanitize_payment_payload(payment),
            user_id=user_id,
            wallet_id=wallet_id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        self.payments.create_payment(payment_record)

        return {
            "payment_id": payment["id"],
            "confirmation_url": payment["confirmation"]["confirmation_url"],
            "status": payment["status"],
        }

    def _is_auto_topup_metadata(self, metadata: Optional[JsonDict]) -> bool:
        if not metadata:
            return False
        auto_topup_value = metadata.get("auto_topup")
        if isinstance(auto_topup_value, bool):
            return auto_topup_value
        if isinstance(auto_topup_value, str):
            return auto_topup_value.lower() == "true"
        if isinstance(auto_topup_value, int):
            return auto_topup_value == 1
        return False

    def _has_pending_topup(self, wallet_id: str) -> bool:
        pending = self.payments.list_payments_by_wallet(
            wallet_id=wallet_id,
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            limit=5,
        )
        return len(pending) > 0

    def _get_latest_payment_method_id(self, wallet_id: str) -> Optional[str]:
        payment = self.payments.get_latest_payment_with_method(
            wallet_id=wallet_id,
            status=PaymentStatus.SUCCEEDED.value,
            kind=PaymentKind.TOPUP.value,
        )
        if not payment:
            return None
        return payment.payment_method_id

    def _record_auto_topup_failure(
        self, wallet_id: str, fail_count: int
    ) -> Optional[WalletModel]:
        now = int(time.time())
        next_count = fail_count + 1
        updates: Dict[str, object] = {
            "auto_topup_fail_count": next_count,
            "auto_topup_last_failed_at": now,
        }
        if next_count >= AUTO_TOPUP_MAX_FAILURES:
            updates["auto_topup_enabled"] = False
        return self.wallets.update_wallet(wallet_id, updates)

    def _reset_auto_topup_failures(self, wallet_id: str) -> Optional[WalletModel]:
        return self.wallets.update_wallet(
            wallet_id,
            {
                "auto_topup_fail_count": 0,
                "auto_topup_last_failed_at": None,
            },
        )

    async def create_auto_topup_payment(
        self,
        user_id: str,
        wallet_id: str,
        amount_kopeks: int,
        payment_method_id: str,
        reason: str,
    ) -> Dict[str, object]:
        """Create an auto-topup payment using a saved payment method."""
        if amount_kopeks <= 0:
            raise ValueError("Topup amount must be positive")
        if (
            BILLING_TOPUP_PACKAGES_KOPEKS
            and amount_kopeks not in BILLING_TOPUP_PACKAGES_KOPEKS
        ):
            raise ValueError("Invalid topup amount")

        yookassa = get_yookassa_client()
        if not yookassa:
            raise RuntimeError("YooKassa client not initialized")

        amount_rub = (Decimal(amount_kopeks) / Decimal(100)).quantize(Decimal("0.01"))
        metadata: JsonDict = {
            "kind": PaymentKind.TOPUP.value,
            "user_id": user_id,
            "wallet_id": wallet_id,
            "amount_kopeks": amount_kopeks,
            "auto_topup": True,
            "auto_topup_reason": reason,
        }
        auto_topup_description = (
            f"Auto top-up wallet {amount_rub} {BILLING_DEFAULT_CURRENCY}"
        )
        receipt = self._build_receipt(
            user_id=user_id,
            amount=amount_rub,
            currency=BILLING_DEFAULT_CURRENCY,
            description=auto_topup_description,
        )

        payment = await yookassa.create_payment(
            amount=amount_rub,
            currency=BILLING_DEFAULT_CURRENCY,
            description=auto_topup_description,
            metadata=metadata,
            receipt=receipt,
            payment_method_id=payment_method_id,
        )

        now = int(time.time())
        resolved_method_id = payment_method_id
        payment_method = payment.get("payment_method")
        if isinstance(payment_method, dict) and payment_method.get("id"):
            resolved_method_id = str(payment_method.get("id"))

        payment_record = PaymentModel(
            id=str(uuid.uuid4()),
            provider="yookassa",
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.TOPUP.value,
            amount_kopeks=amount_kopeks,
            currency=BILLING_DEFAULT_CURRENCY,
            idempotency_key=str(uuid.uuid4()),
            provider_payment_id=payment.get("id"),
            payment_method_id=resolved_method_id,
            status_details={"yookassa_status": payment.get("status")},
            metadata_json=metadata,
            raw_payload_json=self._sanitize_payment_payload(payment),
            user_id=user_id,
            wallet_id=wallet_id,
            subscription_id=None,
            created_at=now,
            updated_at=now,
        )
        self.payments.create_payment(payment_record)

        return {
            "payment_id": payment.get("id"),
            "status": payment.get("status"),
        }

    async def maybe_trigger_auto_topup(
        self,
        user_id: str,
        wallet_id: str,
        available_kopeks: int,
        required_kopeks: int,
        reason: str,
    ) -> AutoTopupResult:
        """Attempt auto-topup when balance drops below threshold."""
        wallet = self.wallets.get_wallet_by_id(wallet_id)
        if not wallet:
            return AutoTopupResult(attempted=False, status="wallet_missing")

        if not wallet.auto_topup_enabled:
            return AutoTopupResult(attempted=False, status="disabled")

        threshold = wallet.auto_topup_threshold_kopeks
        amount = wallet.auto_topup_amount_kopeks
        if threshold is None or amount is None:
            return AutoTopupResult(attempted=False, status="missing_config")

        if available_kopeks > threshold and available_kopeks >= required_kopeks:
            return AutoTopupResult(attempted=False, status="above_threshold")

        if wallet.auto_topup_fail_count >= AUTO_TOPUP_MAX_FAILURES:
            self.wallets.update_wallet(wallet_id, {"auto_topup_enabled": False})
            return AutoTopupResult(attempted=False, status="fail_limit")

        if self._has_pending_topup(wallet_id):
            return AutoTopupResult(attempted=False, status="pending")

        if (
            BILLING_TOPUP_PACKAGES_KOPEKS
            and amount not in BILLING_TOPUP_PACKAGES_KOPEKS
        ):
            return AutoTopupResult(attempted=False, status="invalid_amount")

        payment_method_id = self._get_latest_payment_method_id(wallet_id)
        if not payment_method_id:
            return AutoTopupResult(attempted=True, status="missing_payment_method")

        try:
            payment_data = await self.create_auto_topup_payment(
                user_id=user_id,
                wallet_id=wallet_id,
                amount_kopeks=amount,
                payment_method_id=payment_method_id,
                reason=reason,
            )
        except Exception as e:
            self._record_auto_topup_failure(wallet_id, wallet.auto_topup_fail_count)
            return AutoTopupResult(
                attempted=True,
                status="failed",
                message=str(e),
            )

        payment_id = payment_data.get("payment_id")
        return AutoTopupResult(
            attempted=True,
            status="created",
            payment_id=str(payment_id) if payment_id else None,
        )

    async def process_payment_webhook(
        self, webhook_data: Dict[str, object]
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
        if not isinstance(event_type, str) or not event_type:
            raise WebhookVerificationError("Missing event_type")
        if not isinstance(payment_id, str) or not payment_id:
            raise WebhookVerificationError("Missing payment_id")

        yookassa = get_yookassa_client()
        if not yookassa:
            raise WebhookRetryableError("YooKassa client not initialized")

        try:
            provider_payment = await yookassa.get_payment(payment_id)
        except Exception as e:
            raise WebhookRetryableError("Failed to fetch payment from provider") from e

        if not isinstance(provider_payment, dict):
            raise WebhookRetryableError("Provider payment payload invalid")

        provider_status = provider_payment.get("status")
        provider_paid = provider_payment.get("paid", False)
        amount_value = None
        currency_value = None
        amount_obj = provider_payment.get("amount")
        if isinstance(amount_obj, dict):
            amount_value = amount_obj.get("value")
            currency_value = amount_obj.get("currency")

        expected_status_map: Dict[str, str] = {
            "payment.succeeded": "succeeded",
            "payment.canceled": "canceled",
            "payment.waiting_for_capture": "waiting_for_capture",
        }
        expected_status = expected_status_map.get(event_type)
        if expected_status and provider_status != expected_status:
            raise WebhookRetryableError(
                f"Provider status mismatch (expected {expected_status}, got {provider_status})"
            )
        if event_type == "payment.succeeded" and provider_paid is not True:
            raise WebhookRetryableError("Provider payment not marked as paid")

        metadata_value = provider_payment.get(
            "metadata", webhook_data.get("metadata", {})
        )
        metadata = metadata_value if isinstance(metadata_value, dict) else {}

        log.info(f"Processing webhook: {event_type} for payment {payment_id}")

        kind = metadata.get("kind")
        if kind == PaymentKind.TOPUP.value:
            trusted_webhook_data = {
                **webhook_data,
                "payment_id": payment_id,
                "event_type": event_type,
                "status": provider_status,
                "amount": amount_value,
                "currency": currency_value,
                "metadata": metadata,
            }
            self._process_topup_webhook(event_type, payment_id, trusted_webhook_data)
            return None

        # Find transaction
        transaction_id = metadata.get("transaction_id")
        if not transaction_id:
            log.error("Transaction ID not found in webhook metadata")
            return None

        transaction = self.transactions.get_transaction_by_id(transaction_id)
        if not transaction:
            log.error(f"Transaction {transaction_id} not found")
            return None
        if (
            transaction.yookassa_payment_id
            and transaction.yookassa_payment_id != payment_id
        ):
            raise WebhookVerificationError("Payment ID does not match transaction")
        if transaction.status == TransactionStatus.SUCCEEDED:
            log.info(
                "Transaction %s already succeeded; ignoring duplicate webhook",
                transaction_id,
            )
            return None

        # Update transaction status
        if event_type == "payment.succeeded":
            self.transactions.update_transaction(
                transaction_id,
                {
                    "status": TransactionStatus.SUCCEEDED,
                    "yookassa_status": provider_status,
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
                    "yookassa_status": provider_status,
                },
            )

        elif event_type == "payment.waiting_for_capture":
            # Payment authorized but not captured yet
            self.transactions.update_transaction(
                transaction_id,
                {
                    "yookassa_status": provider_status,
                },
            )

        return None

    async def reconcile_topup_payment(
        self,
        user_id: str,
        payment_id: str,
    ) -> Dict[str, object]:
        """
        Reconcile a topup payment status directly with YooKassa.

        This is used as a fallback when webhook delivery is delayed or failed.
        """
        payment_id_clean = payment_id.strip()
        if not payment_id_clean:
            raise ValueError("payment_id is required")

        local_payment = self.payments.get_payment_by_provider_id(payment_id_clean)
        if local_payment and local_payment.user_id != user_id:
            raise PermissionError("Payment does not belong to the current user")

        yookassa = get_yookassa_client()
        if not yookassa:
            raise RuntimeError("YooKassa client not initialized")

        provider_payment = await yookassa.get_payment(payment_id_clean)
        if not isinstance(provider_payment, dict):
            raise RuntimeError("Provider payment payload invalid")

        provider_status_value = provider_payment.get("status")
        provider_status = (
            str(provider_status_value) if isinstance(provider_status_value, str) else ""
        )
        amount_obj = provider_payment.get("amount")
        amount_value = amount_obj.get("value") if isinstance(amount_obj, dict) else None
        currency_value = (
            amount_obj.get("currency") if isinstance(amount_obj, dict) else None
        )
        metadata_value = provider_payment.get("metadata", {})
        metadata = metadata_value if isinstance(metadata_value, dict) else {}
        effective_metadata: Dict[str, object] = dict(metadata)

        # YooKassa metadata can be missing/partial in some legacy/manual flows.
        # When we have a local payment record, treat it as authoritative for
        # ownership and wallet context to avoid applying topup to a stale/conflicting wallet.
        if local_payment:
            if local_payment.kind:
                effective_metadata["kind"] = local_payment.kind
            if local_payment.user_id:
                effective_metadata["user_id"] = local_payment.user_id
            if local_payment.wallet_id:
                effective_metadata["wallet_id"] = local_payment.wallet_id
            if local_payment.amount_kopeks is not None:
                effective_metadata["amount_kopeks"] = local_payment.amount_kopeks

        metadata_user_id_value = effective_metadata.get("user_id")
        metadata_user_id = (
            str(metadata_user_id_value)
            if isinstance(metadata_user_id_value, str)
            else None
        )
        ownership_verified = bool(local_payment and local_payment.user_id == user_id)
        if not ownership_verified and metadata_user_id == user_id:
            ownership_verified = True
        if not ownership_verified:
            raise PermissionError("Payment does not belong to the current user")

        event_by_status: Dict[str, str] = {
            "succeeded": "payment.succeeded",
            "canceled": "payment.canceled",
            "waiting_for_capture": "payment.waiting_for_capture",
        }
        event_type = event_by_status.get(provider_status)

        if event_type and effective_metadata.get("kind") == PaymentKind.TOPUP.value:
            trusted_webhook_data: Dict[str, object] = {
                "event_type": event_type,
                "payment_id": payment_id_clean,
                "status": provider_status,
                "amount": amount_value,
                "currency": currency_value,
                "metadata": effective_metadata,
            }
            self._process_topup_webhook(
                event_type=event_type,
                payment_id=payment_id_clean,
                webhook_data=trusted_webhook_data,
            )

        updated_payment = self.payments.get_payment_by_provider_id(payment_id_clean)
        if updated_payment and updated_payment.user_id != user_id:
            raise PermissionError("Payment does not belong to the current user")

        payment_status = updated_payment.status if updated_payment else None
        credited = payment_status == PaymentStatus.SUCCEEDED.value

        return {
            "payment_id": payment_id_clean,
            "provider_status": provider_status or None,
            "payment_status": payment_status,
            "credited": credited,
        }

    def _process_topup_webhook(
        self,
        event_type: Optional[str],
        payment_id: Optional[str],
        webhook_data: Dict[str, object],
    ) -> None:
        metadata = webhook_data.get("metadata", {})
        metadata_dict = metadata if isinstance(metadata, dict) else {}
        is_auto_topup = self._is_auto_topup_metadata(metadata_dict)
        if not payment_id:
            log.error("Topup webhook missing payment_id")
            return

        if event_type == "payment.succeeded":
            existing = self.payments.get_payment_by_provider_id(payment_id)
            if existing and existing.status == PaymentStatus.SUCCEEDED.value:
                log.info(
                    "Topup payment %s already succeeded; ignoring duplicate webhook",
                    payment_id,
                )
                return

        amount_kopeks = self._extract_amount_kopeks(
            metadata_dict, webhook_data.get("amount")
        )
        wallet_id = metadata_dict.get("wallet_id")
        user_id = metadata_dict.get("user_id")

        payment = self.payments.get_payment_by_provider_id(payment_id)
        if payment and not is_auto_topup:
            is_auto_topup = self._is_auto_topup_metadata(payment.metadata_json)
        if not payment and amount_kopeks and wallet_id and user_id:
            now = int(time.time())
            payment_record = PaymentModel(
                id=str(uuid.uuid4()),
                provider="yookassa",
                status=PaymentStatus.PENDING.value,
                kind=PaymentKind.TOPUP.value,
                amount_kopeks=amount_kopeks,
                currency=webhook_data.get("currency") or BILLING_DEFAULT_CURRENCY,
                idempotency_key=str(uuid.uuid4()),
                provider_payment_id=payment_id,
                payment_method_id=None,
                status_details={"yookassa_status": webhook_data.get("status")},
                metadata_json=metadata_dict,
                raw_payload_json=self._sanitize_webhook_payload(webhook_data),
                user_id=user_id,
                wallet_id=wallet_id,
                subscription_id=None,
                created_at=now,
                updated_at=now,
            )
            payment = self.payments.create_payment(payment_record)

        if not payment:
            log.error(f"Topup payment record not found for {payment_id}")
            return

        if not wallet_id:
            wallet_id = payment.wallet_id

        if event_type == "payment.succeeded":
            if not amount_kopeks:
                log.error(f"Topup webhook missing amount for {payment_id}")
                return
            if not wallet_id:
                log.error(f"Topup webhook missing wallet_id for {payment_id}")
                return

            expires_at = None
            if BILLING_TOPUP_TTL_DAYS > 0:
                expires_at = int(time.time()) + (BILLING_TOPUP_TTL_DAYS * 86400)

            try:
                wallet_service.apply_topup(
                    wallet_id=wallet_id,
                    amount_kopeks=amount_kopeks,
                    reference_id=payment_id,
                    reference_type="payment",
                    idempotency_key=payment.id,
                    expires_at=expires_at,
                    metadata={
                        "provider": "yookassa",
                        "payment_id": payment_id,
                    },
                )
            except Exception as e:
                log.exception(f"Failed to apply topup for payment {payment_id}: {e}")
                return

            if is_auto_topup:
                self._reset_auto_topup_failures(wallet_id)

            self.payments.update_payment_by_provider_id(
                payment_id,
                {
                    "status": PaymentStatus.SUCCEEDED.value,
                    "status_details": {"yookassa_status": webhook_data.get("status")},
                    "raw_payload_json": self._sanitize_webhook_payload(webhook_data),
                },
            )
            return

        if event_type == "payment.canceled":
            self.payments.update_payment_by_provider_id(
                payment_id,
                {
                    "status": PaymentStatus.CANCELED.value,
                    "status_details": {"yookassa_status": webhook_data.get("status")},
                    "raw_payload_json": self._sanitize_webhook_payload(webhook_data),
                },
            )
            if is_auto_topup and wallet_id:
                wallet = self.wallets.get_wallet_by_id(wallet_id)
                if wallet:
                    self._record_auto_topup_failure(
                        wallet_id, wallet.auto_topup_fail_count
                    )
            return

        if event_type == "payment.waiting_for_capture":
            self.payments.update_payment_by_provider_id(
                payment_id,
                {
                    "status": PaymentStatus.PENDING.value,
                    "status_details": {"yookassa_status": webhook_data.get("status")},
                    "raw_payload_json": self._sanitize_webhook_payload(webhook_data),
                },
            )

    def _extract_amount_kopeks(
        self, metadata: Dict[str, object], amount_value: Optional[str]
    ) -> Optional[int]:
        if metadata.get("amount_kopeks") is not None:
            try:
                return int(metadata.get("amount_kopeks"))
            except (TypeError, ValueError):
                return None
        if not amount_value:
            return None
        try:
            return int((Decimal(str(amount_value)) * Decimal(100)).to_integral_value())
        except Exception:
            return None

    def _sanitize_payment_payload(self, payment: Dict[str, object]) -> JsonDict:
        confirmation = payment.get("confirmation")
        sanitized_confirmation: Optional[JsonDict] = None
        if isinstance(confirmation, dict):
            sanitized_confirmation = {
                "type": confirmation.get("type"),
                "confirmation_url": confirmation.get("confirmation_url"),
            }

        return {
            "id": payment.get("id"),
            "status": payment.get("status"),
            "amount": payment.get("amount"),
            "currency": (
                payment.get("amount", {}).get("currency")
                if isinstance(payment.get("amount"), dict)
                else None
            ),
            "confirmation": sanitized_confirmation,
        }

    def _sanitize_webhook_payload(self, webhook_data: Dict[str, object]) -> JsonDict:
        return {
            "event_type": webhook_data.get("event_type"),
            "payment_id": webhook_data.get("payment_id"),
            "status": webhook_data.get("status"),
            "amount": webhook_data.get("amount"),
            "currency": webhook_data.get("currency"),
            "metadata": webhook_data.get("metadata"),
        }

    # ==================== Utility Methods ====================

    def get_user_billing_info(self, user_id: str) -> Dict[str, object]:
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

        lead_magnet_config = get_lead_magnet_config()
        lead_magnet_state = (
            get_lead_magnet_state(user_id) if lead_magnet_config.enabled else None
        )

        if lead_magnet_state:
            lead_magnet_usage = {
                "tokens_input": lead_magnet_state.tokens_input_used,
                "tokens_output": lead_magnet_state.tokens_output_used,
                "images": lead_magnet_state.images_used,
                "tts_seconds": lead_magnet_state.tts_seconds_used,
                "stt_seconds": lead_magnet_state.stt_seconds_used,
            }
            lead_magnet_remaining = calculate_remaining(
                lead_magnet_state, lead_magnet_config.quotas
            )
            lead_magnet = {
                "enabled": True,
                "cycle_start": lead_magnet_state.cycle_start,
                "cycle_end": lead_magnet_state.cycle_end,
                "usage": lead_magnet_usage,
                "quotas": lead_magnet_config.quotas,
                "remaining": lead_magnet_remaining,
                "config_version": lead_magnet_config.config_version,
            }
        else:
            lead_magnet = {
                "enabled": lead_magnet_config.enabled,
                "cycle_start": None,
                "cycle_end": None,
                "usage": {
                    "tokens_input": 0,
                    "tokens_output": 0,
                    "images": 0,
                    "tts_seconds": 0,
                    "stt_seconds": 0,
                },
                "quotas": lead_magnet_config.quotas,
                "remaining": lead_magnet_config.quotas,
                "config_version": lead_magnet_config.config_version,
            }

        # Get recent transactions
        transactions = self.transactions.get_transactions_by_user(user_id, limit=10)

        return {
            "subscription": subscription.model_dump() if subscription else None,
            "plan": plan.model_dump() if plan else None,
            "usage": usage,
            "transactions": [tx.model_dump() for tx in transactions],
            "lead_magnet": lead_magnet,
        }


# Global billing service instance
billing_service = BillingService()
