"""
Admin billing rate card endpoints.
Manage model pricing entries and sync defaults.
"""

import logging
import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from open_webui.env import BILLING_RATE_CARD_VERSION, ENABLE_BILLING_WALLET, SRC_LOG_LEVELS
from open_webui.models.billing import PricingRateCardModel, RateCards
from open_webui.models.billing_wallet import JsonDict
from open_webui.models.models import Models
from open_webui.utils.auth import get_admin_user
from open_webui.utils.rate_card_templates import build_rate_cards_for_model

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()


class ModalityUnitRequest(BaseModel):
    modality: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1)


class RateCardCreateRequest(BaseModel):
    id: Optional[str] = None
    model_id: str = Field(..., min_length=1)
    model_tier: Optional[str] = None
    modality: str = Field(..., min_length=1)
    unit: str = Field(..., min_length=1)
    raw_cost_per_unit_kopeks: int = Field(0, ge=0)
    platform_factor: float = Field(1.0, ge=0)
    fixed_fee_kopeks: int = Field(0, ge=0)
    min_charge_kopeks: int = Field(0, ge=0)
    rounding_rules_json: Optional[JsonDict] = None
    version: Optional[str] = None
    effective_from: Optional[int] = None
    effective_to: Optional[int] = None
    provider: Optional[str] = None
    is_default: bool = False
    is_active: bool = True


class RateCardUpdateRequest(BaseModel):
    model_tier: Optional[str] = None
    raw_cost_per_unit_kopeks: Optional[int] = Field(None, ge=0)
    platform_factor: Optional[float] = Field(None, ge=0)
    fixed_fee_kopeks: Optional[int] = Field(None, ge=0)
    min_charge_kopeks: Optional[int] = Field(None, ge=0)
    rounding_rules_json: Optional[JsonDict] = None
    effective_to: Optional[int] = None
    provider: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class RateCardListResponse(BaseModel):
    items: List[PricingRateCardModel]
    total: int
    page: int
    page_size: int
    total_pages: int


class RateCardSyncRequest(BaseModel):
    model_ids: Optional[List[str]] = None
    modality_units: Optional[List[ModalityUnitRequest]] = None
    version: Optional[str] = None
    effective_from: Optional[int] = None
    provider: Optional[str] = None
    model_tier: Optional[str] = None
    is_active: bool = True
    is_default: bool = True


class RateCardSyncResponse(BaseModel):
    created: int
    skipped: int
    model_ids: List[str]


def ensure_wallet_enabled() -> None:
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )


@router.get("/rate-card", response_model=RateCardListResponse)
async def list_rate_cards(
    model_id: Optional[str] = None,
    modality: Optional[str] = None,
    unit: Optional[str] = None,
    version: Optional[str] = None,
    provider: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
    admin_user=Depends(get_admin_user),
):
    """List rate card entries with filters."""
    ensure_wallet_enabled()

    safe_page = max(page, 1)
    safe_page_size = max(1, min(page_size, 200))
    offset = (safe_page - 1) * safe_page_size

    try:
        items = await run_in_threadpool(
            RateCards.list_rate_cards,
            model_id,
            modality,
            unit,
            version,
            provider,
            is_active,
            safe_page_size,
            offset,
        )
        total = await run_in_threadpool(
            RateCards.count_rate_cards,
            model_id,
            modality,
            unit,
            version,
            provider,
            is_active,
        )
    except Exception as e:
        log.exception(f"Error listing rate cards: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list rate cards",
        )

    total_pages = (total + safe_page_size - 1) // safe_page_size if total else 1
    return RateCardListResponse(
        items=items,
        total=total,
        page=safe_page,
        page_size=safe_page_size,
        total_pages=total_pages,
    )


@router.get("/rate-card/{rate_card_id}", response_model=PricingRateCardModel)
async def get_rate_card(rate_card_id: str, admin_user=Depends(get_admin_user)):
    """Get rate card entry by ID."""
    ensure_wallet_enabled()

    entry = await run_in_threadpool(RateCards.get_rate_card_by_id, rate_card_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate card entry not found",
        )
    return entry


