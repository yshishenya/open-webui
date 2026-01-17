"""
Billing integration utilities
Handles quota checking and usage tracking for AI model requests
"""

import logging
import json
import time
import uuid
from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR
from typing import Optional, Dict, AsyncGenerator

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool

from open_webui.env import (
    BILLING_DEFAULT_CURRENCY,
    BILLING_HOLD_TTL_SECONDS,
    ENABLE_BILLING_WALLET,
    SRC_LOG_LEVELS,
)
from open_webui.models.billing import (
    BillingSource,
    PricingRateCardModel,
    UsageEventModel,
    UsageEvents,
    UsageMetric,
)
from open_webui.models.billing_wallet import JsonDict
from open_webui.utils.billing import (
    AutoTopupResult,
    billing_service,
    QuotaExceededError,
)
from open_webui.utils.pricing import PricingService
from open_webui.utils.lead_magnet import (
    consume_lead_magnet_usage,
    evaluate_lead_magnet,
    estimate_tts_seconds,
)
from open_webui.utils.wallet import (
    HoldNotFoundError,
    InsufficientFundsError,
    WalletError,
    wallet_service,
)

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))

pricing_service = PricingService()

CHAT_HOLD_REFERENCE = "chat_completion"
IMAGE_HOLD_REFERENCE = "image_generation"
TTS_HOLD_REFERENCE = "tts_generation"
STT_HOLD_REFERENCE = "stt_transcription"


@dataclass(frozen=True)
class BillingHoldContext:
    request_id: str
    user_id: str
    model_id: str
    modality: str
    billing_source: str
    wallet_id: str
    plan_id: Optional[str]
    subscription_id: Optional[str]
    discount_percent: int
    rate_in: PricingRateCardModel
    rate_out: PricingRateCardModel
    estimate_min_kopeks: int
    estimate_max_kopeks: int
    estimated_prompt_tokens: int
    estimated_min_output_tokens: int
    estimated_max_output_tokens: int
    hold_amount_kopeks: int
    hold_expires_at: Optional[int]


@dataclass(frozen=True)
class SingleRateHoldContext:
    request_id: str
    user_id: str
    model_id: str
    modality: str
    unit: str
    billing_source: str
    wallet_id: str
    plan_id: Optional[str]
    subscription_id: Optional[str]
    discount_percent: int
    rate_card: PricingRateCardModel
    units: Decimal
    hold_amount_kopeks: int
    hold_expires_at: Optional[int]


# ==================== Quota Checking ====================


async def check_and_enforce_quota(
    user_id: str,
    model_id: str,
    estimated_input_tokens: int = 0,
) -> None:
    """
    Check quotas before making API request
    Raises HTTPException if quota exceeded

    Args:
        user_id: User ID
        model_id: Model ID being used
        estimated_input_tokens: Estimated input tokens (optional)

    Raises:
        HTTPException: If quota exceeded or billing error
    """
    try:
        # Check if user has active subscription
        has_subscription = await run_in_threadpool(
            billing_service.has_active_subscription, user_id
        )
        if not has_subscription:
            log.debug(f"User {user_id} has no active subscription, skipping quota check")
            return

        # Check request quota
        try:
            await run_in_threadpool(
                billing_service.enforce_quota,
                user_id,
                UsageMetric.REQUESTS,
                1,
            )
        except QuotaExceededError as e:
            log.warning(f"Request quota exceeded for user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=str(e),
            )

        # Check token quota if estimated
        if estimated_input_tokens > 0:
            try:
                await run_in_threadpool(
                    billing_service.enforce_quota,
                    user_id,
                    UsageMetric.TOKENS_INPUT,
                    estimated_input_tokens,
                )
            except QuotaExceededError as e:
                log.warning(f"Token quota exceeded for user {user_id}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=str(e),
                )

        log.debug(f"Quota check passed for user {user_id}, model {model_id}")

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log but don't block request if billing system has issues
        log.error(f"Error checking quota for user {user_id}: {e}")
        # Don't raise - allow request to proceed


# ==================== Usage Tracking ====================


