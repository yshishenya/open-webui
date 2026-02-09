"""
Admin Billing API endpoints
Only accessible by administrators for managing billing plans
"""

import logging
import time
import uuid
from typing import Optional, List, Dict

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from open_webui.models.billing import (
    PlanModel,
    Plans,
    Subscriptions,
    Usage,
    UsageMetric,
    LedgerEntries,
    LedgerEntryModel,
    WalletModel,
)
from sqlalchemy import func
from open_webui.models.audit import AuditAction, AuditLogs
from open_webui.utils.auth import get_admin_user
from open_webui.models.users import Users
from open_webui.env import (
    SRC_LOG_LEVELS,
    ENABLE_BILLING_WALLET,
    BILLING_DEFAULT_CURRENCY,
)
from open_webui.utils.wallet import wallet_service, WalletError

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()


############################
# Request/Response Models
############################


class CreatePlanRequest(BaseModel):
    id: Optional[str] = None  # Auto-generate if not provided
    name: str = Field(..., min_length=1, max_length=100)
    name_ru: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    description_ru: Optional[str] = Field(None, max_length=1000)

    price: float = Field(..., ge=0)  # Price >= 0
    currency: str = Field(default="RUB", pattern="^(RUB|USD|EUR)$")
    interval: str = Field(..., pattern="^(day|week|month|year)$")

    quotas: Optional[Dict[str, int]] = None
    features: Optional[List[str]] = None

    is_active: bool = True
    display_order: int = Field(default=0, ge=0)


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    name_ru: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    description_ru: Optional[str] = Field(None, max_length=1000)

    price: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, pattern="^(RUB|USD|EUR)$")
    interval: Optional[str] = Field(None, pattern="^(day|week|month|year)$")

    quotas: Optional[Dict[str, int]] = None
    features: Optional[List[str]] = None

    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)


class PlanStatsModel(BaseModel):
    """Plan with subscription statistics"""

    plan: PlanModel
    active_subscriptions: int
    canceled_subscriptions: int
    total_subscriptions: int
    mrr: float  # Monthly Recurring Revenue


class PlanSubscriberModel(BaseModel):
    """User subscribed to a plan"""

    user_id: str
    email: str
    name: str
    profile_image_url: Optional[str] = None
    role: str = "user"
    subscription_status: str
    subscribed_at: int
    current_period_start: int
    current_period_end: int
    # Usage data
    tokens_input_used: int = 0
    tokens_input_limit: Optional[int] = None
    tokens_output_used: int = 0
    tokens_output_limit: Optional[int] = None
    requests_used: int = 0
    requests_limit: Optional[int] = None


class PaginatedSubscribersResponse(BaseModel):
    """Paginated response for plan subscribers"""

    items: List[PlanSubscriberModel]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserWalletSummaryResponse(BaseModel):
    """Admin view of user wallet and recent ledger entries."""

    user_id: str
    wallet: WalletModel
    ledger_preview: List[LedgerEntryModel]


class AdjustUserWalletRequest(BaseModel):
    """Admin wallet adjustment payload (delta-based)."""

    delta_topup_kopeks: int = 0
    delta_included_kopeks: int = 0
    reason: str = Field(..., min_length=1, max_length=500)
    idempotency_key: Optional[str] = Field(default=None, max_length=128)
    reference_id: Optional[str] = Field(default=None, max_length=128)


class AdjustUserWalletResponse(BaseModel):
    """Admin wallet adjustment response."""

    success: bool
    wallet: WalletModel
    ledger_entry: LedgerEntryModel


############################
# Helper Functions
############################


def generate_plan_id(name: str) -> str:
    """Generate a plan ID from name"""
    # Convert to lowercase, replace spaces with underscores
    base_id = name.lower().replace(" ", "_").replace("-", "_")
    # Remove non-alphanumeric characters except underscores
    base_id = "".join(c for c in base_id if c.isalnum() or c == "_")
    # Add random suffix to ensure uniqueness
    return f"{base_id}_{str(uuid.uuid4())[:8]}"


