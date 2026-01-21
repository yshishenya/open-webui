"""
Billing API endpoints
Handles subscription plans, payments, usage, and webhooks
"""

import logging
import time
from decimal import Decimal
from typing import Optional, Dict, List
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from open_webui.models.billing import (
    BillingSource,
    LedgerEntries,
    LedgerEntryModel,
    PlanModel,
    SubscriptionModel,
    UsageEventModel,
    UsageEvents,
    UsageModel,
    TransactionModel,
    UsageMetric,
    Wallets,
    RateCards,
)
from open_webui.utils.auth import get_verified_user, get_admin_user
from open_webui.utils.billing import billing_service, QuotaExceededError
from open_webui.utils.billing_integration import estimate_tokens_from_messages
from open_webui.utils.lead_magnet import evaluate_lead_magnet
from open_webui.utils.pricing import PricingService
from open_webui.utils.wallet import wallet_service, WalletError
from open_webui.utils.yookassa import YooKassaWebhookHandler, get_yookassa_client
from open_webui.env import SRC_LOG_LEVELS
from open_webui.constants import ERROR_MESSAGES
from open_webui.env import (
    ENABLE_BILLING_WALLET,
    ENABLE_BILLING_SUBSCRIPTIONS,
    BILLING_DEFAULT_CURRENCY,
    BILLING_TOPUP_PACKAGES_KOPEKS,
)
from open_webui.models.users import Users

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()
pricing_service = PricingService()


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


def _latest_rate_cards_for_model(
    model_id: str, as_of: Optional[int] = None
) -> Dict[tuple[str, str], object]:
    entries = RateCards.list_rate_cards(model_id=model_id, is_active=True, limit=200)
    now = as_of or int(time.time())
    latest: Dict[tuple[str, str], object] = {}
    for entry in entries:
        if entry.effective_from > now:
            continue
        if entry.effective_to is not None and entry.effective_to < now:
            continue
        key = (entry.modality, entry.unit)
        if key not in latest:
            latest[key] = entry
    return latest


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


class ActivateFreePlanRequest(BaseModel):
    plan_id: str


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


class PublicRateCardUnit(BaseModel):
    modality: str
    unit: str
    per_unit: int
    price_kopeks: int


class PublicRateCardModel(BaseModel):
    model_id: str
    rates: List[PublicRateCardUnit]


class PublicRateCardResponse(BaseModel):
    currency: str
    models: List[PublicRateCardModel]


class BalanceResponse(BaseModel):
    balance_topup_kopeks: int
    balance_included_kopeks: int
    included_expires_at: Optional[int] = None
    max_reply_cost_kopeks: Optional[int] = None
    daily_cap_kopeks: Optional[int] = None
    daily_spent_kopeks: int
    auto_topup_enabled: bool = False
    auto_topup_threshold_kopeks: Optional[int] = None
    auto_topup_amount_kopeks: Optional[int] = None
    auto_topup_fail_count: int = 0
    auto_topup_last_failed_at: Optional[int] = None
    currency: str


class EstimateRequest(BaseModel):
    model_id: str
    modality: str
    payload: Dict[str, object]
    max_reply_cost_kopeks: Optional[int] = None