async def track_model_usage(
    user_id: str,
    model_id: str,
    usage_data: Dict[str, int],
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> None:
    """
    Track usage after receiving API response

    Args:
        user_id: User ID
        model_id: Model ID that was used
        usage_data: Usage data from API response (prompt_tokens, completion_tokens, etc.)
        chat_id: Chat ID (optional)
        message_id: Message ID (optional)
    """
    try:
        # Check if user has subscription (only track if they do)
        has_subscription = await run_in_threadpool(
            billing_service.has_active_subscription, user_id
        )
        if not has_subscription:
            log.debug(f"User {user_id} has no subscription, skipping usage tracking")
            return

        metadata: Dict[str, object] = {
            "chat_id": chat_id,
            "message_id": message_id,
        }

        # Track input tokens
        prompt_tokens = usage_data.get("prompt_tokens", 0)
        if prompt_tokens > 0:
            await run_in_threadpool(
                billing_service.track_usage,
                user_id,
                UsageMetric.TOKENS_INPUT,
                prompt_tokens,
                model_id,
                chat_id,
                metadata,
            )
            log.debug(f"Tracked {prompt_tokens} input tokens for user {user_id}")

        # Track output tokens
        completion_tokens = usage_data.get("completion_tokens", 0)
        if completion_tokens > 0:
            await run_in_threadpool(
                billing_service.track_usage,
                user_id,
                UsageMetric.TOKENS_OUTPUT,
                completion_tokens,
                model_id,
                chat_id,
                metadata,
            )
            log.debug(f"Tracked {completion_tokens} output tokens for user {user_id}")

        # Track request count
        await run_in_threadpool(
            billing_service.track_usage,
            user_id,
            UsageMetric.REQUESTS,
            1,
            model_id,
            chat_id,
            metadata,
        )
        log.debug(f"Tracked 1 request for user {user_id}")

        log.info(
            f"Usage tracked for user {user_id}: "
            f"{prompt_tokens} input + {completion_tokens} output tokens"
        )

    except Exception as e:
        # Log but don't fail the request if tracking fails
        log.error(f"Error tracking usage for user {user_id}: {e}")


# ==================== Wallet Hold/Settle ====================


def _calculate_cost_kopeks(
    prompt_tokens: int,
    completion_tokens: int,
    rate_in: PricingRateCardModel,
    rate_out: PricingRateCardModel,
    discount_percent: int,
) -> int:
    _, _, total = _calculate_cost_breakdown(
        prompt_tokens,
        completion_tokens,
        rate_in,
        rate_out,
        discount_percent,
    )
    return total


def _calculate_cost_breakdown(
    prompt_tokens: int,
    completion_tokens: int,
    rate_in: PricingRateCardModel,
    rate_out: PricingRateCardModel,
    discount_percent: int,
) -> tuple[int, int, int]:
    unit_in = Decimal(prompt_tokens) / Decimal(1000)
    unit_out = Decimal(completion_tokens) / Decimal(1000)
    cost_in = pricing_service.calculate_cost_kopeks(
        unit_in, rate_in, discount_percent
    )
    cost_out = pricing_service.calculate_cost_kopeks(
        unit_out, rate_out, discount_percent
    )
    return cost_in, cost_out, cost_in + cost_out


def _scale_cost_breakdown(
    input_cost: int,
    output_cost: int,
    target_total: int,
) -> tuple[int, int]:
    current_total = input_cost + output_cost
    if current_total <= 0 or target_total >= current_total:
        return input_cost, output_cost

    input_scaled = int(
        (Decimal(target_total) * Decimal(input_cost) / Decimal(current_total))
        .to_integral_value(rounding=ROUND_FLOOR)
    )
    output_scaled = target_total - input_scaled
    return input_scaled, output_scaled


def _resolve_lead_magnet_units(
    billing_context: SingleRateHoldContext,
    measured_units: JsonDict,
    usage_metric: Optional[UsageMetric],
    usage_amount: Optional[int],
) -> Dict[str, int]:
    def _int_value(value: object) -> int:
        if isinstance(value, (int, float)):
            return int(value)
        return 0

    if billing_context.modality == "image":
        count = usage_amount or _int_value(measured_units.get("count"))
        if count <= 0:
            count = _int_value(measured_units.get("requested_count"))
        return {"images": count} if count > 0 else {}

    if billing_context.modality == "tts":
        tts_seconds = _int_value(measured_units.get("tts_seconds"))
        if tts_seconds <= 0:
            char_count = _int_value(measured_units.get("char_count"))
            if char_count <= 0:
                char_count = _int_value(measured_units.get("units"))
            if char_count > 0:
                tts_seconds = estimate_tts_seconds(char_count)
        return {"tts_seconds": tts_seconds} if tts_seconds > 0 else {}

    if billing_context.modality == "stt":
        stt_seconds = _int_value(measured_units.get("stt_seconds"))
        return {"stt_seconds": stt_seconds} if stt_seconds > 0 else {}

    if usage_metric == UsageMetric.IMAGES and usage_amount:
        return {"images": int(usage_amount)}

    return {}


async def _maybe_trigger_auto_topup(
    user_id: str,
    wallet_id: str,
    available_kopeks: int,
    required_kopeks: int,
    reason: str,
) -> Optional[AutoTopupResult]:
    try:
        return await billing_service.maybe_trigger_auto_topup(
            user_id=user_id,
            wallet_id=wallet_id,
            available_kopeks=available_kopeks,
            required_kopeks=required_kopeks,
            reason=reason,
        )
    except Exception as e:
        log.exception(f"Auto-topup attempt failed: {e}")
        return None


async def preflight_estimate_hold(
    user_id: str,
    model_id: str,
    payload: Dict[str, object],
    request_id: Optional[str] = None,
    max_reply_cost_kopeks: Optional[int] = None,
    lead_magnet_model_id: Optional[str] = None,
) -> Optional[BillingHoldContext]:
    """Estimate and place hold for a text request."""
    if not ENABLE_BILLING_WALLET:
        return None

    now = int(time.time())
    request_id_value = request_id or str(uuid.uuid4())

    messages_value = payload.get("messages", [])
    messages = messages_value if isinstance(messages_value, list) else []

    max_tokens_value = payload.get("max_tokens")
    if max_tokens_value is None:
        max_tokens_value = payload.get("max_completion_tokens")

    max_tokens = int(max_tokens_value) if isinstance(max_tokens_value, int) else 0
    estimated_prompt_tokens = estimate_tokens_from_messages(messages)
    min_output_tokens = 1 if max_tokens > 0 else 0
    max_output_tokens = max_tokens

    wallet = await run_in_threadpool(
        wallet_service.get_or_create_wallet, user_id, BILLING_DEFAULT_CURRENCY
    )
    wallet = await run_in_threadpool(wallet_service.refresh_wallet, wallet.id)

    subscription = await run_in_threadpool(
        billing_service.get_user_subscription, user_id
    )
    plan = None
    if subscription:
        plan = await run_in_threadpool(billing_service.get_plan, subscription.plan_id)

    discount_percent = plan.discount_percent if plan else 0

    effective_max_reply = max_reply_cost_kopeks
    if effective_max_reply is None and wallet.max_reply_cost_kopeks is not None:
        effective_max_reply = wallet.max_reply_cost_kopeks
    if (
        effective_max_reply is None
        and plan
        and plan.max_reply_cost_kopeks is not None
    ):
        effective_max_reply = plan.max_reply_cost_kopeks

    daily_cap = (
        wallet.daily_cap_kopeks
        if wallet.daily_cap_kopeks is not None
        else plan.daily_cap_kopeks if plan else None
    )

    rate_in = await run_in_threadpool(
        pricing_service.get_rate_card, model_id, "text", "token_in", now
    )
    rate_out = await run_in_threadpool(
        pricing_service.get_rate_card, model_id, "text", "token_out", now
    )
    if not rate_in or not rate_out:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "rate_card_missing"},
        )

    min_cost = _calculate_cost_kopeks(
        estimated_prompt_tokens,
        min_output_tokens,
        rate_in,
        rate_out,
        discount_percent,
    )
    max_cost = _calculate_cost_kopeks(
        estimated_prompt_tokens,
        max_output_tokens,
        rate_in,
        rate_out,
        discount_percent,
    )

    lead_magnet_decision = None
    lead_magnet_model_value = lead_magnet_model_id or model_id
    try:
        lead_magnet_decision = await run_in_threadpool(
            evaluate_lead_magnet,
            user_id,
            lead_magnet_model_value,
            {
                "tokens_input": estimated_prompt_tokens,
                "tokens_output": max_output_tokens,
            },
            now,
        )
    except Exception as e:
        log.warning(f"Lead magnet evaluation failed: {e}")

    if lead_magnet_decision and lead_magnet_decision.allowed:
        return BillingHoldContext(
            request_id=request_id_value,
            user_id=user_id,
            model_id=model_id,
            modality="text",
            billing_source=BillingSource.LEAD_MAGNET.value,
            wallet_id=wallet.id,
            plan_id=plan.id if plan else None,
            subscription_id=subscription.id if subscription else None,
            discount_percent=discount_percent,
            rate_in=rate_in,
            rate_out=rate_out,
            estimate_min_kopeks=min_cost,
            estimate_max_kopeks=max_cost,
            estimated_prompt_tokens=estimated_prompt_tokens,
            estimated_min_output_tokens=min_output_tokens,
            estimated_max_output_tokens=max_output_tokens,
            hold_amount_kopeks=0,
            hold_expires_at=None,
        )

    available = wallet.balance_included_kopeks + wallet.balance_topup_kopeks

    auto_topup_result: Optional[AutoTopupResult] = None
    if wallet.auto_topup_enabled:
        auto_topup_result = await _maybe_trigger_auto_topup(
            user_id=user_id,
            wallet_id=wallet.id,
            available_kopeks=available,
            required_kopeks=max_cost,
            reason="text_preflight",
        )

    if effective_max_reply is not None and max_cost > effective_max_reply:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "max_reply_cost_exceeded",
                "max_reply_cost_kopeks": effective_max_reply,
            },
        )

    if daily_cap is not None and (wallet.daily_spent_kopeks + max_cost) > daily_cap:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "daily_cap_exceeded"},
        )

    if available < max_cost:
        detail: Dict[str, object] = {"error": "insufficient_funds"}
        if auto_topup_result and (
            auto_topup_result.attempted or auto_topup_result.status == "pending"
        ):
            detail["auto_topup_status"] = auto_topup_result.status
            if auto_topup_result.payment_id:
                detail["auto_topup_payment_id"] = auto_topup_result.payment_id
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=detail,
        )

    hold_amount = max_cost if max_cost > 0 else 0
    hold_expires_at = None
    if hold_amount > 0 and BILLING_HOLD_TTL_SECONDS > 0:
        hold_expires_at = now + BILLING_HOLD_TTL_SECONDS

    if hold_amount > 0:
        try:
            await run_in_threadpool(
                wallet_service.hold_funds,
                wallet.id,
                hold_amount,
                request_id_value,
                CHAT_HOLD_REFERENCE,
                None,
                hold_expires_at,
            )
        except InsufficientFundsError as e:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "insufficient_funds", "message": str(e)},
            )
        except WalletError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "wallet_error", "message": str(e)},
            )

    return BillingHoldContext(
        request_id=request_id_value,
        user_id=user_id,
        model_id=model_id,
        modality="text",
        billing_source=BillingSource.PAYG.value,
        wallet_id=wallet.id,
        plan_id=plan.id if plan else None,
        subscription_id=subscription.id if subscription else None,
        discount_percent=discount_percent,
        rate_in=rate_in,
        rate_out=rate_out,
        estimate_min_kopeks=min_cost,
        estimate_max_kopeks=max_cost,
        estimated_prompt_tokens=estimated_prompt_tokens,
        estimated_min_output_tokens=min_output_tokens,
        estimated_max_output_tokens=max_output_tokens,
        hold_amount_kopeks=hold_amount,
        hold_expires_at=hold_expires_at,
    )


