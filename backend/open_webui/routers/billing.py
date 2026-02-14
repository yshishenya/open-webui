"""
Billing API endpoints
Handles subscription plans, payments, usage, and webhooks
"""

import logging
import time
import hmac
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, List
from urllib.parse import urlsplit, urlunsplit
from pydantic import BaseModel

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Header,
    Response,
    Query,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from open_webui.models.billing import (
    BillingSource,
    LedgerEntries,
    LedgerEntryModel,
    PlanModel,
    PaymentKind,
    PaymentStatus,
    Payments,
    SubscriptionModel,
    UsageEventModel,
    UsageEvents,
    TransactionModel,
    TransactionStatus,
    UsageMetric,
    Wallets,
    RateCards,
)
from open_webui.utils.auth import get_verified_user, get_admin_user
from open_webui.utils.billing import (
    billing_service,
    WebhookRetryableError,
    WebhookVerificationError,
)
from open_webui.utils.pricing import PricingService
from open_webui.utils.models import get_all_base_models
from open_webui.utils.wallet import wallet_service, WalletError
from open_webui.utils.yookassa import (
    YooKassaWebhookHandler,
    YooKassaRequestError,
    get_yookassa_client,
    is_yookassa_webhook_source_ip,
)
from open_webui.env import SRC_LOG_LEVELS
from open_webui.env import (
    ENABLE_BILLING_WALLET,
    ENABLE_BILLING_SUBSCRIPTIONS,
    BILLING_DEFAULT_CURRENCY,
    BILLING_TOPUP_PACKAGES_KOPEKS,
    PUBLIC_PRICING_POPULAR_MODELS,
    PUBLIC_PRICING_RECOMMENDED_TEXT_MODEL,
    PUBLIC_PRICING_RECOMMENDED_IMAGE_MODEL,
    PUBLIC_PRICING_RECOMMENDED_AUDIO_MODEL,
    PUBLIC_PRICING_RATE_CARD_MODEL_LIMIT,
    YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES,
    YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST,
    YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE,
    YOOKASSA_WEBHOOK_TOKEN,
    YOOKASSA_WEBHOOK_TRUST_X_FORWARDED_FOR,
)
from open_webui.models.users import Users
from open_webui.models.models import Models

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()
pricing_service = PricingService()
MAX_RETURN_URL_LENGTH = 2048


def _payment_gateway_http_error(error: YooKassaRequestError, action: str) -> HTTPException:
    status_code = error.status_code
    detail = "Payment provider is temporarily unavailable"
    response_status = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if error.retryable
        else status.HTTP_502_BAD_GATEWAY
    )

    if status_code in {401, 403} or error.error_code == "invalid_credentials":
        detail = "Payment provider credentials are invalid"
        response_status = status.HTTP_502_BAD_GATEWAY
    elif status_code == 400:
        detail = "Payment provider rejected the payment request"
        response_status = status.HTTP_502_BAD_GATEWAY
    elif status_code == 429:
        detail = "Payment provider is rate-limiting requests"

    log.error(
        "YooKassa %s failed (status=%s, source=%s, code=%s, retryable=%s): %s",
        action,
        status_code,
        error.source,
        error.error_code,
        error.retryable,
        error.response_text,
    )
    return HTTPException(status_code=response_status, detail=detail)


def _sanitize_payment_return_url(return_url: str) -> str:
    candidate = return_url.strip()
    if not candidate:
        raise ValueError("Invalid return_url")
    if len(candidate) > MAX_RETURN_URL_LENGTH:
        raise ValueError("Invalid return_url")

    parsed = urlsplit(candidate)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Invalid return_url")
    if not parsed.netloc:
        raise ValueError("Invalid return_url")
    if parsed.username or parsed.password:
        raise ValueError("Invalid return_url")
    if parsed.fragment:
        raise ValueError("Invalid return_url")

    normalized_path = parsed.path if parsed.path else "/"
    return urlunsplit(
        (parsed.scheme, parsed.netloc, normalized_path, parsed.query, "")
    )


def _is_webhook_replay(parsed_data: Dict[str, object]) -> bool:
    event_type = parsed_data.get("event_type")
    payment_id = parsed_data.get("payment_id")
    if not isinstance(event_type, str) or not isinstance(payment_id, str):
        return False

    expected_payment_status = {
        "payment.succeeded": PaymentStatus.SUCCEEDED.value,
        "payment.canceled": PaymentStatus.CANCELED.value,
        "payment.waiting_for_capture": PaymentStatus.PENDING.value,
    }.get(event_type)

    if expected_payment_status:
        payment = Payments.get_payment_by_provider_id(payment_id)
        if payment and payment.status == expected_payment_status:
            return True

    metadata = parsed_data.get("metadata")
    if not isinstance(metadata, dict):
        return False

    transaction_id = metadata.get("transaction_id")
    if (
        event_type == "payment.succeeded"
        and isinstance(transaction_id, str)
        and transaction_id
    ):
        transaction = billing_service.transactions.get_transaction_by_id(transaction_id)
        if transaction and transaction.status == TransactionStatus.SUCCEEDED.value:
            return True

    return False


