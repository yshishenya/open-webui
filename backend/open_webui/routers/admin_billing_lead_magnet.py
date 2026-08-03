"""
Admin endpoints for lead magnet configuration.
"""

import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from open_webui.utils.auth import get_admin_user
from open_webui.env import SRC_LOG_LEVELS
from open_webui.models.config import Config
from open_webui.utils.airis.runtime_config import (
    LEAD_MAGNET_CONFIG_VERSION_KEY,
    LEAD_MAGNET_CYCLE_DAYS_KEY,
    LEAD_MAGNET_ENABLED_KEY,
    LEAD_MAGNET_QUOTAS_KEY,
    refresh_lead_magnet_runtime_config,
    set_lead_magnet_runtime_config,
)

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
    admin_user=Depends(get_admin_user),
) -> LeadMagnetConfigResponse:
    config = await refresh_lead_magnet_runtime_config()
    return LeadMagnetConfigResponse(
        enabled=config.enabled,
        cycle_days=config.cycle_days,
        quotas=LeadMagnetQuotas(**config.quotas),
        config_version=config.config_version,
    )


@router.post("/lead-magnet", response_model=LeadMagnetConfigResponse)
async def update_lead_magnet_config(
    form_data: LeadMagnetConfigRequest,
    admin_user=Depends(get_admin_user),
) -> LeadMagnetConfigResponse:
    try:
        current = await refresh_lead_magnet_runtime_config()
        config_version = current.config_version + 1
        quotas = form_data.quotas.model_dump()
        await Config.upsert(
            {
                LEAD_MAGNET_ENABLED_KEY: form_data.enabled,
                LEAD_MAGNET_CYCLE_DAYS_KEY: form_data.cycle_days,
                LEAD_MAGNET_QUOTAS_KEY: quotas,
                LEAD_MAGNET_CONFIG_VERSION_KEY: config_version,
            }
        )
        config = set_lead_magnet_runtime_config(
            enabled=form_data.enabled,
            cycle_days=form_data.cycle_days,
            quotas=quotas,
            config_version=config_version,
        )
    except Exception as e:
        log.exception(f"Failed to update lead magnet config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead magnet configuration",
        )

    return LeadMagnetConfigResponse(
        enabled=config.enabled,
        cycle_days=config.cycle_days,
        quotas=LeadMagnetQuotas(**config.quotas),
        config_version=config.config_version,
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
