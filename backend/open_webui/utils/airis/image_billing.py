from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from fastapi import HTTPException, status

from open_webui.models.billing import UsageMetric
from open_webui.utils.billing_integration import (
    IMAGE_HOLD_REFERENCE,
    SingleRateHoldContext,
    preflight_single_rate_hold,
    release_single_rate_hold,
    settle_single_rate_usage,
)

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImageBillingContext:
    hold: SingleRateHoldContext | None
    operation: Literal['generate', 'edit']
    provider: str
    width: int
    height: int
    requested_count: int


async def preflight_image_billing(
    *,
    user_id: str,
    model_id: str,
    provider: str,
    operation: Literal['generate', 'edit'],
    requested_count: int | None,
    width: int | None,
    height: int | None,
    auto_size: bool,
) -> ImageBillingContext:
    if not model_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid image model',
        )

    resolved_width = 1024 if auto_size else width or 1024
    resolved_height = 1024 if auto_size else height or 1024
    resolved_count = requested_count if requested_count and requested_count > 0 else 1
    units = Decimal(resolved_count) * Decimal(resolved_width * resolved_height) / Decimal(1024 * 1024)

    hold = await preflight_single_rate_hold(
        user_id=user_id,
        model_id=model_id,
        modality='image',
        unit='image_1024',
        units=units,
        reference_type=IMAGE_HOLD_REFERENCE,
        lead_magnet_requirements={'images': resolved_count},
    )
    return ImageBillingContext(
        hold=hold,
        operation=operation,
        provider=provider,
        width=resolved_width,
        height=resolved_height,
        requested_count=resolved_count,
    )


async def settle_image_billing(
    context: ImageBillingContext,
    actual_count: int,
) -> None:
    units = Decimal(actual_count) * Decimal(context.width * context.height) / Decimal(1024 * 1024)
    try:
        await settle_single_rate_usage(
            billing_context=context.hold,
            measured_units={
                'operation': context.operation,
                'requested_count': context.requested_count,
                'count': actual_count,
                'width': context.width,
                'height': context.height,
                'unit': 'image_1024',
                'units': float(units),
            },
            units=units,
            usage_metric=UsageMetric.IMAGES,
            usage_amount=actual_count,
            provider=context.provider,
            reference_type=IMAGE_HOLD_REFERENCE,
        )
    except Exception:
        log.exception('Failed to settle image billing usage')


async def release_image_billing(context: ImageBillingContext | None) -> None:
    if context is None:
        return
    await release_single_rate_hold(
        context.hold,
        reference_type=IMAGE_HOLD_REFERENCE,
    )