def _payment_system_http_error(error: RuntimeError, action: str) -> HTTPException:
    message = str(error)
    detail = "Payment system temporarily unavailable"

    if "YooKassa client not initialized" in message:
        detail = "Payment system is not configured"

    log.error("Payment system %s failed: %s", action, message)
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def _require_subscriptions_enabled() -> None:
    if not ENABLE_BILLING_SUBSCRIPTIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing subscriptions are disabled",
        )


def _normalize_public_lead_magnet_quotas(raw: Dict[str, object]) -> Dict[str, int]:
    defaults: Dict[str, int] = {
        "tokens_input": 0,
        "tokens_output": 0,
        "images": 0,
        "tts_seconds": 0,
        "stt_seconds": 0,
    }
    for key, value in raw.items():
        if key in defaults and isinstance(value, int):
            defaults[key] = value
    return defaults


############################
# Request/Response Models
############################


class CreatePaymentRequest(BaseModel):
    plan_id: str
    return_url: str


class CreatePaymentResponse(BaseModel):
    transaction_id: str
    payment_id: str
    confirmation_url: str
    status: str


class TopupRequest(BaseModel):
    amount_kopeks: int
    return_url: str


class TopupResponse(BaseModel):
    payment_id: str
    confirmation_url: str
    status: str


class TopupReconcileRequest(BaseModel):
    payment_id: str


class TopupReconcileResponse(BaseModel):
    payment_id: str
    provider_status: Optional[str] = None
    payment_status: Optional[str] = None
    credited: bool


class CreatePlanRequest(BaseModel):
    name: str
    name_ru: Optional[str] = None
    description: Optional[str] = None
    description_ru: Optional[str] = None
    price: float
    currency: str = "RUB"
    interval: str
    quotas: Optional[Dict[str, int]] = None
    features: Optional[List[str]] = None
    is_active: bool = True
    display_order: int = 0


class CancelSubscriptionRequest(BaseModel):
    immediate: bool = False


class CheckQuotaRequest(BaseModel):
    metric: str
    amount: int = 1


class CheckQuotaResponse(BaseModel):
    allowed: bool
    current_usage: int
    quota_limit: Optional[int]
    remaining: Optional[int]


class PublicLeadMagnetQuotas(BaseModel):
    tokens_input: int = 0
    tokens_output: int = 0
    images: int = 0
    tts_seconds: int = 0
    stt_seconds: int = 0


class PublicLeadMagnetResponse(BaseModel):
    enabled: bool
    cycle_days: int
    quotas: PublicLeadMagnetQuotas
    config_version: int


class PublicRateCardRates(BaseModel):
    text_in_1000_tokens: Optional[int] = None
    text_out_1000_tokens: Optional[int] = None
    image_1024: Optional[int] = None
    tts_1000_chars: Optional[int] = None
    stt_minute: Optional[int] = None


class PublicRateCardModel(BaseModel):
    id: str
    display_name: str
    provider: Optional[str] = None
    capabilities: List[str]
    rates: PublicRateCardRates


class PublicRateCardResponse(BaseModel):
    currency: str
    updated_at: str
    models: List[PublicRateCardModel]


class PublicPricingFreeLimits(BaseModel):
    text_in: int
    text_out: int
    images: int
    tts_minutes: int
    stt_minutes: int