async def preflight_single_rate_hold(
    user_id: str,
    model_id: str,
    modality: str,
    unit: str,
    units: Decimal,
    request_id: Optional[str] = None,
    max_reply_cost_kopeks: Optional[int] = None,
    reference_type: str = IMAGE_HOLD_REFERENCE,
    lead_magnet_requirements: Optional[Dict[str, int]] = None,
) -> Optional[SingleRateHoldContext]:
    """Estimate and place hold for single-rate modalities (image/tts/stt)."""
    if not ENABLE_BILLING_WALLET:
        return None

    if units <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_units"},
        )

    now = int(time.time())
    request_id_value = request_id or str(uuid.uuid4())

    wallet = await run_in_threadpool(
        wallet_service.get_or_create_wallet, user_id, BILLING_DEFAULT_CURRENCY
    )
    wallet = await run_in_threadpool(wallet_service.refresh_wallet, wallet.id)

    subscription = await run_in_threadpool(
        billing_service.get_user_subscription, user_id
    )
    plan = None
    if subscription:
        plan = await run_in_threadpool(billing_service.get_plan, subscription.plan_id)

    discount_percent = plan.discount_percent if plan else 0

    effective_max_reply = max_reply_cost_kopeks
    if effective_max_reply is None and wallet.max_reply_cost_kopeks is not None:
        effective_max_reply = wallet.max_reply_cost_kopeks
    if (
        effective_max_reply is None
        and plan
        and plan.max_reply_cost_kopeks is not None
    ):
        effective_max_reply = plan.max_reply_cost_kopeks

    daily_cap = (
        wallet.daily_cap_kopeks
        if wallet.daily_cap_kopeks is not None
        else plan.daily_cap_kopeks if plan else None
    )

    rate_card = await run_in_threadpool(
        pricing_service.get_rate_card, model_id, modality, unit, now
    )
    if not rate_card:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "rate_card_missing"},
        )

    cost = pricing_service.calculate_cost_kopeks(
        units, rate_card, discount_percent
    )

    lead_magnet_decision = None
    if lead_magnet_requirements:
        try:
            lead_magnet_decision = await run_in_threadpool(
                evaluate_lead_magnet,
                user_id,
                model_id,
                lead_magnet_requirements,
                now,
            )
        except Exception as e:
            log.warning(f"Lead magnet evaluation failed: {e}")

    if lead_magnet_decision and lead_magnet_decision.allowed:
        return SingleRateHoldContext(
            request_id=request_id_value,
            user_id=user_id,
            model_id=model_id,
            modality=modality,
            unit=unit,
            billing_source=BillingSource.LEAD_MAGNET.value,
            wallet_id=wallet.id,
            plan_id=plan.id if plan else None,
            subscription_id=subscription.id if subscription else None,
            discount_percent=discount_percent,
            rate_card=rate_card,
            units=units,
            hold_amount_kopeks=0,
            hold_expires_at=None,
        )
    available = wallet.balance_included_kopeks + wallet.balance_topup_kopeks

    auto_topup_result: Optional[AutoTopupResult] = None
    if wallet.auto_topup_enabled:
        auto_topup_result = await _maybe_trigger_auto_topup(
            user_id=user_id,
            wallet_id=wallet.id,
            available_kopeks=available,
            required_kopeks=cost,
            reason=f"{modality}_preflight",
        )

    if effective_max_reply is not None and cost > effective_max_reply:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "max_reply_cost_exceeded",
                "max_reply_cost_kopeks": effective_max_reply,
            },
        )

    if daily_cap is not None and (wallet.daily_spent_kopeks + cost) > daily_cap:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "daily_cap_exceeded"},
        )

    if available < cost:
        detail: Dict[str, object] = {"error": "insufficient_funds"}
        if auto_topup_result and (
            auto_topup_result.attempted or auto_topup_result.status == "pending"
        ):
            detail["auto_topup_status"] = auto_topup_result.status
            if auto_topup_result.payment_id:
                detail["auto_topup_payment_id"] = auto_topup_result.payment_id
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=detail,
        )

    hold_expires_at = None
    if cost > 0 and BILLING_HOLD_TTL_SECONDS > 0:
        hold_expires_at = now + BILLING_HOLD_TTL_SECONDS

    if cost > 0:
        try:
            await run_in_threadpool(
                wallet_service.hold_funds,
                wallet.id,
                cost,
                request_id_value,
                reference_type,
                None,
                hold_expires_at,
            )
        except InsufficientFundsError as e:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "insufficient_funds", "message": str(e)},
            )
        except WalletError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "wallet_error", "message": str(e)},
            )

    return SingleRateHoldContext(
        request_id=request_id_value,
        user_id=user_id,
        model_id=model_id,
        modality=modality,
        unit=unit,
        billing_source=BillingSource.PAYG.value,
        wallet_id=wallet.id,
        plan_id=plan.id if plan else None,
        subscription_id=subscription.id if subscription else None,
        discount_percent=discount_percent,
        rate_card=rate_card,
        units=units,
        hold_amount_kopeks=cost,
        hold_expires_at=hold_expires_at,
    )