class EstimateResponse(BaseModel):
    min_kopeks: int
    max_kopeks: int
    min_input_kopeks: Optional[int] = None
    max_input_kopeks: Optional[int] = None
    min_output_kopeks: Optional[int] = None
    max_output_kopeks: Optional[int] = None
    is_allowed: bool
    reason: Optional[str] = None
    billing_source: Optional[str] = None
    pricing_rate_card_id: Optional[str] = None
    pricing_rate_card_input_id: Optional[str] = None
    pricing_rate_card_output_id: Optional[str] = None
    pricing_version: Optional[str] = None


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
async def get_public_plans():
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
        plans = sorted(plans, key=lambda p: getattr(p, 'display_order', 0) or 0)
        return [
            PublicPlanResponse(
                id=plan.id,
                name=plan.name,
                name_ru=getattr(plan, 'name_ru', None),
                description=plan.description,
                description_ru=getattr(plan, 'description_ru', None),
                price=plan.price,
                currency=plan.currency,
                interval=plan.interval,
                features=plan.features or [],
                quotas=plan.quotas or {},
                display_order=getattr(plan, 'display_order', 0) or 0,
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
async def get_balance(user=Depends(get_verified_user)):
    """Get wallet balance and limits for current user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    try:
        wallet = wallet_service.get_or_create_wallet(
            user.id, BILLING_DEFAULT_CURRENCY
        )
        return BalanceResponse(
            balance_topup_kopeks=wallet.balance_topup_kopeks,
            balance_included_kopeks=wallet.balance_included_kopeks,
            included_expires_at=wallet.included_expires_at,
            max_reply_cost_kopeks=wallet.max_reply_cost_kopeks,
            daily_cap_kopeks=wallet.daily_cap_kopeks,
            daily_spent_kopeks=wallet.daily_spent_kopeks,
            auto_topup_enabled=wallet.auto_topup_enabled,
            auto_topup_threshold_kopeks=wallet.auto_topup_threshold_kopeks,
            auto_topup_amount_kopeks=wallet.auto_topup_amount_kopeks,
            auto_topup_fail_count=wallet.auto_topup_fail_count,
            auto_topup_last_failed_at=wallet.auto_topup_last_failed_at,
            currency=wallet.currency,
        )
    except WalletError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/ledger", response_model=List[LedgerEntryModel])
async def get_ledger(
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
async def get_usage_events(
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
async def update_auto_topup(
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
async def update_billing_settings(
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
    if request.max_reply_cost_kopeks is not None:
        updates["max_reply_cost_kopeks"] = request.max_reply_cost_kopeks
    if request.daily_cap_kopeks is not None:
        updates["daily_cap_kopeks"] = request.daily_cap_kopeks

    if updates:
        updated = Wallets.update_wallet(wallet.id, updates)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update billing settings",
            )

    contact_updates: Dict[str, object] = {}
    if request.billing_contact_email is not None:
        contact_updates["billing_contact_email"] = request.billing_contact_email
    if request.billing_contact_phone is not None:
        contact_updates["billing_contact_phone"] = request.billing_contact_phone

    if contact_updates:
        info = user.info or {}
        info.update(contact_updates)
        Users.update_user_by_id(user.id, {"info": info})

    return {"status": "ok"}


@router.post("/estimate", response_model=EstimateResponse)
async def estimate_cost(
    request: EstimateRequest,
    user=Depends(get_verified_user),
):
    """Estimate request cost based on rate card and user plan."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    now = int(time.time())
    wallet = wallet_service.get_or_create_wallet(user.id, BILLING_DEFAULT_CURRENCY)
    subscription = billing_service.get_user_subscription(user.id)
    plan = billing_service.get_plan(subscription.plan_id) if subscription else None
    discount_percent = plan.discount_percent if plan else 0

    if request.modality != "text":
        return EstimateResponse(
            min_kopeks=0,
            max_kopeks=0,
            is_allowed=False,
            reason="unsupported_modality",
        )

    messages = request.payload.get("messages", [])
    max_tokens = request.payload.get("max_tokens")
    if max_tokens is None:
        max_tokens = request.payload.get("max_completion_tokens")
    max_tokens = int(max_tokens) if isinstance(max_tokens, int) else 0

    prompt_tokens = estimate_tokens_from_messages(messages)
    min_output_tokens = 1 if max_tokens > 0 else 0
    max_output_tokens = max_tokens

    rate_in = pricing_service.get_rate_card(
        request.model_id, "text", "token_in", now
    )
    rate_out = pricing_service.get_rate_card(
        request.model_id, "text", "token_out", now
    )
    if not rate_in or not rate_out:
        return EstimateResponse(
            min_kopeks=0,
            max_kopeks=0,
            is_allowed=False,
            reason="rate_card_missing",
        )

    unit_in = Decimal(prompt_tokens) / Decimal(1000)
    unit_out_min = Decimal(min_output_tokens) / Decimal(1000)
    unit_out_max = Decimal(max_output_tokens) / Decimal(1000)

    min_input_cost = pricing_service.calculate_cost_kopeks(
        unit_in, rate_in, discount_percent
    )
    max_input_cost = min_input_cost
    min_output_cost = pricing_service.calculate_cost_kopeks(
        unit_out_min, rate_out, discount_percent
    )
    max_output_cost = pricing_service.calculate_cost_kopeks(
        unit_out_max, rate_out, discount_percent
    )
    min_cost = min_input_cost + min_output_cost
    max_cost = max_input_cost + max_output_cost

    lead_magnet_decision = None
    try:
        lead_magnet_decision = await run_in_threadpool(
            evaluate_lead_magnet,
            user.id,
            request.model_id,
            {
                "tokens_input": prompt_tokens,
                "tokens_output": max_output_tokens,
            },
            now,
        )
    except Exception as e:
        log.warning(f"Lead magnet evaluation failed: {e}")

    if lead_magnet_decision and lead_magnet_decision.allowed:
        return EstimateResponse(
            min_kopeks=0,
            max_kopeks=0,
            min_input_kopeks=0,
            max_input_kopeks=0,
            min_output_kopeks=0,
            max_output_kopeks=0,
            is_allowed=True,
            billing_source=BillingSource.LEAD_MAGNET.value,
            pricing_rate_card_id=rate_in.id,
            pricing_rate_card_input_id=rate_in.id,
            pricing_rate_card_output_id=rate_out.id,
            pricing_version=rate_in.version,
        )

    available = wallet.balance_included_kopeks + wallet.balance_topup_kopeks
    max_reply_cap = request.max_reply_cost_kopeks or wallet.max_reply_cost_kopeks

    if max_reply_cap is not None and max_cost > max_reply_cap:
        return EstimateResponse(
            min_kopeks=min_cost,
            max_kopeks=max_cost,
            min_input_kopeks=min_input_cost,
            max_input_kopeks=max_input_cost,
            min_output_kopeks=min_output_cost,
            max_output_kopeks=max_output_cost,
            is_allowed=False,
            reason="max_reply_cost_exceeded",
            billing_source=BillingSource.PAYG.value,
            pricing_rate_card_id=rate_in.id,
            pricing_rate_card_input_id=rate_in.id,
            pricing_rate_card_output_id=rate_out.id,
            pricing_version=rate_in.version,
        )

    if available < max_cost:
        return EstimateResponse(
            min_kopeks=min_cost,
            max_kopeks=max_cost,
            min_input_kopeks=min_input_cost,
            max_input_kopeks=max_input_cost,
            min_output_kopeks=min_output_cost,
            max_output_kopeks=max_output_cost,
            is_allowed=False,
            reason="insufficient_funds",
            billing_source=BillingSource.PAYG.value,
            pricing_rate_card_id=rate_in.id,
            pricing_rate_card_input_id=rate_in.id,
            pricing_rate_card_output_id=rate_out.id,
            pricing_version=rate_in.version,
        )

    return EstimateResponse(
        min_kopeks=min_cost,
        max_kopeks=max_cost,
        min_input_kopeks=min_input_cost,
        max_input_kopeks=max_input_cost,
        min_output_kopeks=min_output_cost,
        max_output_kopeks=max_output_cost,
        is_allowed=True,
        billing_source=BillingSource.PAYG.value,
        pricing_rate_card_id=rate_in.id,
        pricing_rate_card_input_id=rate_in.id,
        pricing_rate_card_output_id=rate_out.id,
        pricing_version=rate_in.version,
    )


############################
# Plans Endpoints
############################


@router.get("/plans", response_model=List[PlanModel])
async def get_plans(user=Depends(get_verified_user)):
    """Get all active subscription plans"""
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
async def get_plan(plan_id: str, user=Depends(get_verified_user)):
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
async def create_plan(
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
async def get_my_subscription(user=Depends(get_verified_user)):
    """Get current user's subscription"""
    _require_subscriptions_enabled()
    subscription = billing_service.get_user_subscription(user.id)
    return subscription


@router.post("/subscription/cancel", response_model=SubscriptionModel)
async def cancel_my_subscription(
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
async def resume_my_subscription(user=Depends(get_verified_user)):
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


@router.post("/subscription/free", response_model=SubscriptionModel)
async def activate_free_plan(
    request: ActivateFreePlanRequest, user=Depends(get_verified_user)
):
    """Activate free subscription plan for current user"""
    _require_subscriptions_enabled()
    try:
        subscription = billing_service.activate_free_plan(user.id, request.plan_id)
        return subscription
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        log.error(f"Failed to activate free plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate free plan",
        )
    except Exception as e:
        log.exception(f"Error activating free plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate free plan",
        )


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

    wallet = wallet_service.get_or_create_wallet(user.id, BILLING_DEFAULT_CURRENCY)

    try:
        payment_data = await billing_service.create_topup_payment(
            user_id=user.id,
            wallet_id=wallet.id,
            amount_kopeks=request.amount_kopeks,
            return_url=request.return_url,
        )
        return TopupResponse(**payment_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        log.error(f"Topup system error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system temporarily unavailable",
        )
    except Exception as e:
        log.exception(f"Error creating topup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create topup",
        )


@router.post("/payment", response_model=CreatePaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    user=Depends(get_verified_user),
):
    """Create payment for subscription"""
    _require_subscriptions_enabled()
    try:
        payment_data = await billing_service.create_payment(
            user_id=user.id,
            plan_id=request.plan_id,
            return_url=request.return_url,
        )
        return CreatePaymentResponse(**payment_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        log.error(f"Payment system error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system temporarily unavailable",
        )
    except Exception as e:
        log.exception(f"Error creating payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment",
        )


@router.get("/transactions", response_model=List[TransactionModel])
async def get_my_transactions(
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
async def get_my_usage(
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

        current_usage = billing_service.get_current_period_usage(
            user.id, usage_metric
        )

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
async def check_quota(
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

        allowed = billing_service.check_quota(
            user.id, usage_metric, request.amount
        )

        current_usage = billing_service.get_current_period_usage(
            user.id, usage_metric
        )

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
async def get_my_billing_info(user=Depends(get_verified_user)):
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
async def get_lead_magnet_info(user=Depends(get_verified_user)):
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
async def get_public_lead_magnet_config(request: Request) -> PublicLeadMagnetResponse:
    """Expose lead magnet configuration for public pages."""
    config = request.app.state.config
    quotas = _normalize_public_lead_magnet_quotas(config.LEAD_MAGNET_QUOTAS or {})
    return PublicLeadMagnetResponse(
        enabled=bool(config.LEAD_MAGNET_ENABLED),
        cycle_days=int(config.LEAD_MAGNET_CYCLE_DAYS),
        quotas=PublicLeadMagnetQuotas(**quotas),
        config_version=int(config.LEAD_MAGNET_CONFIG_VERSION),
    )


@router.get("/public/rate-cards", response_model=PublicRateCardResponse)
async def get_public_rate_cards() -> PublicRateCardResponse:
    """Expose PAYG rate cards for selected public models."""
    now = int(time.time())
    public_models = [
        "gpt-5.2",
        "gemini/gemini-3-pro-preview",
    ]
    display_units = {
        ("text", "token_in"): 1000,
        ("text", "token_out"): 1000,
        ("image", "image_1024"): 1,
        ("tts", "tts_char"): 1000,
        ("stt", "stt_second"): 60,
    }

    models: List[PublicRateCardModel] = []
    for model_id in public_models:
        latest = _latest_rate_cards_for_model(model_id, as_of=now)
        rates: List[PublicRateCardUnit] = []

        for (modality, unit), per_unit in display_units.items():
            entry = latest.get((modality, unit))
            if not entry:
                continue
            pricing_units = Decimal(per_unit)
            if modality == "text" and unit in {"token_in", "token_out"}:
                pricing_units = Decimal(1)
            price = pricing_service.calculate_cost_kopeks(
                pricing_units, entry, 0
            )
            rates.append(
                PublicRateCardUnit(
                    modality=modality,
                    unit=unit,
                    per_unit=per_unit,
                    price_kopeks=price,
                )
            )

        if rates:
            models.append(PublicRateCardModel(model_id=model_id, rates=rates))

    return PublicRateCardResponse(
        currency=BILLING_DEFAULT_CURRENCY,
        models=models,
    )


############################
# Webhook Endpoint
############################


@router.post("/webhook/yookassa")
async def yookassa_webhook(
    request: Request,
    x_yookassa_signature: Optional[str] = Header(None),
):
    """
    Webhook endpoint for YooKassa payment notifications
    This endpoint is called by YooKassa when payment status changes
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        body_str = body.decode("utf-8")

        # Verify webhook signature
        yookassa = get_yookassa_client()
        if yookassa and x_yookassa_signature:
            is_valid = yookassa.verify_webhook(body_str, x_yookassa_signature)
            if not is_valid:
                log.warning("Invalid webhook signature")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid signature",
                )

        # Parse webhook data
        import json

        webhook_data = json.loads(body_str)
        parsed_data = YooKassaWebhookHandler.parse_webhook(webhook_data)

        # Process webhook
        result = await billing_service.process_payment_webhook(parsed_data)

        log.info(f"Processed webhook for payment {parsed_data.get('payment_id')}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ok"},
        )

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error processing webhook: {e}")
        # Return 200 to YooKassa to avoid retries for internal errors
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "error", "message": str(e)},
        )