class PublicPricingRecommendedModels(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None
    audio: Optional[str] = None


class PublicPricingConfigResponse(BaseModel):
    topup_amounts_rub: List[int]
    free_limits: PublicPricingFreeLimits
    popular_model_ids: List[str]
    recommended_model_ids: PublicPricingRecommendedModels


class BalanceResponse(BaseModel):
    balance_topup_kopeks: int
    balance_included_kopeks: int
    included_expires_at: Optional[int] = None
    max_reply_cost_kopeks: Optional[int] = None
    daily_cap_kopeks: Optional[int] = None
    daily_spent_kopeks: int
    daily_reset_at: Optional[int] = None
    auto_topup_enabled: bool = False
    auto_topup_threshold_kopeks: Optional[int] = None
    auto_topup_amount_kopeks: Optional[int] = None
    auto_topup_fail_count: int = 0
    auto_topup_last_failed_at: Optional[int] = None
    auto_topup_payment_method_saved: bool = False
    currency: str


class AutoTopupRequest(BaseModel):
    enabled: bool
    threshold_kopeks: Optional[int] = None
    amount_kopeks: Optional[int] = None


class BillingSettingsRequest(BaseModel):
    max_reply_cost_kopeks: Optional[int] = None
    daily_cap_kopeks: Optional[int] = None
    billing_contact_email: Optional[str] = None
    billing_contact_phone: Optional[str] = None


class LeadMagnetUsageResponse(BaseModel):
    tokens_input: int
    tokens_output: int
    images: int
    tts_seconds: int
    stt_seconds: int


class LeadMagnetInfoResponse(BaseModel):
    enabled: bool
    cycle_start: Optional[int] = None
    cycle_end: Optional[int] = None
    usage: LeadMagnetUsageResponse
    quotas: LeadMagnetUsageResponse
    remaining: LeadMagnetUsageResponse
    config_version: int


############################
# Public Plans Endpoint
############################


class PublicPlanResponse(BaseModel):
    """Public plan information for unauthenticated users"""

    id: str
    name: str
    name_ru: Optional[str] = None
    description: Optional[str] = None
    description_ru: Optional[str] = None
    price: float
    currency: str
    interval: str
    features: List[str] = []
    quotas: Dict[str, int] = {}
    display_order: int = 0


@router.get("/plans/public", response_model=List[PublicPlanResponse])
def get_public_plans():
    """
    Get all active billing plans for public display.
    No authentication required.

    Получить все активные тарифные планы для публичного отображения.
    Аутентификация не требуется.
    """
    _require_subscriptions_enabled()
    try:
        plans = billing_service.get_active_plans()
        # Sort by display_order
        plans = sorted(plans, key=lambda p: getattr(p, "display_order", 0) or 0)
        return [
            PublicPlanResponse(
                id=plan.id,
                name=plan.name,
                name_ru=getattr(plan, "name_ru", None),
                description=plan.description,
                description_ru=getattr(plan, "description_ru", None),
                price=plan.price,
                currency=plan.currency,
                interval=plan.interval,
                features=plan.features or [],
                quotas=plan.quotas or {},
                display_order=getattr(plan, "display_order", 0) or 0,
            )
            for plan in plans
        ]
    except Exception as e:
        log.exception(f"Error getting public plans: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plans",
        )


############################
# Wallet Endpoints
############################


@router.get("/balance", response_model=BalanceResponse)
def get_balance(user=Depends(get_verified_user)):
    """Get wallet balance and limits for current user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    try:
        wallet = wallet_service.get_or_create_wallet(user.id, BILLING_DEFAULT_CURRENCY)
        latest_payment_with_method = Payments.get_latest_payment_with_method(
            wallet.id,
            status=PaymentStatus.SUCCEEDED.value,
            kind=PaymentKind.TOPUP.value,
        )
        return BalanceResponse(
            balance_topup_kopeks=wallet.balance_topup_kopeks,
            balance_included_kopeks=wallet.balance_included_kopeks,
            included_expires_at=wallet.included_expires_at,
            max_reply_cost_kopeks=wallet.max_reply_cost_kopeks,
            daily_cap_kopeks=wallet.daily_cap_kopeks,
            daily_spent_kopeks=wallet.daily_spent_kopeks,
            daily_reset_at=wallet.daily_reset_at,
            auto_topup_enabled=wallet.auto_topup_enabled,
            auto_topup_threshold_kopeks=wallet.auto_topup_threshold_kopeks,
            auto_topup_amount_kopeks=wallet.auto_topup_amount_kopeks,
            auto_topup_fail_count=wallet.auto_topup_fail_count,
            auto_topup_last_failed_at=wallet.auto_topup_last_failed_at,
            auto_topup_payment_method_saved=latest_payment_with_method is not None,
            currency=wallet.currency,
        )
    except WalletError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/ledger", response_model=List[LedgerEntryModel])
def get_ledger(
    limit: int = 50,
    skip: int = 0,
    user=Depends(get_verified_user),
):
    """Get ledger entries for current user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    try:
        return LedgerEntries.get_entries_by_user(user.id, limit=limit, offset=skip)
    except Exception as e:
        log.exception(f"Error getting ledger: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get ledger",
        )


@router.get("/usage-events", response_model=List[UsageEventModel])
def get_usage_events(
    limit: int = 50,
    skip: int = 0,
    billing_source: Optional[str] = None,
    user=Depends(get_verified_user),
):
    """Get usage events for current user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    if billing_source and billing_source not in {
        BillingSource.LEAD_MAGNET.value,
        BillingSource.PAYG.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing_source",
        )

    try:
        return UsageEvents.list_events_by_user(
            user.id,
            limit=limit,
            offset=skip,
            billing_source=billing_source,
        )
    except Exception as e:
        log.exception(f"Error getting usage events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage events",
        )


@router.post("/auto-topup")
def update_auto_topup(
    request: AutoTopupRequest,
    user=Depends(get_verified_user),
):
    """Enable/disable auto-topup and update thresholds."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    wallet = wallet_service.get_or_create_wallet(user.id, BILLING_DEFAULT_CURRENCY)
    updates: Dict[str, object] = {"auto_topup_enabled": request.enabled}

    if request.enabled:
        if request.threshold_kopeks is None or request.amount_kopeks is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="threshold_kopeks and amount_kopeks are required when enabled",
            )
        if request.threshold_kopeks < 0 or request.amount_kopeks <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Auto-topup threshold and amount must be positive",
            )
        if (
            BILLING_TOPUP_PACKAGES_KOPEKS
            and request.amount_kopeks not in BILLING_TOPUP_PACKAGES_KOPEKS
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid auto-topup amount",
            )
        updates["auto_topup_threshold_kopeks"] = request.threshold_kopeks
        updates["auto_topup_amount_kopeks"] = request.amount_kopeks
        updates["auto_topup_fail_count"] = 0
        updates["auto_topup_last_failed_at"] = None

    updated = Wallets.update_wallet(wallet.id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update auto-topup settings",
        )

    return {"status": "ok"}