async def release_billing_hold(billing_context: Optional[BillingHoldContext]) -> None:
    """Release held funds when a request fails."""
    if not billing_context or billing_context.hold_amount_kopeks <= 0:
        return

    try:
        await run_in_threadpool(
            wallet_service.release_hold,
            billing_context.wallet_id,
            billing_context.request_id,
            CHAT_HOLD_REFERENCE,
        )
    except HoldNotFoundError:
        return
    except WalletError as e:
        log.warning(f"Failed to release hold: {e}")


async def release_single_rate_hold(
    billing_context: Optional[SingleRateHoldContext],
    reference_type: str = IMAGE_HOLD_REFERENCE,
) -> None:
    """Release held funds for single-rate modalities."""
    if not billing_context or billing_context.hold_amount_kopeks <= 0:
        return

    try:
        await run_in_threadpool(
            wallet_service.release_hold,
            billing_context.wallet_id,
            billing_context.request_id,
            reference_type,
        )
    except HoldNotFoundError:
        return
    except WalletError as e:
        log.warning(f"Failed to release hold: {e}")


async def settle_billing_usage(
    billing_context: Optional[BillingHoldContext],
    usage_data: Optional[Dict[str, int]],
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
    provider: Optional[str] = None,
) -> None:
    """Settle hold and record usage events."""
    if not billing_context:
        return

    is_estimated = False
    estimate_reason = None

    if usage_data:
        prompt_tokens = int(usage_data.get("prompt_tokens", 0) or 0)
        completion_tokens = int(usage_data.get("completion_tokens", 0) or 0)
        total_tokens = int(
            usage_data.get("total_tokens", prompt_tokens + completion_tokens) or 0
        )
    else:
        is_estimated = True
        estimate_reason = "usage_missing"
        log.warning(
            "Usage missing for request %s; charging estimate",
            billing_context.request_id,
        )
        prompt_tokens = billing_context.estimated_prompt_tokens
        completion_tokens = billing_context.estimated_max_output_tokens
        total_tokens = prompt_tokens + completion_tokens

    cost_raw_input, cost_raw_output, cost_raw = _calculate_cost_breakdown(
        prompt_tokens,
        completion_tokens,
        billing_context.rate_in,
        billing_context.rate_out,
        0,
    )
    cost_charged_input, cost_charged_output, cost_charged = _calculate_cost_breakdown(
        prompt_tokens,
        completion_tokens,
        billing_context.rate_in,
        billing_context.rate_out,
        billing_context.discount_percent,
    )

    charge_entry = None
    if billing_context.billing_source == BillingSource.PAYG.value:
        if billing_context.hold_amount_kopeks > 0:
            charge_amount = min(cost_charged, billing_context.hold_amount_kopeks)
            if charge_amount < cost_charged:
                is_estimated = True
                estimate_reason = "charge_exceeds_hold"
                cost_charged = charge_amount
                cost_charged_input, cost_charged_output = _scale_cost_breakdown(
                    cost_charged_input,
                    cost_charged_output,
                    charge_amount,
                )

            try:
                charge_entry = await run_in_threadpool(
                    wallet_service.settle_hold,
                    billing_context.wallet_id,
                    billing_context.request_id,
                    CHAT_HOLD_REFERENCE,
                    charge_amount,
                    cost_charged_input,
                    cost_charged_output,
                )
            except WalletError as e:
                log.exception(
                    f"Failed to settle hold for {billing_context.request_id}: {e}"
                )
                return
        else:
            if cost_charged > 0:
                is_estimated = True
                estimate_reason = "hold_missing"
                cost_charged = 0
                cost_charged_input = 0
                cost_charged_output = 0
    else:
        cost_charged = 0
        cost_charged_input = 0
        cost_charged_output = 0

    measured_units: JsonDict = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "rate_card_ids": {
            "token_in": billing_context.rate_in.id,
            "token_out": billing_context.rate_out.id,
        },
    }

    wallet_snapshot: Optional[JsonDict] = None
    if charge_entry:
        wallet_snapshot = {
            "balance_included_after": charge_entry.balance_included_after,
            "balance_topup_after": charge_entry.balance_topup_after,
        }

    usage_event = UsageEventModel(
        id=str(uuid.uuid4()),
        user_id=billing_context.user_id,
        wallet_id=billing_context.wallet_id,
        plan_id=billing_context.plan_id,
        subscription_id=billing_context.subscription_id,
        chat_id=chat_id,
        message_id=message_id,
        request_id=billing_context.request_id,
        model_id=billing_context.model_id,
        modality=billing_context.modality,
        provider=provider,
        measured_units_json=measured_units,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_raw_kopeks=cost_raw,
        cost_raw_input_kopeks=cost_raw_input,
        cost_raw_output_kopeks=cost_raw_output,
        cost_charged_kopeks=cost_charged,
        cost_charged_input_kopeks=cost_charged_input,
        cost_charged_output_kopeks=cost_charged_output,
        billing_source=billing_context.billing_source,
        is_estimated=is_estimated,
        estimate_reason=estimate_reason,
        pricing_version=billing_context.rate_in.version,
        pricing_rate_card_id=billing_context.rate_in.id,
        pricing_rate_card_input_id=billing_context.rate_in.id,
        pricing_rate_card_output_id=billing_context.rate_out.id,
        wallet_snapshot_json=wallet_snapshot,
        created_at=int(time.time()),
    )

    await run_in_threadpool(UsageEvents.create_usage_event, usage_event)

    if billing_context.billing_source == BillingSource.LEAD_MAGNET.value:
        await run_in_threadpool(
            consume_lead_magnet_usage,
            billing_context.user_id,
            {
                "tokens_input": prompt_tokens,
                "tokens_output": completion_tokens,
            },
        )
    else:
        await track_model_usage(
            user_id=billing_context.user_id,
            model_id=billing_context.model_id,
            usage_data={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
            },
            chat_id=chat_id,
            message_id=message_id,
        )


