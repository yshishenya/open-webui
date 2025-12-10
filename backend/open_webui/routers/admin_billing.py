"""
Admin Billing API endpoints
Only accessible by administrators for managing billing plans
"""

import logging
import time
import uuid
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from open_webui.models.billing import PlanModel, Plans, Subscriptions
from open_webui.models.audit import AuditAction, AuditLogs
from open_webui.utils.auth import get_admin_user
from open_webui.models.users import Users
from open_webui.env import SRC_LOG_LEVELS

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
    subscription_status: str
    subscribed_at: int
    current_period_end: int


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


def validate_plan_update(plan: PlanModel, update_data: Dict[str, Any]) -> None:
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

            for key, new_value in new_quotas.items():
                old_value = old_quotas.get(key)
                if old_value is not None and new_value < old_value:
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


def detect_changes(old_plan: PlanModel, new_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Detect what changed between old plan and new data"""
    changes = {}

    for key, new_value in new_data.items():
        old_value = getattr(old_plan, key, None)
        if old_value != new_value:
            changes[key] = {"old": old_value, "new": new_value}

    return changes


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
            metadata={"plan_data": plan_data},
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
        update_data = {
            k: v for k, v in request.model_dump().items() if v is not None
        }

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
        action = AuditAction.PLAN_ACTIVATED if new_status else AuditAction.PLAN_DEACTIVATED
        AuditLogs.create_log(
            user_id=admin_user.id,
            action=action,
            entity_type="plan",
            entity_id=plan_id,
            description=f"{'Activated' if new_status else 'Deactivated'} plan '{plan.name}'",
        )

        log.info(f"Admin {admin_user.email} {'activated' if new_status else 'deactivated'} plan {plan_id}")
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
            "name_ru": f"{source_plan.name_ru} (Копия)" if source_plan.name_ru else None,
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
            metadata={"source_plan_id": plan_id},
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


@router.get("/plans/{plan_id}/subscribers", response_model=List[PlanSubscriberModel])
async def get_plan_subscribers(plan_id: str, admin_user=Depends(get_admin_user)):
    """Get all users subscribed to a plan"""
    try:
        # Verify plan exists
        plan = Plans.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plan '{plan_id}' not found",
            )

        # Get all subscriptions
        subscriptions = Subscriptions.get_subscriptions_by_plan(plan_id)

        # Get user details
        result = []
        for sub in subscriptions:
            user = Users.get_user_by_id(sub.user_id)
            if user:
                result.append(
                    PlanSubscriberModel(
                        user_id=user.id,
                        email=user.email,
                        name=user.name,
                        subscription_status=sub.status,
                        subscribed_at=sub.created_at,
                        current_period_end=sub.current_period_end,
                    )
                )

        return result

    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error getting subscribers for plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get plan subscribers",
        )