@router.post("/settings")
def update_billing_settings(
    request: BillingSettingsRequest,
    user=Depends(get_verified_user),
):
    """Update wallet limits and billing contact info."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    wallet = wallet_service.get_or_create_wallet(user.id, BILLING_DEFAULT_CURRENCY)
    updates: Dict[str, object] = {}
    if "max_reply_cost_kopeks" in request.model_fields_set:
        if (
            request.max_reply_cost_kopeks is not None
            and request.max_reply_cost_kopeks < 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_reply_cost_kopeks must be non-negative",
            )
        updates["max_reply_cost_kopeks"] = request.max_reply_cost_kopeks
    if "daily_cap_kopeks" in request.model_fields_set:
        if request.daily_cap_kopeks is not None and request.daily_cap_kopeks < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="daily_cap_kopeks must be non-negative",
            )
        updates["daily_cap_kopeks"] = request.daily_cap_kopeks

    if updates:
        updated = Wallets.update_wallet(wallet.id, updates)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update billing settings",
            )

    contact_updates: Dict[str, object] = {}
    if "billing_contact_email" in request.model_fields_set:
        contact_updates["billing_contact_email"] = request.billing_contact_email
    if "billing_contact_phone" in request.model_fields_set:
        contact_updates["billing_contact_phone"] = request.billing_contact_phone

    if contact_updates:
        info = user.info or {}
        info.update(contact_updates)
        Users.update_user_by_id(user.id, {"info": info})

    return {"status": "ok"}


############################
# Plans Endpoints
############################


@router.get("/plans", response_model=List[PlanModel])
def get_plans(user=Depends(get_admin_user)):
    """Get all active subscription plans (admin only)"""
    _require_subscriptions_enabled()
    try:
        plans = billing_service.get_active_plans()
        return plans
    except Exception as e:
        log.exception(f"Error getting plans: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plans",
        )


@router.get("/plans/{plan_id}", response_model=PlanModel)
def get_plan(plan_id: str, user=Depends(get_verified_user)):
    """Get specific plan by ID"""
    _require_subscriptions_enabled()
    plan = billing_service.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )
    return plan


@router.post("/plans", response_model=PlanModel)
def create_plan(
    request: CreatePlanRequest,
    user=Depends(get_admin_user),
):
    """Create new subscription plan (admin only)"""
    _require_subscriptions_enabled()
    try:
        plan = billing_service.create_plan(
            name=request.name,
            name_ru=request.name_ru,
            description=request.description,
            description_ru=request.description_ru,
            price=request.price,
            currency=request.currency,
            interval=request.interval,
            quotas=request.quotas,
            features=request.features,
            is_active=request.is_active,
            display_order=request.display_order,
        )
        return plan
    except Exception as e:
        log.exception(f"Error creating plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create plan",
        )


############################
# Subscription Endpoints
############################


@router.get("/subscription", response_model=Optional[SubscriptionModel])
def get_my_subscription(user=Depends(get_verified_user)):
    """Get current user's subscription"""
    _require_subscriptions_enabled()
    subscription = billing_service.get_user_subscription(user.id)
    return subscription


