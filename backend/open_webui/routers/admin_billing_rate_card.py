"""
Admin billing rate card endpoints.
Manage model pricing entries and sync defaults.
"""

import logging
import time
import uuid
from typing import Dict, List, Optional, Set, Tuple

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from open_webui.env import BILLING_RATE_CARD_VERSION, ENABLE_BILLING_WALLET, SRC_LOG_LEVELS
from open_webui.models.billing import PricingRateCardModel, RateCards
from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models
from open_webui.utils.auth import get_admin_user
from open_webui.utils.models import get_all_base_models
from open_webui.utils.rate_card_templates import build_rate_cards_for_model
from open_webui.utils.rate_card_xlsx import (
    XlsxExportMode,
    XlsxImportMode,
    build_export_workbook,
    compute_import_plan,
    parse_import_workbook,
    parse_scope_model_ids,
)

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
    version: Optional[str] = None
    provider: Optional[str] = None
    is_default: bool = False
    is_active: bool = True


class RateCardUpdateRequest(BaseModel):
    model_tier: Optional[str] = None
    raw_cost_per_unit_kopeks: Optional[int] = Field(None, ge=0)
    provider: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class RateCardBulkDeleteRequest(BaseModel):
    rate_card_ids: List[str] = Field(default_factory=list)


class RateCardDeleteModelsRequest(BaseModel):
    model_ids: List[str] = Field(default_factory=list)


class RateCardDeleteResponse(BaseModel):
    deleted: int


class RateCardDeactivateResponse(BaseModel):
    deactivated: int


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
    provider: Optional[str] = None
    model_tier: Optional[str] = None
    is_active: bool = True
    is_default: bool = True


class RateCardSyncResponse(BaseModel):
    created: int
    skipped: int
    model_ids: List[str]


class RateCardXlsxImportSummary(BaseModel):
    rows_total: int
    rows_valid: int
    rows_invalid: int
    creates: int
    updates_via_create: int
    deactivations: int
    noops: int
    skipped_unknown_model: int
    skipped_out_of_scope: int


class RateCardXlsxImportWarning(BaseModel):
    row_number: int
    code: str
    message: str
    model_id: Optional[str] = None


class RateCardXlsxImportError(BaseModel):
    code: str
    message: str
    row_number: Optional[int] = None
    column: Optional[str] = None


class RateCardXlsxImportPreviewResponse(BaseModel):
    summary: RateCardXlsxImportSummary
    warnings: List[RateCardXlsxImportWarning] = Field(default_factory=list)
    errors: List[RateCardXlsxImportError] = Field(default_factory=list)
    actions_preview: List[dict] = Field(default_factory=list)


class RateCardXlsxImportApplyResponse(BaseModel):
    summary: RateCardXlsxImportSummary
    warnings: List[RateCardXlsxImportWarning] = Field(default_factory=list)
    errors: List[RateCardXlsxImportError] = Field(default_factory=list)


def ensure_wallet_enabled() -> None:
    if not ENABLE_BILLING_WALLET:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing wallet is disabled",
        )


async def _get_rate_card_import_known_models(
    request: Request,
    *,
    admin_user,
) -> Tuple[Set[str], Dict[str, str], Set[str]]:
    """Return (known_model_ids, model_names_by_id, db_base_model_ids).

    XLSX import is used on the Rate Cards page which supports provider-only models.
    Those models may exist in `/api/models/base` but not yet be persisted as base models
    in the workspace DB. For import UX parity, treat provider base models as "known".
    """

    db_base_models = await run_in_threadpool(Models.get_base_models)
    db_base_model_ids = {model.id for model in db_base_models}

    known_model_ids = set(db_base_model_ids)
    model_names_by_id: Dict[str, str] = {
        model.id: (model.name or model.id) for model in db_base_models
    }

    try:
        provider_base_models = await get_all_base_models(request, user=admin_user)
    except Exception as e:
        log.debug(f"Failed to fetch provider base models for import: {e}")
        provider_base_models = []

    for item in provider_base_models:
        model_id = (item.get("id") or "").strip()
        if not model_id:
            continue
        known_model_ids.add(model_id)
        model_names_by_id.setdefault(model_id, (item.get("name") or model_id))

    return known_model_ids, model_names_by_id, db_base_model_ids


