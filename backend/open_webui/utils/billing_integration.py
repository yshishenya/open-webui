"""
Billing integration utilities
Handles quota checking and usage tracking for AI model requests
"""

import logging
import json
from typing import Optional, Dict, Any, AsyncGenerator
from fastapi import HTTPException, status

from open_webui.models.billing import UsageMetric
from open_webui.utils.billing import billing_service, QuotaExceededError
from open_webui.env import SRC_LOG_LEVELS

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get("BILLING", logging.INFO))


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
        if not billing_service.has_active_subscription(user_id):
            log.debug(f"User {user_id} has no active subscription, skipping quota check")
            return

        # Check request quota
        try:
            billing_service.enforce_quota(user_id, UsageMetric.REQUESTS, 1)
        except QuotaExceededError as e:
            log.warning(f"Request quota exceeded for user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=str(e),
            )

        # Check token quota if estimated
        if estimated_input_tokens > 0:
            try:
                billing_service.enforce_quota(
                    user_id,
                    UsageMetric.TOKENS_INPUT,
                    estimated_input_tokens
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
        if not billing_service.has_active_subscription(user_id):
            log.debug(f"User {user_id} has no subscription, skipping usage tracking")
            return

        metadata = {
            "chat_id": chat_id,
            "message_id": message_id,
        }

        # Track input tokens
        prompt_tokens = usage_data.get("prompt_tokens", 0)
        if prompt_tokens > 0:
            billing_service.track_usage(
                user_id=user_id,
                metric=UsageMetric.TOKENS_INPUT,
                amount=prompt_tokens,
                model_id=model_id,
                chat_id=chat_id,
                metadata=metadata,
            )
            log.debug(f"Tracked {prompt_tokens} input tokens for user {user_id}")

        # Track output tokens
        completion_tokens = usage_data.get("completion_tokens", 0)
        if completion_tokens > 0:
            billing_service.track_usage(
                user_id=user_id,
                metric=UsageMetric.TOKENS_OUTPUT,
                amount=completion_tokens,
                model_id=model_id,
                chat_id=chat_id,
                metadata=metadata,
            )
            log.debug(f"Tracked {completion_tokens} output tokens for user {user_id}")

        # Track request count
        billing_service.track_usage(
            user_id=user_id,
            metric=UsageMetric.REQUESTS,
            amount=1,
            model_id=model_id,
            chat_id=chat_id,
            metadata=metadata,
        )
        log.debug(f"Tracked 1 request for user {user_id}")

        log.info(
            f"Usage tracked for user {user_id}: "
            f"{prompt_tokens} input + {completion_tokens} output tokens"
        )

    except Exception as e:
        # Log but don't fail the request if tracking fails
        log.error(f"Error tracking usage for user {user_id}: {e}")


# ==================== Response Wrappers ====================


def extract_usage_from_response(response: Dict[str, Any]) -> Optional[Dict[str, int]]:
    """
    Extract usage data from API response

    Args:
        response: API response dict

    Returns:
        Usage data dict or None
    """
    if isinstance(response, dict):
        usage = response.get("usage")
        if usage and isinstance(usage, dict):
            return {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }
    return None


async def track_non_streaming_response(
    response: Dict[str, Any],
    user_id: str,
    model_id: str,
    chat_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> Dict[str, Any]:
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
        if usage_data:
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
        if usage_data:
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