@router.post("/subscription/cancel", response_model=SubscriptionModel)
def cancel_my_subscription(
    request: CancelSubscriptionRequest,
    user=Depends(get_verified_user),
):
    """Cancel current user's subscription"""
    _require_subscriptions_enabled()
    subscription = billing_service.get_user_subscription(user.id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )

    updated = billing_service.cancel_subscription(
        subscription.id, immediate=request.immediate
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription",
        )

    return updated


@router.post("/subscription/resume", response_model=SubscriptionModel)
def resume_my_subscription(user=Depends(get_verified_user)):
    """Resume current user's subscription if cancellation is scheduled"""
    _require_subscriptions_enabled()
    subscription = billing_service.get_user_subscription(user.id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )

    if not subscription.cancel_at_period_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is not scheduled for cancellation",
        )

    if subscription.current_period_end <= int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription already ended",
        )

    updated = billing_service.resume_subscription(subscription.id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume subscription",
        )

    return updated


############################
# Payment Endpoints
############################


@router.post("/topup", response_model=TopupResponse)
async def create_topup(
    request: TopupRequest,
    user=Depends(get_verified_user),
):
    """Create topup payment for wallet"""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    wallet = await run_in_threadpool(
        wallet_service.get_or_create_wallet,
        user.id,
        BILLING_DEFAULT_CURRENCY,
    )

    try:
        normalized_return_url = _sanitize_payment_return_url(request.return_url)
        payment_data = await billing_service.create_topup_payment(
            user_id=user.id,
            wallet_id=wallet.id,
            amount_kopeks=request.amount_kopeks,
            return_url=normalized_return_url,
        )
        return TopupResponse(**payment_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except YooKassaRequestError as e:
        raise _payment_gateway_http_error(e, action="topup") from e
    except RuntimeError as e:
        raise _payment_system_http_error(e, action="topup") from e
    except Exception as e:
        log.exception(f"Error creating topup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create topup",
        )


@router.post("/topup/reconcile", response_model=TopupReconcileResponse)
async def reconcile_topup(
    request: TopupReconcileRequest,
    user=Depends(get_verified_user),
):
    """Force topup status reconciliation with YooKassa for current user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    try:
        result = await billing_service.reconcile_topup_payment(
            user_id=user.id,
            payment_id=request.payment_id,
        )
        return TopupReconcileResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except YooKassaRequestError as e:
        raise _payment_gateway_http_error(e, action="topup reconcile") from e
    except RuntimeError as e:
        raise _payment_system_http_error(e, action="topup reconcile") from e
    except Exception as e:
        log.exception(f"Error reconciling topup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reconcile topup",
        )


@router.post("/payment", response_model=CreatePaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    user=Depends(get_verified_user),
):
    """Create payment for subscription"""
    _require_subscriptions_enabled()
    try:
        normalized_return_url = _sanitize_payment_return_url(request.return_url)
        payment_data = await billing_service.create_payment(
            user_id=user.id,
            plan_id=request.plan_id,
            return_url=normalized_return_url,
        )
        return CreatePaymentResponse(**payment_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except YooKassaRequestError as e:
        raise _payment_gateway_http_error(e, action="payment") from e
    except RuntimeError as e:
        raise _payment_system_http_error(e, action="payment") from e
    except Exception as e:
        log.exception(f"Error creating payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment",
        )


@router.get("/transactions", response_model=List[TransactionModel])
def get_my_transactions(
    limit: int = 50,
    skip: int = 0,
    user=Depends(get_verified_user),
):
    """Get current user's transaction history"""
    try:
        transactions = billing_service.transactions.get_transactions_by_user(
            user.id, limit=limit, skip=skip
        )
        return transactions
    except Exception as e:
        log.exception(f"Error getting transactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get transactions",
        )


############################
# Usage Endpoints
############################


@router.get("/usage/{metric}")
def get_my_usage(
    metric: str,
    user=Depends(get_verified_user),
):
    """Get current usage for a specific metric"""
    try:
        # Validate metric
        try:
            usage_metric = UsageMetric(metric)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metric: {metric}",
            )

        current_usage = billing_service.get_current_period_usage(user.id, usage_metric)

        subscription = billing_service.get_user_subscription(user.id)
        quota_limit = None

        if subscription:
            plan = billing_service.get_plan(subscription.plan_id)
            if plan and plan.quotas:
                quota_limit = plan.quotas.get(metric)

        remaining = None
        if quota_limit is not None:
            remaining = max(0, quota_limit - current_usage)

        return {
            "metric": metric,
            "current_usage": current_usage,
            "quota_limit": quota_limit,
            "remaining": remaining,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error getting usage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage",
        )