async def _ensure_base_models_exist(
    *,
    model_ids: Set[str],
    model_names_by_id: Dict[str, str],
    owner_user_id: str,
) -> None:
    for model_id in sorted(model_ids):
        existing = await run_in_threadpool(Models.get_model_by_id, model_id)
        if existing is not None:
            continue

        await run_in_threadpool(
            Models.insert_new_model,
            ModelForm(
                id=model_id,
                base_model_id=None,
                name=model_names_by_id.get(model_id, model_id),
                meta=ModelMeta(),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            owner_user_id,
        )


@router.get("/rate-card/export-xlsx")
async def export_rate_cards_xlsx(
    model_ids: List[str] = Query(default_factory=list),
    mode: XlsxExportMode = XlsxExportMode.ACTIVE_ONLY,
    admin_user=Depends(get_admin_user),
):
    """Export rate cards to XLSX.

    Always exports for current BILLING_RATE_CARD_VERSION.
    """

    ensure_wallet_enabled()

    clean_model_ids = [model_id.strip() for model_id in model_ids if model_id.strip()]
    if not clean_model_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_ids is required",
        )

    try:
        base_models = await run_in_threadpool(Models.get_base_models)
        model_names: Dict[str, str] = {
            model.id: (model.name or model.id) for model in base_models
        }

        entries = await run_in_threadpool(
            RateCards.list_rate_cards_by_model_ids,
            clean_model_ids,
            True,
            None,
            0,
        )
        entries = [
            entry
            for entry in entries
            if entry.version == BILLING_RATE_CARD_VERSION and entry.is_active
        ]

        content = await run_in_threadpool(
            build_export_workbook,
            mode=mode,
            model_ids=clean_model_ids,
            model_names=model_names,
            active_entries=entries,
        )

        return Response(
            content=content,
            media_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            headers={
                "Content-Disposition": "attachment; filename=rate-cards.xlsx",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error exporting rate cards XLSX: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export rate cards",
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
    created_at = int(time.time())

    existing = await run_in_threadpool(
        RateCards.get_rate_card_by_unique,
        request.model_id,
        request.modality,
        request.unit,
        version,
        created_at,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rate card entry already exists for this timestamp",
        )

    entry_data = {
        "id": request.id or str(uuid.uuid4()),
        "model_id": request.model_id,
        "model_tier": request.model_tier,
        "modality": request.modality,
        "unit": request.unit,
        "raw_cost_per_unit_kopeks": request.raw_cost_per_unit_kopeks,
        "version": version,
        "created_at": created_at,
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

    created_at = int(time.time())

    try:
        if "raw_cost_per_unit_kopeks" in updates:
            entry_data = {
                "id": str(uuid.uuid4()),
                "model_id": existing.model_id,
                "model_tier": updates.get("model_tier", existing.model_tier),
                "modality": existing.modality,
                "unit": existing.unit,
                "raw_cost_per_unit_kopeks": updates["raw_cost_per_unit_kopeks"],
                "version": existing.version,
                "created_at": created_at,
                "provider": updates.get("provider", existing.provider),
                "is_default": updates.get("is_default", existing.is_default),
                "is_active": updates.get("is_active", True),
            }
            created = await run_in_threadpool(RateCards.create_rate_card, entry_data)
            await run_in_threadpool(
                RateCards.update_rate_card, rate_card_id, {"is_active": False}
            )
            return created

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


@router.delete("/rate-card/{rate_card_id}", response_model=bool)
async def delete_rate_card(rate_card_id: str, admin_user=Depends(get_admin_user)):
    """Delete a rate card entry."""
    ensure_wallet_enabled()

    try:
        deleted = await run_in_threadpool(RateCards.delete_rate_card, rate_card_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rate card entry not found",
            )
        return deleted
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"Error deleting rate card: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete rate card",
        )


@router.post("/rate-card/bulk-delete", response_model=RateCardDeleteResponse)
async def bulk_delete_rate_cards(
    request: RateCardBulkDeleteRequest, admin_user=Depends(get_admin_user)
):
    """Delete multiple rate card entries by ID."""
    ensure_wallet_enabled()

    rate_card_ids = [rate_card_id.strip() for rate_card_id in request.rate_card_ids]
    rate_card_ids = [rate_card_id for rate_card_id in rate_card_ids if rate_card_id]
    if not rate_card_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rate_card_ids is required",
        )

    try:
        deleted = await run_in_threadpool(
            RateCards.delete_rate_cards_by_ids, rate_card_ids
        )
        return RateCardDeleteResponse(deleted=deleted)
    except Exception as e:
        log.exception(f"Error deleting rate cards: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete rate cards",
        )


@router.post("/rate-card/delete-models", response_model=RateCardDeleteResponse)
async def delete_rate_cards_by_model_ids(
    request: RateCardDeleteModelsRequest, admin_user=Depends(get_admin_user)
):
    """Delete rate card entries for one or more models."""
    ensure_wallet_enabled()

    model_ids = [model_id.strip() for model_id in request.model_ids]
    model_ids = [model_id for model_id in model_ids if model_id]
    if not model_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_ids is required",
        )

    try:
        deleted = await run_in_threadpool(
            RateCards.delete_rate_cards_by_model_ids, model_ids
        )
        return RateCardDeleteResponse(deleted=deleted)
    except Exception as e:
        log.exception(f"Error deleting model rate cards: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete rate cards",
        )


