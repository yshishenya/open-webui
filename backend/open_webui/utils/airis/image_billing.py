from __future__ import annotations

import base64
import io
import logging
from collections.abc import Mapping
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
from PIL import Image

log = logging.getLogger(__name__)

GPT_IMAGE_2_MODEL = 'gpt-image-2'
GPT_IMAGE_2_IMAGE_INPUT_USD_PER_MILLION = Decimal('8')
GPT_IMAGE_2_TEXT_INPUT_USD_PER_MILLION = Decimal('5')
GPT_IMAGE_2_IMAGE_OUTPUT_USD_PER_MILLION = Decimal('30')
GPT_IMAGE_2_MEDIUM_1024_USD = Decimal('0.053')
GPT_IMAGE_2_EDIT_HOLD_MARGIN = Decimal('1.10')


@dataclass(frozen=True)
class ImageBillingContext:
    hold: SingleRateHoldContext | None
    model_id: str
    operation: Literal['generate', 'edit']
    provider: str
    width: int
    height: int
    requested_count: int
    estimated_units: Decimal


def _gpt_image_2_edit_units(
    *,
    image_input_tokens: int,
    text_input_tokens: int,
    image_output_tokens: int,
) -> Decimal:
    weighted_cost = (
        Decimal(image_input_tokens) * GPT_IMAGE_2_IMAGE_INPUT_USD_PER_MILLION
        + Decimal(text_input_tokens) * GPT_IMAGE_2_TEXT_INPUT_USD_PER_MILLION
        + Decimal(image_output_tokens) * GPT_IMAGE_2_IMAGE_OUTPUT_USD_PER_MILLION
    )
    return weighted_cost / (GPT_IMAGE_2_MEDIUM_1024_USD * Decimal(1_000_000))


def _data_url_dimensions(data_url: str) -> tuple[int, int]:
    try:
        _, encoded = data_url.split(',', 1)
        image_data = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(image_data)) as image:
            return image.size
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid image input',
        ) from e


def estimate_gpt_image_2_edit_units(
    *,
    images: str | list[str],
    prompt: str,
    requested_count: int,
) -> Decimal:
    image_list = [images] if isinstance(images, str) else images
    if not image_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Image input is required',
        )

    image_tokens = 0
    for image in image_list:
        width, height = _data_url_dimensions(image)
        image_tokens += ((width + 31) // 32) * ((height + 31) // 32)

    text_tokens = max(len(prompt.encode('utf-8')), 1)
    input_units = _gpt_image_2_edit_units(
        image_input_tokens=image_tokens,
        text_input_tokens=text_tokens,
        image_output_tokens=0,
    )
    return Decimal(requested_count) + input_units


def gpt_image_2_edit_units_from_usage(usage: Mapping[str, object]) -> Decimal | None:
    input_details = usage.get('input_tokens_details')
    if not isinstance(input_details, Mapping):
        return None

    try:
        image_input_tokens = max(int(input_details.get('image_tokens', 0)), 0)
        text_input_tokens = max(int(input_details.get('text_tokens', 0)), 0)
        image_output_tokens = max(int(usage.get('output_tokens', 0)), 0)
    except (TypeError, ValueError):
        return None

    if image_output_tokens <= 0:
        return None
    return _gpt_image_2_edit_units(
        image_input_tokens=image_input_tokens,
        text_input_tokens=text_input_tokens,
        image_output_tokens=image_output_tokens,
    )


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
    input_images: str | list[str] | None = None,
    prompt: str = '',
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
    estimated_units = units
    if operation == 'edit' and model_id == GPT_IMAGE_2_MODEL:
        if input_images is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Image input is required',
            )
        estimated_units = estimate_gpt_image_2_edit_units(
            images=input_images,
            prompt=prompt,
            requested_count=resolved_count,
        )
        units = Decimal(resolved_count) + (estimated_units - Decimal(resolved_count)) * GPT_IMAGE_2_EDIT_HOLD_MARGIN

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
        model_id=model_id,
        operation=operation,
        provider=provider,
        width=resolved_width,
        height=resolved_height,
        requested_count=resolved_count,
        estimated_units=estimated_units,
    )


async def settle_image_billing(
    context: ImageBillingContext,
    actual_count: int,
    provider_usage: Mapping[str, object] | None = None,
) -> None:
    units = Decimal(actual_count) * Decimal(context.width * context.height) / Decimal(1024 * 1024)
    usage_source = 'output_dimensions'
    if context.operation == 'edit' and context.model_id == GPT_IMAGE_2_MODEL:
        measured_units = gpt_image_2_edit_units_from_usage(provider_usage) if provider_usage is not None else None
        units = measured_units if measured_units is not None else context.estimated_units
        usage_source = 'provider_usage' if measured_units is not None else 'preflight_estimate'

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
                'usage_source': usage_source,
                **({'provider_usage': dict(provider_usage)} if provider_usage is not None else {}),
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