@router.post("/usage/check", response_model=CheckQuotaResponse)
def check_quota(
    request: CheckQuotaRequest,
    user=Depends(get_verified_user),
):
    """Check if user can use specified amount without exceeding quota"""
    try:
        # Validate metric
        try:
            usage_metric = UsageMetric(request.metric)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metric: {request.metric}",
            )

        allowed = billing_service.check_quota(user.id, usage_metric, request.amount)

        current_usage = billing_service.get_current_period_usage(user.id, usage_metric)

        subscription = billing_service.get_user_subscription(user.id)
        quota_limit = None

        if subscription:
            plan = billing_service.get_plan(subscription.plan_id)
            if plan and plan.quotas:
                quota_limit = plan.quotas.get(request.metric)

        remaining = None
        if quota_limit is not None:
            remaining = max(0, quota_limit - current_usage)

        return CheckQuotaResponse(
            allowed=allowed,
            current_usage=current_usage,
            quota_limit=quota_limit,
            remaining=remaining,
        )
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error checking quota: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check quota",
        )


############################
# Billing Info Endpoint
############################


@router.get("/me")
def get_my_billing_info(user=Depends(get_verified_user)):
    """Get complete billing information for current user"""
    try:
        billing_info = billing_service.get_user_billing_info(user.id)
        return billing_info
    except Exception as e:
        log.exception(f"Error getting billing info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get billing info",
        )


@router.get("/lead-magnet", response_model=LeadMagnetInfoResponse)
def get_lead_magnet_info(user=Depends(get_verified_user)):
    """Get lead magnet status and usage for current user."""
    try:
        billing_info = billing_service.get_user_billing_info(user.id)
        lead_magnet = billing_info.get("lead_magnet")
        if not lead_magnet:
            return LeadMagnetInfoResponse(
                enabled=False,
                usage=LeadMagnetUsageResponse(
                    tokens_input=0,
                    tokens_output=0,
                    images=0,
                    tts_seconds=0,
                    stt_seconds=0,
                ),
                quotas=LeadMagnetUsageResponse(
                    tokens_input=0,
                    tokens_output=0,
                    images=0,
                    tts_seconds=0,
                    stt_seconds=0,
                ),
                remaining=LeadMagnetUsageResponse(
                    tokens_input=0,
                    tokens_output=0,
                    images=0,
                    tts_seconds=0,
                    stt_seconds=0,
                ),
                config_version=0,
            )

        return LeadMagnetInfoResponse(
            enabled=bool(lead_magnet.get("enabled", False)),
            cycle_start=lead_magnet.get("cycle_start"),
            cycle_end=lead_magnet.get("cycle_end"),
            usage=LeadMagnetUsageResponse(**lead_magnet.get("usage", {})),
            quotas=LeadMagnetUsageResponse(**lead_magnet.get("quotas", {})),
            remaining=LeadMagnetUsageResponse(**lead_magnet.get("remaining", {})),
            config_version=int(lead_magnet.get("config_version", 0)),
        )
    except Exception as e:
        log.exception(f"Error getting lead magnet info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get lead magnet info",
        )


@router.get("/public/lead-magnet", response_model=PublicLeadMagnetResponse)
def get_public_lead_magnet_config(request: Request) -> PublicLeadMagnetResponse:
    """Expose lead magnet configuration for public pages."""
    config = request.app.state.config
    quotas = _normalize_public_lead_magnet_quotas(config.LEAD_MAGNET_QUOTAS or {})
    return PublicLeadMagnetResponse(
        enabled=bool(config.LEAD_MAGNET_ENABLED),
        cycle_days=int(config.LEAD_MAGNET_CYCLE_DAYS),
        quotas=PublicLeadMagnetQuotas(**quotas),
        config_version=int(config.LEAD_MAGNET_CONFIG_VERSION),
    )


@router.get("/public/pricing-config", response_model=PublicPricingConfigResponse)
def get_public_pricing_config(request: Request) -> PublicPricingConfigResponse:
    """Expose pricing config for public pages (topups, free limits, popular/recommended)."""
    config = request.app.state.config
    quotas = _normalize_public_lead_magnet_quotas(config.LEAD_MAGNET_QUOTAS or {})

    topup_amounts_rub = sorted(
        {
            int(amount / 100)
            for amount in BILLING_TOPUP_PACKAGES_KOPEKS
            if isinstance(amount, int) and amount > 0
        }
    )

    def _nullable(value: str) -> Optional[str]:
        cleaned = value.strip()
        return cleaned if cleaned else None

    return PublicPricingConfigResponse(
        topup_amounts_rub=topup_amounts_rub,
        free_limits=PublicPricingFreeLimits(
            text_in=quotas["tokens_input"],
            text_out=quotas["tokens_output"],
            images=quotas["images"],
            tts_minutes=(
                int(quotas["tts_seconds"] / 60) if quotas["tts_seconds"] > 0 else 0
            ),
            stt_minutes=(
                int(quotas["stt_seconds"] / 60) if quotas["stt_seconds"] > 0 else 0
            ),
        ),
        popular_model_ids=PUBLIC_PRICING_POPULAR_MODELS,
        recommended_model_ids=PublicPricingRecommendedModels(
            text=_nullable(PUBLIC_PRICING_RECOMMENDED_TEXT_MODEL),
            image=_nullable(PUBLIC_PRICING_RECOMMENDED_IMAGE_MODEL),
            audio=_nullable(PUBLIC_PRICING_RECOMMENDED_AUDIO_MODEL),
        ),
    )