@router.post("/rate-card/deactivate-models", response_model=RateCardDeactivateResponse)
async def deactivate_rate_cards_by_model_ids(
    request: RateCardDeleteModelsRequest, admin_user=Depends(get_admin_user)
):
    """Deactivate rate card entries for one or more models."""
    ensure_wallet_enabled()

    model_ids = [model_id.strip() for model_id in request.model_ids]
    model_ids = [model_id for model_id in model_ids if model_id]
    if not model_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_ids is required",
        )

    try:
        deactivated = await run_in_threadpool(
            RateCards.deactivate_rate_cards_by_model_ids, model_ids
        )
        return RateCardDeactivateResponse(deactivated=deactivated)
    except Exception as e:
        log.exception(f"Error deactivating model rate cards: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate rate cards",
        )


@router.post("/rate-card/sync-models", response_model=RateCardSyncResponse)
async def sync_rate_cards_for_models(
    request: RateCardSyncRequest, admin_user=Depends(get_admin_user)
):
    """Create default rate card entries for models missing pricing."""
    ensure_wallet_enabled()

    version = request.version or BILLING_RATE_CARD_VERSION
    created_at = int(time.time())
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
            created_at,
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


@router.post("/rate-card/import-xlsx/preview", response_model=RateCardXlsxImportPreviewResponse)