def validate_plan_update(plan: PlanModel, update_data: Dict[str, object]) -> None:
    """
    Validate that plan updates don't violate business rules
    Raises HTTPException if validation fails
    """
    # Check if plan has active subscriptions
    active_subs = Subscriptions.get_subscriptions_by_plan(plan.id, status="active")

    if len(active_subs) > 0:
        # Has active subscriptions - enforce stricter rules

        # Cannot decrease quotas
        if "quotas" in update_data and update_data["quotas"] is not None:
            old_quotas = plan.quotas or {}
            new_quotas = update_data["quotas"]

            if not isinstance(new_quotas, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="quotas must be an object",
                )

            for key, new_value in new_quotas.items():
                old_value = old_quotas.get(key)
                if (
                    old_value is not None
                    and isinstance(new_value, int)
                    and new_value < old_value
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot decrease quota '{key}' from {old_value} to {new_value} "
                        f"while plan has active subscriptions. Create a new plan instead.",
                    )

        # Warn about price changes (we allow it but log it)
        if "price" in update_data and update_data["price"] != plan.price:
            log.warning(
                f"Changing price of plan {plan.id} from {plan.price} to {update_data['price']} "
                f"while it has {len(active_subs)} active subscriptions"
            )


def detect_changes(
    old_plan: PlanModel, new_data: Dict[str, object]
) -> Dict[str, Dict[str, object]]:
    """Detect what changed between old plan and new data"""
    changes = {}

    for key, new_value in new_data.items():
        old_value = getattr(old_plan, key, None)
        if old_value != new_value:
            changes[key] = {"old": old_value, "new": new_value}

    return changes


def _get_user_wallet_summary(
    user_id: str, ledger_limit: int = 20
) -> UserWalletSummaryResponse:
    wallet = wallet_service.get_or_create_wallet(user_id, BILLING_DEFAULT_CURRENCY)
    wallet_model = WalletModel.model_validate(wallet)
    ledger_entries = [
        entry
        for entry in LedgerEntries.get_entries_by_user(
            user_id, limit=ledger_limit, offset=0
        )
        if entry.wallet_id == wallet.id
    ]
    return UserWalletSummaryResponse(
        user_id=user_id,
        wallet=wallet_model,
        ledger_preview=ledger_entries,
    )


############################
# Plan CRUD Endpoints
############################


@router.get("/plans", response_model=List[PlanStatsModel])
async def get_all_plans_with_stats(admin_user=Depends(get_admin_user)):
    """Get all plans (including inactive) with subscription statistics"""
    try:
        plans = Plans.get_all_plans()
        result = []

        for plan in plans:
            # Get subscription counts
            all_subs = Subscriptions.get_subscriptions_by_plan(plan.id)
            active_subs = [s for s in all_subs if s.status == "active"]
            canceled_subs = [s for s in all_subs if s.status == "canceled"]

            # Calculate MRR (Monthly Recurring Revenue)
            mrr = 0
            if plan.interval == "month":
                mrr = float(plan.price) * len(active_subs)
            elif plan.interval == "year":
                mrr = (float(plan.price) / 12) * len(active_subs)
            elif plan.interval == "week":
                mrr = (float(plan.price) * 4.33) * len(active_subs)  # ~4.33 weeks/month
            elif plan.interval == "day":
                mrr = (float(plan.price) * 30) * len(active_subs)

            result.append(
                PlanStatsModel(
                    plan=plan,
                    active_subscriptions=len(active_subs),
                    canceled_subscriptions=len(canceled_subs),
                    total_subscriptions=len(all_subs),
                    mrr=mrr,
                )
            )

        # Sort by display_order
        result.sort(key=lambda x: x.plan.display_order)
        return result

    except Exception as e:
        log.exception(f"Error getting plans with stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plans",
        )