async def settle_single_rate_usage(
    billing_context: Optional[SingleRateHoldContext],
    measured_units: JsonDict,
    units: Decimal,
    usage_metric: Optional[UsageMetric] = None,
    usage_amount: Optional[int] = None,
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
    provider: Optional[str] = None,
    reference_type: str = IMAGE_HOLD_REFERENCE,
) -> None:
    """Settle holds and record usage for single-rate modalities."""
    if not billing_context:
        return

    is_estimated = False
    estimate_reason = None

    cost_raw = pricing_service.calculate_cost_kopeks(
        units, billing_context.rate_card, 0
    )
    cost_charged = pricing_service.calculate_cost_kopeks(
        units, billing_context.rate_card, billing_context.discount_percent
    )

    charge_entry = None
    if billing_context.billing_source == BillingSource.PAYG.value:
        if billing_context.hold_amount_kopeks > 0:
            charge_amount = min(cost_charged, billing_context.hold_amount_kopeks)
            if charge_amount < cost_charged:
                is_estimated = True
                estimate_reason = "charge_exceeds_hold"
                cost_charged = charge_amount
            try:
                charge_entry = await run_in_threadpool(
                    wallet_service.settle_hold,
                    billing_context.wallet_id,
                    billing_context.request_id,
                    reference_type,
                    charge_amount,
                )
            except WalletError as e:
                log.exception(
                    f"Failed to settle hold for {billing_context.request_id}: {e}"
                )
                return
        else:
            if cost_charged > 0:
                is_estimated = True
                estimate_reason = "hold_missing"
                cost_charged = 0
    else:
        cost_charged = 0

    wallet_snapshot: Optional[JsonDict] = None
    if charge_entry:
        wallet_snapshot = {
            "balance_included_after": charge_entry.balance_included_after,
            "balance_topup_after": charge_entry.balance_topup_after,
        }

    usage_event = UsageEventModel(
        id=str(uuid.uuid4()),
        user_id=billing_context.user_id,
        wallet_id=billing_context.wallet_id,
        plan_id=billing_context.plan_id,
        subscription_id=billing_context.subscription_id,
        chat_id=chat_id,
        message_id=message_id,
        request_id=billing_context.request_id,
        model_id=billing_context.model_id,
        modality=billing_context.modality,
        provider=provider,
        measured_units_json=measured_units,
        cost_raw_kopeks=cost_raw,
        cost_charged_kopeks=cost_charged,
        billing_source=billing_context.billing_source,
        is_estimated=is_estimated,
        estimate_reason=estimate_reason,
        pricing_version=billing_context.rate_card.version,
        pricing_rate_card_id=billing_context.rate_card.id,
        wallet_snapshot_json=wallet_snapshot,
        created_at=int(time.time()),
    )

    await run_in_threadpool(UsageEvents.create_usage_event, usage_event)

    if billing_context.billing_source == BillingSource.LEAD_MAGNET.value:
        increments = _resolve_lead_magnet_units(
            billing_context, measured_units, usage_metric, usage_amount
        )
        if increments:
            await run_in_threadpool(
                consume_lead_magnet_usage,
                billing_context.user_id,
                increments,
            )
        return

    if usage_metric and usage_amount:
        has_subscription = await run_in_threadpool(
            billing_service.has_active_subscription, billing_context.user_id
        )
        if has_subscription:
            await run_in_threadpool(
                billing_service.track_usage,
                billing_context.user_id,
                usage_metric,
                usage_amount,
                billing_context.model_id,
                chat_id,
                {"chat_id": chat_id, "message_id": message_id},
            )