async def import_rate_cards_xlsx_preview(
    request: Request,
    file: UploadFile = File(...),
    mode: XlsxImportMode = Form(XlsxImportMode.PATCH),
    scope_model_ids: str = Form(...),
    admin_user=Depends(get_admin_user),
):
    ensure_wallet_enabled()

    parsed_scope, scope_error = parse_scope_model_ids(scope_model_ids)
    if scope_error or parsed_scope is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=scope_error or "scope_model_ids is required",
        )

    try:
        file_bytes = await file.read()
    except Exception as e:
        log.exception(f"Error reading XLSX file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read XLSX file",
        )

    rows, parse_errors = await run_in_threadpool(parse_import_workbook, file_bytes)
    if parse_errors:
        return RateCardXlsxImportPreviewResponse(
            summary=RateCardXlsxImportSummary(
                rows_total=0,
                rows_valid=0,
                rows_invalid=len(parse_errors),
                creates=0,
                updates_via_create=0,
                deactivations=0,
                noops=0,
                skipped_unknown_model=0,
                skipped_out_of_scope=0,
            ),
            warnings=[],
            errors=[RateCardXlsxImportError(**err.__dict__) for err in parse_errors],
            actions_preview=[],
        )

    known_model_ids, _, _ = await _get_rate_card_import_known_models(
        request, admin_user=admin_user
    )

    active_entries = await run_in_threadpool(
        RateCards.list_rate_cards_by_model_ids,
        parsed_scope or [],
        True,
        None,
        0,
    )
    active_entries = [
        entry
        for entry in active_entries
        if entry.version == BILLING_RATE_CARD_VERSION and entry.is_active
    ]

    summary, warnings, plan_errors, actions = await run_in_threadpool(
        compute_import_plan,
        rows=rows,
        import_mode=mode,
        scope_model_ids=parsed_scope or [],
        known_model_ids=known_model_ids,
        current_active_entries=active_entries,
        base_errors=parse_errors,
    )

    preview_actions = [action.__dict__ for action in actions[:200]]

    return RateCardXlsxImportPreviewResponse(
        summary=RateCardXlsxImportSummary(**summary.__dict__),
        warnings=[RateCardXlsxImportWarning(**w.__dict__) for w in warnings],
        errors=[RateCardXlsxImportError(**e.__dict__) for e in plan_errors],
        actions_preview=preview_actions,
    )