@router.post("/plans", response_model=PlanModel)
async def create_plan(request: CreatePlanRequest, admin_user=Depends(get_admin_user)):
    """Create a new subscription plan"""
    try:
        # Generate ID if not provided
        plan_id = request.id if request.id else generate_plan_id(request.name)

        # Check if plan with this ID already exists
        existing_plan = Plans.get_plan_by_id(plan_id)
        if existing_plan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Plan with ID '{plan_id}' already exists",
            )

        # Create plan
        now = int(time.time())
        plan_data = {
            "id": plan_id,
            "name": request.name,
            "name_ru": request.name_ru,
            "description": request.description,
            "description_ru": request.description_ru,
            "price": request.price,
            "currency": request.currency,
            "interval": request.interval,
            "quotas": request.quotas,
            "features": request.features,
            "is_active": request.is_active,
            "display_order": request.display_order,
            "created_at": now,
            "updated_at": now,
        }

        plan = Plans.create_plan(plan_data)

        # Audit log
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=AuditAction.PLAN_CREATED,
            entity_type="plan",
            entity_id=plan.id,
            description=f"Created plan '{plan.name}' ({plan.price} {plan.currency}/{plan.interval})",
            audit_metadata={"plan_data": plan_data},
        )

        log.info(f"Admin {admin_user.email} created plan {plan.id}")
        return plan

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error creating plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create plan: {str(e)}",
        )


@router.get("/plans/{plan_id}", response_model=PlanModel)
async def get_plan_by_id(plan_id: str, admin_user=Depends(get_admin_user)):
    """Get specific plan by ID (including inactive)"""
    try:
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )
        return plan

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error getting plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plan",
        )


@router.put("/plans/{plan_id}", response_model=PlanModel)
async def update_plan(
    plan_id: str, request: UpdatePlanRequest, admin_user=Depends(get_admin_user)
):
    """Update existing plan"""
    try:
        # Get existing plan
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        # Prepare update data (only include fields that were provided)
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}

        if not update_data:
            return plan  # Nothing to update

        # Validate update
        validate_plan_update(plan, update_data)

        # Detect changes for audit log
        changes = detect_changes(plan, update_data)

        # Update plan
        update_data["updated_at"] = int(time.time())
        updated_plan = Plans.update_plan_by_id(plan_id, update_data)

        # Audit log
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=AuditAction.PLAN_UPDATED,
            entity_type="plan",
            entity_id=plan_id,
            description=f"Updated plan '{plan.name}'",
            changes=changes,
        )

        log.info(f"Admin {admin_user.email} updated plan {plan_id}")
        return updated_plan

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error updating plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update plan: {str(e)}",
        )


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, admin_user=Depends(get_admin_user)):
    """
    Delete a plan (only if it has no active subscriptions)
    Use PATCH /plans/{id}/toggle to deactivate instead
    """
    try:
        # Get plan
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        # Check for active subscriptions
        active_subs = Subscriptions.get_subscriptions_by_plan(plan_id, status="active")
        if len(active_subs) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete plan with {len(active_subs)} active subscriptions. "
                "Deactivate the plan instead.",
            )

        # Delete plan
        Plans.delete_plan_by_id(plan_id)

        # Audit log
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=AuditAction.PLAN_DELETED,
            entity_type="plan",
            entity_id=plan_id,
            description=f"Deleted plan '{plan.name}'",
        )

        log.info(f"Admin {admin_user.email} deleted plan {plan_id}")
        return {"success": True, "message": f"Plan '{plan_id}' deleted"}

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error deleting plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete plan: {str(e)}",
        )


@router.patch("/plans/{plan_id}/toggle", response_model=PlanModel)
async def toggle_plan_active(plan_id: str, admin_user=Depends(get_admin_user)):
    """Toggle plan active/inactive status"""
    try:
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        # Toggle status
        new_status = not plan.is_active
        updated_plan = Plans.update_plan_by_id(
            plan_id, {"is_active": new_status, "updated_at": int(time.time())}
        )

        # Audit log
        action = (
            AuditAction.PLAN_ACTIVATED if new_status else AuditAction.PLAN_DEACTIVATED
        )
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=action,
            entity_type="plan",
            entity_id=plan_id,
            description=f"{'Activated' if new_status else 'Deactivated'} plan '{plan.name}'",
        )

        log.info(
            f"Admin {admin_user.email} {'activated' if new_status else 'deactivated'} plan {plan_id}"
        )
        return updated_plan

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error toggling plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle plan: {str(e)}",
        )