@router.get("/public/rate-cards", response_model=PublicRateCardResponse)
async def get_public_rate_cards(
    request: Request, response: Response, currency: Optional[str] = None
) -> PublicRateCardResponse:
    """Expose rate cards for public pricing tables."""
    response.headers["Cache-Control"] = "public, max-age=600"
    if currency and currency != BILLING_DEFAULT_CURRENCY:
        log.warning(f"Requested unsupported currency {currency}, using default.")

    display_units = {
        ("text", "token_in"): ("text_in_1000_tokens", 1000),
        ("text", "token_out"): ("text_out_1000_tokens", 1000),
        ("image", "image_1024"): ("image_1024", 1),
        ("tts", "tts_char"): ("tts_1000_chars", 1000),
        ("stt", "stt_second"): ("stt_minute", 60),
    }

    model_limit = min(max(PUBLIC_PRICING_RATE_CARD_MODEL_LIMIT, 1), 50)
    workspace_base_models = await run_in_threadpool(Models.get_base_models)

    excluded_model_ids = set()
    merged_models_by_id: Dict[str, Dict[str, Optional[str]]] = {}
    for model in workspace_base_models:
        if not model.is_active:
            excluded_model_ids.add(model.id)
            continue
        if model.access_control is not None:
            excluded_model_ids.add(model.id)
            continue
        if model.meta and getattr(model.meta, "hidden", False):
            excluded_model_ids.add(model.id)
            continue
        merged_models_by_id[model.id] = {
            "id": model.id,
            "display_name": model.name or model.id,
            "owned_by": None,
        }

    try:
        provider_base_models = await get_all_base_models(request)
    except Exception as e:
        log.debug(f"Failed to fetch provider base models for public pricing: {e}")
        provider_base_models = []

    for item in provider_base_models:
        model_id = (item.get("id") or "").strip()
        if not model_id:
            continue
        if model_id in excluded_model_ids:
            continue

        owned_by_value = item.get("owned_by")
        owned_by = str(owned_by_value).strip() if owned_by_value else None
        name_value = item.get("name")
        display_name = str(name_value).strip() if name_value else model_id

        existing = merged_models_by_id.get(model_id)
        if existing is not None:
            if existing.get("owned_by") is None and owned_by:
                existing["owned_by"] = owned_by
            continue

        merged_models_by_id[model_id] = {
            "id": model_id,
            "display_name": display_name,
            "owned_by": owned_by,
        }

    active_models = sorted(
        merged_models_by_id.values(),
        key=lambda model: (model.get("display_name") or model["id"]).lower(),
    )
    active_model_ids = [model["id"] for model in active_models]

    rate_cards = []
    chunk_size = 250
    for offset in range(0, len(active_model_ids), chunk_size):
        chunk = active_model_ids[offset : offset + chunk_size]
        rate_cards.extend(
            await run_in_threadpool(
                RateCards.list_rate_cards_by_model_ids,
                chunk,
                True,
            )
        )

    latest_by_model: Dict[str, Dict[tuple[str, str], object]] = {}
    for entry in rate_cards:
        model_latest = latest_by_model.setdefault(entry.model_id, {})
        key = (entry.modality, entry.unit)
        if key not in model_latest:
            model_latest[key] = entry

    models: List[PublicRateCardModel] = []
    updated_at_ts: Optional[int] = None

    for model in active_models:
        latest = latest_by_model.get(model["id"], {})
        if not latest:
            continue

        rates_payload: Dict[str, Optional[int]] = {
            "text_in_1000_tokens": None,
            "text_out_1000_tokens": None,
            "image_1024": None,
            "tts_1000_chars": None,
            "stt_minute": None,
        }
        capabilities = set()
        provider: Optional[str] = None
        model_updated_at: Optional[int] = None

        for (modality, unit), entry in latest.items():
            mapping = display_units.get((modality, unit))
            if not mapping:
                continue
            field_name, per_unit = mapping
            pricing_units = Decimal(per_unit)
            if modality == "text" and unit in {"token_in", "token_out"}:
                pricing_units = Decimal(1)
            price = pricing_service.calculate_cost_kopeks(pricing_units, entry, 0)
            rates_payload[field_name] = price

            if modality == "text":
                capabilities.add("text")
            elif modality == "image":
                capabilities.add("image")
            elif modality in {"tts", "stt"}:
                capabilities.add("audio")

            if provider is None and entry.provider:
                provider = entry.provider
            if model_updated_at is None or entry.created_at > model_updated_at:
                model_updated_at = entry.created_at

        if provider is None:
            provider = model.get("owned_by")

        if all(value is None for value in rates_payload.values()):
            continue

        if model_updated_at is not None:
            if updated_at_ts is None or model_updated_at > updated_at_ts:
                updated_at_ts = model_updated_at

        models.append(
            PublicRateCardModel(
                id=model["id"],
                display_name=model.get("display_name") or model["id"],
                provider=provider,
                capabilities=sorted(capabilities),
                rates=PublicRateCardRates(**rates_payload),
            )
        )

        if len(models) >= model_limit:
            break

    updated_at_value = datetime.fromtimestamp(
        updated_at_ts or int(time.time()), tz=timezone.utc
    ).isoformat()
    if updated_at_value.endswith("+00:00"):
        updated_at_value = updated_at_value.replace("+00:00", "Z")

    return PublicRateCardResponse(
        currency=BILLING_DEFAULT_CURRENCY,
        updated_at=updated_at_value,
        models=models,
    )


