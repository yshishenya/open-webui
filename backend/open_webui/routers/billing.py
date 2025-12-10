"""
Billing API endpoints
Handles subscription plans, payments, usage, and webhooks
"""

import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from fastapi.responses import JSONResponse

from open_webui.models.billing import (
    PlanModel,
    SubscriptionModel,
    UsageModel,
    TransactionModel,
    UsageMetric,
)
from open_webui.utils.auth import get_verified_user, get_admin_user
from open_webui.utils.billing import billing_service, QuotaExceededError
from open_webui.utils.yookassa import YooKassaWebhookHandler, get_yookassa_client
from open_webui.env import SRC_LOG_LEVELS
from open_webui.constants import ERROR_MESSAGES

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()


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


############################
# Plans Endpoints
############################


@router.get("/plans", response_model=List[PlanModel])
async def get_plans(user=Depends(get_verified_user)):
    """Get all active subscription plans"""
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
    subscription = billing_service.get_user_subscription(user.id)
    return subscription


@router.post("/subscription/cancel", response_model=SubscriptionModel)
async def cancel_my_subscription(
    request: CancelSubscriptionRequest,
    user=Depends(get_verified_user),
):
    """Cancel current user's subscription"""
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


############################
# Payment Endpoints
############################


@router.post("/payment", response_model=CreatePaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    user=Depends(get_verified_user),
):
    """Create payment for subscription"""
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