@router.post(
    "/rate-card",
    response_model=PricingRateCardModel,
    status_code=status.HTTP_201_CREATED,
)
async def create_rate_card(
    request: RateCardCreateRequest, admin_user=Depends(get_admin_user)
):
    """Create a rate card entry."""
    ensure_wallet_enabled()

    version = request.version or BILLING_RATE_CARD_VERSION
    effective_from = request.effective_from or int(time.time())
    if request.effective_to and request.effective_to < effective_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="effective_to must be >= effective_from",
        )

    existing = await run_in_threadpool(
        RateCards.get_rate_card_by_unique,
        request.model_id,
        request.modality,
        request.unit,
        version,
        effective_from,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rate card entry already exists for this effective date",
        )

    entry_data = {
        "id": request.id or str(uuid.uuid4()),
        "model_id": request.model_id,
        "model_tier": request.model_tier,
        "modality": request.modality,
        "unit": request.unit,
        "raw_cost_per_unit_kopeks": request.raw_cost_per_unit_kopeks,
        "platform_factor": request.platform_factor,
        "fixed_fee_kopeks": request.fixed_fee_kopeks,
        "min_charge_kopeks": request.min_charge_kopeks,
        "rounding_rules_json": request.rounding_rules_json,
        "version": version,
        "effective_from": effective_from,
        "effective_to": request.effective_to,
        "provider": request.provider,
        "is_default": request.is_default,
        "is_active": request.is_active,
    }

    try:
        return await run_in_threadpool(RateCards.create_rate_card, entry_data)
    except Exception as e:
        log.exception(f"Error creating rate card: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create rate card",
        )


@router.patch("/rate-card/{rate_card_id}", response_model=PricingRateCardModel)
async def update_rate_card(
    rate_card_id: str,
    request: RateCardUpdateRequest,
    admin_user=Depends(get_admin_user),
):
    """Update a rate card entry."""
    ensure_wallet_enabled()

    updates = request.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    existing = await run_in_threadpool(RateCards.get_rate_card_by_id, rate_card_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate card entry not found",
        )

    if updates.get("effective_to") is not None:
        effective_to = int(updates["effective_to"])
        if effective_to < existing.effective_from:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="effective_to must be >= effective_from",
            )

    try:
        updated = await run_in_threadpool(
            RateCards.update_rate_card, rate_card_id, updates
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rate card entry not found",
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error updating rate card: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update rate card",
        )


@router.post("/rate-card/sync-models", response_model=RateCardSyncResponse)
async def sync_rate_cards_for_models(
    request: RateCardSyncRequest, admin_user=Depends(get_admin_user)
):
    """Create default rate card entries for models missing pricing."""
    ensure_wallet_enabled()

    version = request.version or BILLING_RATE_CARD_VERSION
    effective_from = request.effective_from or int(time.time())
    allowed_units = None
    if request.modality_units:
        allowed_units = [
            (item.modality, item.unit) for item in request.modality_units
        ]

    try:
        if request.model_ids:
            model_ids = request.model_ids
        else:
            base_models = await run_in_threadpool(Models.get_base_models)
            model_ids = [model.id for model in base_models if model.is_active]

        created, skipped = await run_in_threadpool(
            _sync_rate_cards_for_models,
            model_ids,
            allowed_units,
            version,
            effective_from,
            request.provider,
            request.model_tier,
            request.is_active,
            request.is_default,
        )

        return RateCardSyncResponse(created=created, skipped=skipped, model_ids=model_ids)
    except Exception as e:
        log.exception(f"Error syncing rate cards: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync rate cards",
        )


def _sync_rate_cards_for_models(
    model_ids: List[str],
    allowed_units: Optional[List[tuple[str, str]]],
    version: str,
    effective_from: int,
    provider: Optional[str],
    model_tier: Optional[str],
    is_active: bool,
    is_default: bool,
) -> tuple[int, int]:
    created = 0
    skipped = 0
    for model_id in model_ids:
        templates = build_rate_cards_for_model(
            model_id=model_id,
            model_tier=model_tier,
            provider=provider,
            version=version,
            effective_from=effective_from,
            is_active=is_active,
            is_default=is_default,
            allowed_units=allowed_units,
        )
        for template in templates:
            modality = str(template.get("modality", ""))
            unit = str(template.get("unit", ""))
            if RateCards.get_rate_card_by_version(model_id, modality, unit, version):
                skipped += 1
                continue
            RateCards.create_rate_card(template)
            created += 1
    return created, skipped