@router.post("/plans/{plan_id}/duplicate", response_model=PlanModel)
async def duplicate_plan(plan_id: str, admin_user=Depends(get_admin_user)):
    """Duplicate an existing plan with a new ID"""
    try:
        # Get source plan
        source_plan = Plans.get_plan_by_id(plan_id)
        if not source_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        # Generate new ID
        new_id = generate_plan_id(f"{source_plan.name}_copy")

        # Create duplicate
        now = int(time.time())
        plan_data = {
            "id": new_id,
            "name": f"{source_plan.name} (Copy)",
            "name_ru": (
                f"{source_plan.name_ru} (Копия)" if source_plan.name_ru else None
            ),
            "description": source_plan.description,
            "description_ru": source_plan.description_ru,
            "price": source_plan.price,
            "currency": source_plan.currency,
            "interval": source_plan.interval,
            "quotas": source_plan.quotas,
            "features": source_plan.features,
            "is_active": False,  # Start as inactive
            "display_order": source_plan.display_order + 1,
            "created_at": now,
            "updated_at": now,
        }

        new_plan = Plans.create_plan(plan_data)

        # Audit log
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=AuditAction.PLAN_DUPLICATED,
            entity_type="plan",
            entity_id=new_plan.id,
            description=f"Duplicated plan '{source_plan.name}' to '{new_plan.name}'",
            audit_metadata={"source_plan_id": plan_id},
        )

        log.info(f"Admin {admin_user.email} duplicated plan {plan_id} to {new_id}")
        return new_plan

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error duplicating plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to duplicate plan: {str(e)}",
        )


@router.get("/plans/{plan_id}/subscribers", response_model=PaginatedSubscribersResponse)
async def get_plan_subscribers(
    plan_id: str, page: int = 1, page_size: int = 20, admin_user=Depends(get_admin_user)
):
    """Get paginated users subscribed to a plan with usage data"""
    try:
        from open_webui.internal.db import get_db

        # Validate pagination parameters
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100  # Max page size to prevent abuse

        # Verify plan exists
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        quotas = plan.quotas or {}

        # Get all subscriptions
        subscriptions = Subscriptions.get_subscriptions_by_plan(plan_id)
        total = len(subscriptions)

        # Calculate pagination
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        # Slice subscriptions for current page
        page_subscriptions = subscriptions[start_idx:end_idx]

        # Get user details and usage for current page
        items = []
        with get_db() as db:
            for sub in page_subscriptions:
                user = Users.get_user_by_id(sub.user_id)
                if user:
                    # Get usage for current period
                    tokens_input_used = 0
                    tokens_output_used = 0
                    requests_used = 0

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

                    items.append(
                        PlanSubscriberModel(
                            user_id=user.id,
                            email=user.email,
                            name=user.name,
                            profile_image_url=user.profile_image_url,
                            role=user.role,
                            subscription_status=sub.status,
                            subscribed_at=sub.created_at,
                            current_period_start=sub.current_period_start,
                            current_period_end=sub.current_period_end,
                            tokens_input_used=tokens_input_used,
                            tokens_input_limit=quotas.get("tokens_input"),
                            tokens_output_used=tokens_output_used,
                            tokens_output_limit=quotas.get("tokens_output"),
                            requests_used=requests_used,
                            requests_limit=quotas.get("requests"),
                        )
                    )

        return PaginatedSubscribersResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error getting subscribers for plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plan subscribers",
        )