# ==================== Response Wrappers ====================


def extract_usage_from_response(
    response: Dict[str, object]
) -> Optional[Dict[str, int]]:
    """
    Extract usage data from API response

    Args:
        response: API response dict

    Returns:
        Usage data dict or None
    """
    if isinstance(response, dict):
        usage_value = response.get("usage")
        if isinstance(usage_value, dict):
            return {
                "prompt_tokens": int(usage_value.get("prompt_tokens", 0) or 0),
                "completion_tokens": int(usage_value.get("completion_tokens", 0) or 0),
                "total_tokens": int(usage_value.get("total_tokens", 0) or 0),
            }
    return None


async def track_non_streaming_response(
    response: Dict[str, object],
    user_id: str,
    model_id: str,
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
    billing_context: Optional[BillingHoldContext] = None,
) -> Dict[str, object]:
    """
    Wrapper for non-streaming responses to track usage

    Args:
        response: API response dict
        user_id: User ID
        model_id: Model ID
        chat_id: Chat ID (optional)
        message_id: Message ID (optional)

    Returns:
        Original response (passthrough)
    """
    try:
        usage_data = extract_usage_from_response(response)
        if billing_context:
            await settle_billing_usage(
                billing_context=billing_context,
                usage_data=usage_data,
                chat_id=chat_id,
                message_id=message_id,
            )
        elif usage_data:
            await track_model_usage(
                user_id=user_id,
                model_id=model_id,
                usage_data=usage_data,
                chat_id=chat_id,
                message_id=message_id,
            )
        else:
            log.debug(f"No usage data found in response for model {model_id}")
    except Exception as e:
        log.error(f"Error in track_non_streaming_response: {e}")

    return response


