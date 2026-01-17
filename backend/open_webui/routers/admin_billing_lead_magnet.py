"""
Admin endpoints for lead magnet configuration.
"""

import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from open_webui.utils.auth import get_admin_user
from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

router = APIRouter()


class LeadMagnetQuotas(BaseModel):
    tokens_input: int = Field(0, ge=0)
    tokens_output: int = Field(0, ge=0)
    images: int = Field(0, ge=0)
    tts_seconds: int = Field(0, ge=0)
    stt_seconds: int = Field(0, ge=0)


class LeadMagnetConfigResponse(BaseModel):
    enabled: bool
    cycle_days: int
    quotas: LeadMagnetQuotas
    config_version: int


class LeadMagnetConfigRequest(BaseModel):
    enabled: bool
    cycle_days: int = Field(..., ge=1)
    quotas: LeadMagnetQuotas


@router.get("/lead-magnet", response_model=LeadMagnetConfigResponse)
async def get_lead_magnet_config(
    request: Request, admin_user=Depends(get_admin_user)
) -> LeadMagnetConfigResponse:
    config = request.app.state.config
    quotas = config.LEAD_MAGNET_QUOTAS or {}
    return LeadMagnetConfigResponse(
        enabled=config.LEAD_MAGNET_ENABLED,
        cycle_days=config.LEAD_MAGNET_CYCLE_DAYS,
        quotas=LeadMagnetQuotas(**_normalize_quotas(quotas)),
        config_version=config.LEAD_MAGNET_CONFIG_VERSION,
    )


@router.post("/lead-magnet", response_model=LeadMagnetConfigResponse)
async def update_lead_magnet_config(
    request: Request,
    form_data: LeadMagnetConfigRequest,
    admin_user=Depends(get_admin_user),
) -> LeadMagnetConfigResponse:
    config = request.app.state.config
    try:
        config.LEAD_MAGNET_ENABLED = form_data.enabled
        config.LEAD_MAGNET_CYCLE_DAYS = form_data.cycle_days
        config.LEAD_MAGNET_QUOTAS = form_data.quotas.model_dump()
        config.LEAD_MAGNET_CONFIG_VERSION = int(config.LEAD_MAGNET_CONFIG_VERSION) + 1
    except Exception as e:
        log.exception(f"Failed to update lead magnet config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead magnet configuration",
        )

    return LeadMagnetConfigResponse(
        enabled=config.LEAD_MAGNET_ENABLED,
        cycle_days=config.LEAD_MAGNET_CYCLE_DAYS,
        quotas=LeadMagnetQuotas(**_normalize_quotas(config.LEAD_MAGNET_QUOTAS)),
        config_version=config.LEAD_MAGNET_CONFIG_VERSION,
    )


def _normalize_quotas(raw: Dict[str, object]) -> Dict[str, int]:
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