@router.get("/users/{user_id}/subscription")
async def get_user_subscription_info(user_id: str, admin_user=Depends(get_admin_user)):
    """Get subscription info for a specific user with usage data"""
    try:
        from open_webui.internal.db import get_db

        # Verify user exists
        user = Users.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{user_id}' not found",
            )

        # Get user's subscription
        subscription = Subscriptions.get_subscription_by_user_id(user_id)
        if not subscription:
            return {"user_id": user_id, "subscription": None, "plan": None, "usage": {}}

        # Get plan
        plan = Plans.get_plan_by_id(subscription.plan_id)
        quotas = plan.quotas if plan else {}

        # Get usage data
        usage = {}
        with get_db() as db:
            for metric in [
                UsageMetric.TOKENS_INPUT,
                UsageMetric.TOKENS_OUTPUT,
                UsageMetric.REQUESTS,
            ]:
                total = (
                    db.query(func.sum(Usage.amount))
                    .filter(
                        Usage.user_id == user_id,
                        Usage.metric == metric.value,
                        Usage.created_at >= subscription.current_period_start,
                        Usage.created_at <= subscription.current_period_end,
                    )
                    .scalar()
                )
                used = int(total or 0)
                limit = quotas.get(metric.value) if quotas else None

                usage[metric.value] = {
                    "used": used,
                    "limit": limit,
                    "remaining": max(0, limit - used) if limit else None,
                    "percentage": (
                        round((used / limit) * 100, 1) if limit and limit > 0 else None
                    ),
                }

        return {
            "user_id": user_id,
            "subscription": subscription,
            "plan": plan,
            "usage": usage,
        }

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error getting subscription for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user subscription",
        )


@router.get("/users/{user_id}/wallet", response_model=UserWalletSummaryResponse)
async def get_user_wallet_summary(
    user_id: str,
    admin_user=Depends(get_admin_user),
):
    """Get wallet summary and recent ledger entries for a specific user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    user = Users.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found",
        )

    try:
        return _get_user_wallet_summary(user_id)
    except WalletError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        log.exception(f"Error getting wallet summary for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user wallet summary",
        )


@router.post("/users/{user_id}/wallet/adjust", response_model=AdjustUserWalletResponse)
async def adjust_user_wallet(
    user_id: str,
    request: AdjustUserWalletRequest,
    admin_user=Depends(get_admin_user),
):
    """Apply admin wallet adjustment for a specific user."""
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )

    user = Users.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found",
        )

    delta_topup = int(request.delta_topup_kopeks)
    delta_included = int(request.delta_included_kopeks)
    if delta_topup == 0 and delta_included == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one balance delta must be non-zero",
        )

    reason = request.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason is required",
        )

    wallet_before = wallet_service.get_or_create_wallet(
        user_id, BILLING_DEFAULT_CURRENCY
    )
    before_topup = int(wallet_before.balance_topup_kopeks)
    before_included = int(wallet_before.balance_included_kopeks)

    try:
        ledger_entry = wallet_service.adjust_balances(
            wallet_id=wallet_before.id,
            delta_topup_kopeks=delta_topup,
            delta_included_kopeks=delta_included,
            reason=reason,
            admin_user_id=admin_user.id,
            idempotency_key=request.idempotency_key,
            reference_id=request.reference_id,
        )
        summary = _get_user_wallet_summary(user_id)

        AuditLogs.create_log(
            user_id=admin_user.id,
            action=AuditAction.WALLET_ADJUSTED,
            entity_type="wallet",
            entity_id=summary.wallet.id,
            description=f"Adjusted wallet for user '{user.email}'",
            changes={
                "balance_topup_kopeks": {
                    "old": before_topup,
                    "new": summary.wallet.balance_topup_kopeks,
                },
                "balance_included_kopeks": {
                    "old": before_included,
                    "new": summary.wallet.balance_included_kopeks,
                },
            },
            audit_metadata={
                "target_user_id": user.id,
                "delta_topup_kopeks": delta_topup,
                "delta_included_kopeks": delta_included,
                "reason": reason,
                "ledger_entry_id": ledger_entry.id,
                "idempotency_key": request.idempotency_key,
            },
        )

        return AdjustUserWalletResponse(
            success=True,
            wallet=summary.wallet,
            ledger_entry=LedgerEntryModel.model_validate(ledger_entry),
        )
    except WalletError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error adjusting wallet for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to adjust user wallet",
        )


class ChangeUserPlanRequest(BaseModel):
    """Request to change user's subscription plan"""

    plan_id: str
    reset_usage: bool = False  # Whether to reset usage counters