@router.post("/rate-card/import-xlsx/apply", response_model=RateCardXlsxImportApplyResponse)
async def import_rate_cards_xlsx_apply(
    request: Request,
    file: UploadFile = File(...),
    mode: XlsxImportMode = Form(XlsxImportMode.PATCH),
    scope_model_ids: str = Form(...),
    admin_user=Depends(get_admin_user),
):
    ensure_wallet_enabled()

    parsed_scope, scope_error = parse_scope_model_ids(scope_model_ids)
    if scope_error or parsed_scope is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=scope_error or "scope_model_ids is required",
        )

    try:
        file_bytes = await file.read()
    except Exception as e:
        log.exception(f"Error reading XLSX file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read XLSX file",
        )

    rows, parse_errors = await run_in_threadpool(parse_import_workbook, file_bytes)
    if parse_errors:
        # Spec: Apply returns 400 with the same structured error shape as preview.
        payload = RateCardXlsxImportApplyResponse(
            summary=RateCardXlsxImportSummary(
                rows_total=0,
                rows_valid=0,
                rows_invalid=len(parse_errors),
                creates=0,
                updates_via_create=0,
                deactivations=0,
                noops=0,
                skipped_unknown_model=0,
                skipped_out_of_scope=0,
            ),
            warnings=[],
            errors=[RateCardXlsxImportError(**err.__dict__) for err in parse_errors],
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=payload.model_dump())

    known_model_ids, model_names_by_id, db_base_model_ids = (
        await _get_rate_card_import_known_models(request, admin_user=admin_user)
    )

    active_entries = await run_in_threadpool(
        RateCards.list_rate_cards_by_model_ids,
        parsed_scope or [],
        True,
        None,
        0,
    )
    active_entries = [
        entry
        for entry in active_entries
        if entry.version == BILLING_RATE_CARD_VERSION and entry.is_active
    ]

    summary, warnings, plan_errors, actions = await run_in_threadpool(
        compute_import_plan,
        rows=rows,
        import_mode=mode,
        scope_model_ids=parsed_scope or [],
        known_model_ids=known_model_ids,
        current_active_entries=active_entries,
        base_errors=(),
    )

    if plan_errors:
        # Spec: Apply returns 400 with the same structured error shape as preview.
        payload = RateCardXlsxImportApplyResponse(
            summary=RateCardXlsxImportSummary(**summary.__dict__),
            warnings=[RateCardXlsxImportWarning(**w.__dict__) for w in warnings],
            errors=[RateCardXlsxImportError(**e.__dict__) for e in plan_errors],
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=payload.model_dump())

    scope_set = set(parsed_scope or [])
    imported_model_ids = {
        row.model_id
        for row in rows
        if row.model_id
        and row.model_id in scope_set
        and row.model_id in known_model_ids
        and row.model_id not in db_base_model_ids
    }
    if imported_model_ids:
        await _ensure_base_models_exist(
            model_ids=imported_model_ids,
            model_names_by_id=model_names_by_id,
            owner_user_id=admin_user.id,
        )

    now = int(time.time())

    def _next_created_at(model_id: str, modality: str, unit: str) -> int:
        created_at = now
        while RateCards.get_rate_card_by_unique(
            model_id,
            modality,
            unit,
            BILLING_RATE_CARD_VERSION,
            created_at,
        ):
            created_at += 1
        return created_at

    for action in actions:
        key = f"{action.model_id}:{action.modality}:{action.unit}"
        existing_active = next(
            (
                entry
                for entry in active_entries
                if f"{entry.model_id}:{entry.modality}:{entry.unit}" == key
            ),
            None,
        )

        if action.action == "create":
            entry_data = {
                "id": str(uuid.uuid4()),
                "model_id": action.model_id,
                "model_tier": (
                    action.model_tier
                    if action.model_tier is not None
                    else (existing_active.model_tier if existing_active else None)
                ),
                "modality": action.modality,
                "unit": action.unit,
                "raw_cost_per_unit_kopeks": int(action.desired_price or 0),
                "version": BILLING_RATE_CARD_VERSION,
                "created_at": _next_created_at(action.model_id, action.modality, action.unit),
                "provider": (
                    action.provider
                    if action.provider is not None
                    else (existing_active.provider if existing_active else None)
                ),
                "is_default": (
                    bool(action.is_default)
                    if action.is_default is not None
                    else (bool(existing_active.is_default) if existing_active else False)
                ),
                "is_active": True,
            }
            await run_in_threadpool(RateCards.create_rate_card, entry_data)

        elif action.action == "update_via_create":
            entry_data = {
                "id": str(uuid.uuid4()),
                "model_id": action.model_id,
                "model_tier": (
                    action.model_tier
                    if action.model_tier is not None
                    else (existing_active.model_tier if existing_active else None)
                ),
                "modality": action.modality,
                "unit": action.unit,
                "raw_cost_per_unit_kopeks": int(action.desired_price or 0),
                "version": BILLING_RATE_CARD_VERSION,
                "created_at": _next_created_at(action.model_id, action.modality, action.unit),
                "provider": (
                    action.provider
                    if action.provider is not None
                    else (existing_active.provider if existing_active else None)
                ),
                "is_default": (
                    bool(action.is_default)
                    if action.is_default is not None
                    else (bool(existing_active.is_default) if existing_active else False)
                ),
                "is_active": True,
            }
            created = await run_in_threadpool(RateCards.create_rate_card, entry_data)
            if existing_active:
                await run_in_threadpool(
                    RateCards.update_rate_card,
                    existing_active.id,
                    {"is_active": False},
                )
                active_entries = [
                    entry
                    for entry in active_entries
                    if entry.id != existing_active.id
                ]
            active_entries.append(created)

        elif action.action == "deactivate":
            if existing_active:
                await run_in_threadpool(
                    RateCards.update_rate_card,
                    existing_active.id,
                    {"is_active": False},
                )
                active_entries = [
                    entry
                    for entry in active_entries
                    if entry.id != existing_active.id
                ]

    return RateCardXlsxImportApplyResponse(
        summary=RateCardXlsxImportSummary(**summary.__dict__),
        warnings=[RateCardXlsxImportWarning(**w.__dict__) for w in warnings],
        errors=[],
    )


def _sync_rate_cards_for_models(
    model_ids: List[str],
    allowed_units: Optional[List[tuple[str, str]]],
    version: str,
    created_at: int,
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
            created_at=created_at,
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
