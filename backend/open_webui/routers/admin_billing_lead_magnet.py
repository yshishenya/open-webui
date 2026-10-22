"""
Admin endpoints for lead magnet configuration.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from open_webui.env import SRC_LOG_LEVELS
from open_webui.models.users import UserModel
from open_webui.utils.airis.runtime_config import (
    refresh_lead_magnet_runtime_config,
    save_lead_magnet_config_if_current,
)
from open_webui.utils.auth import get_admin_user
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get('BILLING', logging.INFO))

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
    expected_config_version: int = Field(..., ge=0, strict=True)
    enabled: bool
    cycle_days: int = Field(..., ge=1)
    quotas: LeadMagnetQuotas


@router.get('/lead-magnet', response_model=LeadMagnetConfigResponse)
async def get_lead_magnet_config(
    admin_user: UserModel = Depends(get_admin_user),
) -> LeadMagnetConfigResponse:
    config = await refresh_lead_magnet_runtime_config()
    return LeadMagnetConfigResponse(
        enabled=config.enabled,
        cycle_days=config.cycle_days,
        quotas=LeadMagnetQuotas(**config.quotas),
        config_version=config.config_version,
    )


@router.post('/lead-magnet', response_model=LeadMagnetConfigResponse)
async def update_lead_magnet_config(
    form_data: LeadMagnetConfigRequest,
    admin_user: UserModel = Depends(get_admin_user),
) -> LeadMagnetConfigResponse:
    try:
        config = await save_lead_magnet_config_if_current(
            expected_version=form_data.expected_config_version,
            enabled=form_data.enabled,
            cycle_days=form_data.cycle_days,
            quotas=form_data.quotas.model_dump(),
        )
        if config is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='Lead magnet configuration changed. Review current settings before saving.',
            )
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f'Failed to update lead magnet config: {e}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to update lead magnet configuration',
        )

    return LeadMagnetConfigResponse(
        enabled=config.enabled,
        cycle_days=config.cycle_days,
        quotas=LeadMagnetQuotas(**config.quotas),
        config_version=config.config_version,
    )


def _normalize_quotas(raw: dict[str, object]) -> dict[str, int]:
    defaults: dict[str, int] = {
        'tokens_input': 0,
        'tokens_output': 0,
        'images': 0,
        'tts_seconds': 0,
        'stt_seconds': 0,
    }
    for key, value in raw.items():
        if key in defaults and isinstance(value, int):
            defaults[key] = value
    return defaults