############################
# Webhook Endpoint
############################


@router.post("/webhook/yookassa")
async def yookassa_webhook(
    request: Request,
    x_yookassa_signature: Optional[str] = Header(None, alias="X-YooKassa-Signature"),
    x_yookassa_timestamp: Optional[str] = Header(None, alias="X-YooKassa-Timestamp"),
    token: Optional[str] = Query(None),
):
    """
    Webhook endpoint for YooKassa payment notifications
    This endpoint is called by YooKassa when payment status changes
    """
    # Optional app-level shared secret protection (independent of YooKassa auth):
    # configure webhook URL as `...?token=...` and set YOOKASSA_WEBHOOK_TOKEN.
    if YOOKASSA_WEBHOOK_TOKEN and (
        not token or not hmac.compare_digest(token, YOOKASSA_WEBHOOK_TOKEN)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook token",
        )

    if YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST:
        source_ip: str | None = None
        if YOOKASSA_WEBHOOK_TRUST_X_FORWARDED_FOR:
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                source_ip = forwarded_for.split(",", 1)[0].strip() or None

        if source_ip is None:
            source_ip = request.client.host if request.client else ""

        if not is_yookassa_webhook_source_ip(source_ip, YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES):
            log.warning("Untrusted YooKassa webhook source ip: %s", source_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Untrusted webhook source",
            )

    # Get raw body for signature verification / parsing.
    body = await request.body()
    try:
        body_str = body.decode("utf-8")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request body encoding",
        )

    yookassa = get_yookassa_client()
    signature_enforced = bool(YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE)
    signature_supported = bool(
        yookassa and getattr(getattr(yookassa, "config", None), "webhook_secret", None)
    )

    if signature_enforced and not signature_supported:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system temporarily unavailable",
        )

    if signature_enforced and not x_yookassa_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing signature",
        )

    if signature_enforced:
        if not x_yookassa_timestamp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature timestamp",
            )
        try:
            signature_timestamp = int(x_yookassa_timestamp)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature timestamp",
            )

        if abs(int(time.time()) - signature_timestamp) > 300:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signature timestamp is outside allowed window",
            )

        is_valid = yookassa.verify_webhook(body_str, x_yookassa_signature)
        if not is_valid:
            log.warning("Invalid webhook signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature",
            )

    try:
        webhook_data = json.loads(body_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    try:
        parsed_data = YooKassaWebhookHandler.parse_webhook(webhook_data)
    except Exception as e:
        log.warning("Failed to parse YooKassa webhook: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )

    if await run_in_threadpool(_is_webhook_replay, parsed_data):
        log.info(
            "Ignoring replayed webhook for payment %s",
            parsed_data.get("payment_id"),
        )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ok", "replayed": True},
        )

    try:
        await billing_service.process_payment_webhook(parsed_data)
    except WebhookVerificationError as e:
        log.warning("Webhook verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook verification failed",
        )
    except WebhookRetryableError as e:
        log.warning("Webhook processing retryable error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Temporary error processing webhook",
        )
    except Exception as e:
        log.exception("Webhook processing error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook",
        )

    log.info("Processed webhook for payment %s", parsed_data.get("payment_id"))
    return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "ok"})
