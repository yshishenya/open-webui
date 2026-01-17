from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Dict, Optional
import math

from open_webui.config import (
    LEAD_MAGNET_CONFIG_VERSION,
    LEAD_MAGNET_CYCLE_DAYS,
    LEAD_MAGNET_ENABLED,
    LEAD_MAGNET_QUOTAS,
)
from open_webui.models.billing import LeadMagnetStateModel, LeadMagnetStates
from open_webui.models.models import Models


@dataclass(frozen=True)
class LeadMagnetConfig:
    enabled: bool
    cycle_days: int
    quotas: Dict[str, int]
    config_version: int


@dataclass(frozen=True)
class LeadMagnetDecision:
    allowed: bool
    state: Optional[LeadMagnetStateModel]
    remaining: Dict[str, int]


def get_lead_magnet_config() -> LeadMagnetConfig:
    return LeadMagnetConfig(
        enabled=bool(LEAD_MAGNET_ENABLED.value),
        cycle_days=max(1, int(LEAD_MAGNET_CYCLE_DAYS.value)),
        quotas=_normalize_quotas(LEAD_MAGNET_QUOTAS.value),
        config_version=int(LEAD_MAGNET_CONFIG_VERSION.value),
    )


def is_lead_magnet_model(model_id: str) -> bool:
    model = Models.get_model_by_id(model_id)
    if not model or not model.meta:
        return False
    meta = model.meta
    if isinstance(meta, dict):
        return bool(meta.get("lead_magnet", False))
    return bool(getattr(meta, "lead_magnet", False))


def evaluate_lead_magnet(
    user_id: str,
    model_id: str,
    requirements: Dict[str, int],
    now: Optional[int] = None,
) -> LeadMagnetDecision:
    config = get_lead_magnet_config()
    if not config.enabled:
        return LeadMagnetDecision(allowed=False, state=None, remaining={})
    if not is_lead_magnet_model(model_id):
        return LeadMagnetDecision(allowed=False, state=None, remaining={})

    now_value = now if now is not None else int(time.time())
    state = _get_or_create_state(user_id, config, now_value)
    remaining = calculate_remaining(state, config.quotas)
    if not _can_consume(remaining, requirements):
        return LeadMagnetDecision(allowed=False, state=state, remaining=remaining)

    return LeadMagnetDecision(allowed=True, state=state, remaining=remaining)


def consume_lead_magnet_usage(
    user_id: str,
    increments: Dict[str, int],
    now: Optional[int] = None,
) -> Optional[LeadMagnetStateModel]:
    config = get_lead_magnet_config()
    if not config.enabled:
        return None

    now_value = now if now is not None else int(time.time())
    state = _get_or_create_state(user_id, config, now_value)
    updates: Dict[str, int] = {}

    for key, amount in _normalize_quotas(increments).items():
        if amount <= 0:
            continue
        current_value = _get_used_value(state, key)
        updates[f"{key}_used"] = current_value + amount

    if not updates:
        return state

    updates["updated_at"] = now_value
    updated_state = LeadMagnetStates.update_state_by_id(state.id, updates)
    return updated_state or state


def get_lead_magnet_state(
    user_id: str, now: Optional[int] = None
) -> Optional[LeadMagnetStateModel]:
    config = get_lead_magnet_config()
    if not config.enabled:
        return None

    state = LeadMagnetStates.get_state_by_user(user_id)
    if not state:
        return None

    now_value = now if now is not None else int(time.time())
    return _refresh_state(state, config, now_value)


def calculate_remaining(
    state: LeadMagnetStateModel, quotas: Dict[str, int]
) -> Dict[str, int]:
    remaining: Dict[str, int] = {}
    for key, limit in _normalize_quotas(quotas).items():
        used = _get_used_value(state, key)
        remaining[key] = max(0, limit - used)
    return remaining


def _get_or_create_state(
    user_id: str, config: LeadMagnetConfig, now_value: int
) -> LeadMagnetStateModel:
    state = LeadMagnetStates.get_state_by_user(user_id)
    if not state:
        return _create_state(user_id, config, now_value)

    refreshed_state = _refresh_state(state, config, now_value)
    return refreshed_state


def _create_state(
    user_id: str, config: LeadMagnetConfig, now_value: int
) -> LeadMagnetStateModel:
    cycle_end = now_value + (config.cycle_days * 86400)
    state = LeadMagnetStateModel(
        id=str(uuid.uuid4()),
        user_id=user_id,
        cycle_start=now_value,
        cycle_end=cycle_end,
        tokens_input_used=0,
        tokens_output_used=0,
        images_used=0,
        tts_seconds_used=0,
        stt_seconds_used=0,
        config_version=config.config_version,
        created_at=now_value,
        updated_at=now_value,
    )
    return LeadMagnetStates.create_state(state)


def _refresh_state(
    state: LeadMagnetStateModel,
    config: LeadMagnetConfig,
    now_value: int,
) -> LeadMagnetStateModel:
    updates: Dict[str, int] = {}
    cycle_end = state.cycle_end

    if state.config_version != config.config_version:
        cycle_end = state.cycle_start + (config.cycle_days * 86400)
        updates["config_version"] = config.config_version
        updates["cycle_end"] = cycle_end

    needs_reset = now_value >= cycle_end
    if needs_reset:
        updates = {
            "cycle_start": now_value,
            "cycle_end": now_value + (config.cycle_days * 86400),
            "tokens_input_used": 0,
            "tokens_output_used": 0,
            "images_used": 0,
            "tts_seconds_used": 0,
            "stt_seconds_used": 0,
            "config_version": config.config_version,
        }

    if updates:
        updates["updated_at"] = now_value
        updated_state = LeadMagnetStates.update_state_by_id(state.id, updates)
        if updated_state:
            return updated_state

    return state


def _get_used_value(state: LeadMagnetStateModel, key: str) -> int:
    mapping = {
        "tokens_input": state.tokens_input_used,
        "tokens_output": state.tokens_output_used,
        "images": state.images_used,
        "tts_seconds": state.tts_seconds_used,
        "stt_seconds": state.stt_seconds_used,
    }
    return mapping.get(key, 0)


def _can_consume(remaining: Dict[str, int], requirements: Dict[str, int]) -> bool:
    for key, amount in requirements.items():
        if amount <= 0:
            continue
        if remaining.get(key, 0) < amount:
            return False
    return True


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


def estimate_tts_seconds(char_count: int) -> int:
    if char_count <= 0:
        return 0
    chars_per_second = 15
    return max(1, int(math.ceil(char_count / chars_per_second)))