async def track_streaming_response(
    response_iterator: AsyncGenerator[bytes, None],
    user_id: str,
    model_id: str,
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
    billing_context: Optional[BillingHoldContext] = None,
) -> AsyncGenerator[bytes, None]:
    """
    Wrapper for streaming responses to track usage
    Intercepts the final chunk that contains usage data

    Args:
        response_iterator: Async generator yielding response chunks
        user_id: User ID
        model_id: Model ID
        chat_id: Chat ID (optional)
        message_id: Message ID (optional)

    Yields:
        Response chunks (passthrough)
    """
    usage_data = None

    try:
        async for chunk in response_iterator:
            # Yield chunk first (passthrough)
            yield chunk

            # Try to extract usage from chunk
            # Streaming responses send usage in the last chunk
            try:
                # Chunks are in format: "data: {...}\n\n"
                if chunk.startswith(b"data: "):
                    data_str = chunk[6:].strip()  # Remove "data: " prefix

                    # Skip [DONE] marker
                    if data_str == b"[DONE]":
                        continue

                    # Parse JSON
                    try:
                        data = json.loads(data_str)
                        if isinstance(data, dict) and "usage" in data:
                            chunk_usage = extract_usage_from_response(data)
                            if chunk_usage:
                                usage_data = chunk_usage
                                log.debug(f"Extracted usage from streaming chunk: {usage_data}")
                    except json.JSONDecodeError:
                        # Not JSON, skip
                        pass
            except Exception as e:
                log.debug(f"Error parsing chunk for usage: {e}")
                continue

        # After iterator is exhausted, track usage if found
        if billing_context:
            await settle_billing_usage(
                billing_context=billing_context,
                usage_data=usage_data,
                chat_id=chat_id,
                message_id=message_id,
            )
        elif usage_data:
            await track_model_usage(
                user_id=user_id,
                model_id=model_id,
                usage_data=usage_data,
                chat_id=chat_id,
                message_id=message_id,
            )
        else:
            log.debug(f"No usage data found in streaming response for model {model_id}")

    except Exception as e:
        log.error(f"Error in track_streaming_response: {e}")
        if billing_context:
            await release_billing_hold(billing_context)
        # Continue yielding even if tracking fails
        async for chunk in response_iterator:
            yield chunk


# ==================== Helper Functions ====================


def estimate_tokens_from_messages(messages: list) -> int:
    """
    Rough estimation of token count from messages
    This is a very rough approximation: ~4 chars = 1 token

    Args:
        messages: List of message dicts

    Returns:
        Estimated token count
    """
    total_chars = 0
    for message in messages:
        content = message.get("content", "")
        if isinstance(content, str):
            total_chars += len(content)
        elif isinstance(content, list):
            # Handle multimodal content
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    total_chars += len(item.get("text", ""))

    # Rough approximation: 4 characters ≈ 1 token
    estimated_tokens = total_chars // 4
    return max(estimated_tokens, 1)


def is_billing_enabled(user_id: str) -> bool:
    """
    Check if billing is enabled for user

    Args:
        user_id: User ID

    Returns:
        True if user has active subscription
    """
    try:
        return billing_service.has_active_subscription(user_id)
    except Exception as e:
        log.error(f"Error checking if billing enabled: {e}")
        return False