@router.put("/users/{user_id}/subscription")
async def change_user_subscription(
    user_id: str, request: ChangeUserPlanRequest, admin_user=Depends(get_admin_user)
):
    """Change user's subscription plan (admin only)"""
    try:
        from open_webui.internal.db import get_db
        from open_webui.models.billing import Subscription, SubscriptionStatus

        # Verify user exists
        user = Users.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{user_id}' not found",
            )

        # Verify new plan exists
        new_plan = Plans.get_plan_by_id(request.plan_id)
        if not new_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{request.plan_id}' not found",
            )

        with get_db() as db:
            # Get or create subscription
            subscription = (
                db.query(Subscription).filter(Subscription.user_id == user_id).first()
            )

            current_time = int(time.time())

            # Calculate period based on plan interval
            interval_seconds = {
                "day": 86400,
                "week": 604800,
                "month": 2592000,  # 30 days
                "year": 31536000,  # 365 days
            }
            period_duration = interval_seconds.get(new_plan.interval, 2592000)

            if subscription:
                old_plan_id = subscription.plan_id

                # Update existing subscription
                subscription.plan_id = request.plan_id
                subscription.status = SubscriptionStatus.ACTIVE.value
                subscription.current_period_start = current_time
                subscription.current_period_end = current_time + period_duration
                subscription.updated_at = current_time

                # Reset usage if requested
                if request.reset_usage:
                    from open_webui.models.billing import Usage

                    db.query(Usage).filter(
                        Usage.user_id == user_id,
                        Usage.created_at >= subscription.current_period_start,
                    ).delete()

                db.commit()
                db.refresh(subscription)

                log.info(
                    f"Admin {admin_user.email} changed plan for user {user.email}: {old_plan_id} -> {request.plan_id}"
                )

                # Audit log
                AuditLogs.create_log(
                    user_id=admin_user.id,
                    action=AuditAction.SUBSCRIPTION_PLAN_CHANGED,
                    entity_type="subscription",
                    entity_id=subscription.id,
                    description=(
                        f"Changed subscription plan for user {user.email} "
                        f"from {old_plan_id} to {request.plan_id}"
                    ),
                    audit_metadata={
                        "target_user_id": user_id,
                        "old_plan_id": old_plan_id,
                        "new_plan_id": request.plan_id,
                        "reset_usage": request.reset_usage,
                    },
                )
            else:
                # Create new subscription
                new_subscription = Subscription(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    plan_id=request.plan_id,
                    status=SubscriptionStatus.ACTIVE.value,
                    current_period_start=current_time,
                    current_period_end=current_time + period_duration,
                    created_at=current_time,
                    updated_at=current_time,
                )
                db.add(new_subscription)
                db.commit()
                db.refresh(new_subscription)
                subscription = new_subscription

                log.info(
                    f"Admin {admin_user.email} created subscription for user {user.email}: plan {request.plan_id}"
                )

                # Audit log
                AuditLogs.create_log(
                    user_id=admin_user.id,
                    action=AuditAction.SUBSCRIPTION_CREATED,
                    entity_type="subscription",
                    entity_id=subscription.id,
                    description=(
                        f"Created subscription for user {user.email} "
                        f"with plan {request.plan_id}"
                    ),
                    audit_metadata={
                        "target_user_id": user_id,
                        "plan_id": request.plan_id,
                    },
                )

            return {
                "success": True,
                "subscription": {
                    "id": subscription.id,
                    "user_id": subscription.user_id,
                    "plan_id": subscription.plan_id,
                    "status": subscription.status,
                    "current_period_start": subscription.current_period_start,
                    "current_period_end": subscription.current_period_end,
                },
                "plan": new_plan,
            }

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error changing subscription for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change user subscription",
        )
