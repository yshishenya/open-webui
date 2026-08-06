# ruff: noqa

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Dict, Optional
import math

import sqlalchemy as sa

from open_webui.internal.db import get_db
from open_webui.models.billing import (
    LeadMagnetState,
    LeadMagnetStateModel,
    LeadMagnetStates,
    QuotaReservation,
    UsageEvent,
    UsageEventModel,
    Wallet,
)
from open_webui.models.models import Model
from open_webui.utils.airis.runtime_config import get_lead_magnet_runtime_config


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
    runtime_config = get_lead_magnet_runtime_config()
    return LeadMagnetConfig(
        enabled=runtime_config.enabled,
        cycle_days=runtime_config.cycle_days,
        quotas=runtime_config.quotas.copy(),
        config_version=runtime_config.config_version,
    )


def is_lead_magnet_model(model_id: str) -> bool:
    with get_db() as db:
        model = db.get(Model, model_id)
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


def reserve_lead_magnet_usage(
    user_id: str,
    wallet_id: str,
    model_id: str,
    operation_id: str,
    requirements: Dict[str, int],
    expires_at: int,
    now: Optional[int] = None,
) -> Optional[str]:
    """Atomically reserve lead-magnet quota for one billing operation."""
    config = get_lead_magnet_config()
    if not config.enabled or not is_lead_magnet_model(model_id):
        return None

    now_value = now if now is not None else int(time.time())
    normalized = {key: amount for key, amount in _normalize_quotas(requirements).items() if amount > 0}
    with get_db() as db:
        _begin_immediate(db)
        wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == user_id).with_for_update().first()
        if not wallet:
            raise ValueError("Wallet does not belong to lead-magnet user")

        existing = db.query(QuotaReservation).filter(QuotaReservation.operation_id == operation_id).first()
        if existing:
            if (
                existing.source != "lead_magnet"
                or existing.user_id != user_id
                or existing.wallet_id != wallet_id
                or existing.requirements_json != normalized
            ):
                raise ValueError("Billing operation reused with different lead-magnet quota data")
            db.commit()
            return str(existing.id)

        _release_expired_lead_reservations_locked(db, user_id, now_value)
        state = _get_or_create_state_row_locked(db, user_id, config, now_value)
        state_model = LeadMagnetStateModel.model_validate(state)
        if not _can_consume(
            calculate_remaining(state_model, config.quotas),
            normalized,
        ):
            db.commit()
            return None

        _apply_state_delta(state, normalized, 1)
        state.updated_at = now_value
        reservation = QuotaReservation(
            id=str(uuid.uuid4()),
            operation_id=operation_id,
            user_id=user_id,
            wallet_id=wallet_id,
            source="lead_magnet",
            requirements_json=normalized,
            expires_at=expires_at,
            created_at=now_value,
        )
        db.add(reservation)
        db.commit()
        return str(reservation.id)


def finalize_lead_magnet_usage(
    reservation_id: str,
    actual_usage: Dict[str, int],
    usage_event: UsageEventModel,
) -> None:
    """Atomically replace reserved quota with actual usage and store usage."""
    with get_db() as db:
        _begin_immediate(db)
        reservation = db.query(QuotaReservation).filter(QuotaReservation.id == reservation_id).with_for_update().first()
        if not reservation:
            existing = (
                db.query(UsageEvent)
                .filter(
                    UsageEvent.wallet_id == usage_event.wallet_id,
                    UsageEvent.request_id == usage_event.request_id,
                    UsageEvent.modality == usage_event.modality,
                )
                .first()
            )
            if existing:
                return
            raise ValueError("Lead-magnet quota reservation not found")
        if (
            reservation.source != "lead_magnet"
            or reservation.user_id != usage_event.user_id
            or reservation.wallet_id != usage_event.wallet_id
        ):
            raise ValueError("Lead-magnet quota reservation does not match usage")

        wallet = db.query(Wallet).filter(Wallet.id == reservation.wallet_id).with_for_update().first()
        state = (
            db.query(LeadMagnetState).filter(LeadMagnetState.user_id == reservation.user_id).with_for_update().first()
        )
        if not wallet or not state:
            raise ValueError("Lead-magnet billing state not found")

        reserved = {
            key: amount for key, amount in _normalize_quotas(reservation.requirements_json or {}).items() if amount > 0
        }
        actual = {key: amount for key, amount in _normalize_quotas(actual_usage).items() if amount > 0}
        _apply_state_delta(state, reserved, -1)
        _apply_state_delta(state, actual, 1)
        state.updated_at = usage_event.created_at

        existing = (
            db.query(UsageEvent)
            .filter(
                UsageEvent.wallet_id == usage_event.wallet_id,
                UsageEvent.request_id == usage_event.request_id,
                UsageEvent.modality == usage_event.modality,
            )
            .first()
        )
        if existing:
            raise ValueError("Usage already exists while quota is still reserved")
        payload = usage_event.model_dump()
        payload["wallet_snapshot_json"] = {
            "balance_included_after": int(wallet.balance_included_kopeks),
            "balance_topup_after": int(wallet.balance_topup_kopeks),
        }
        db.add(UsageEvent(**payload))
        db.delete(reservation)
        db.commit()


def release_quota_reservation(reservation_id: str) -> None:
    """Release lead-magnet or subscription quota after request failure."""
    with get_db() as db:
        _begin_immediate(db)
        reservation = db.query(QuotaReservation).filter(QuotaReservation.id == reservation_id).with_for_update().first()
        if not reservation:
            return
        db.query(Wallet).filter(Wallet.id == reservation.wallet_id).with_for_update().first()
        if reservation.source == "lead_magnet":
            state = (
                db.query(LeadMagnetState)
                .filter(LeadMagnetState.user_id == reservation.user_id)
                .with_for_update()
                .first()
            )
            if state:
                _apply_state_delta(
                    state,
                    _normalize_quotas(reservation.requirements_json or {}),
                    -1,
                )
                state.updated_at = int(time.time())
        db.delete(reservation)
        db.commit()


def cleanup_expired_quota_reservations(limit: int = 500) -> int:
    """Release expired quota reservations in bounded batches."""
    now = int(time.time())
    with get_db() as db:
        reservation_ids = [
            str(row[0])
            for row in db.query(QuotaReservation.id).filter(QuotaReservation.expires_at <= now).limit(limit).all()
        ]
    for reservation_id in reservation_ids:
        release_quota_reservation(reservation_id)
    return len(reservation_ids)


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


def get_lead_magnet_state(user_id: str, now: Optional[int] = None) -> Optional[LeadMagnetStateModel]:
    config = get_lead_magnet_config()
    if not config.enabled:
        return None

    state = LeadMagnetStates.get_state_by_user(user_id)
    if not state:
        return None

    now_value = now if now is not None else int(time.time())
    return _refresh_state(state, config, now_value)


def calculate_remaining(state: LeadMagnetStateModel, quotas: Dict[str, int]) -> Dict[str, int]:
    remaining: Dict[str, int] = {}
    for key, limit in _normalize_quotas(quotas).items():
        used = _get_used_value(state, key)
        remaining[key] = max(0, limit - used)
    return remaining


def _get_or_create_state(user_id: str, config: LeadMagnetConfig, now_value: int) -> LeadMagnetStateModel:
    state = LeadMagnetStates.get_state_by_user(user_id)
    if not state:
        return _create_state(user_id, config, now_value)

    refreshed_state = _refresh_state(state, config, now_value)
    return refreshed_state


def _create_state(user_id: str, config: LeadMagnetConfig, now_value: int) -> LeadMagnetStateModel:
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


def _begin_immediate(db) -> None:
    dialect = getattr(db.bind, "dialect", None)
    if dialect and dialect.name == "sqlite":
        db.execute(sa.text("BEGIN IMMEDIATE"))


def _get_or_create_state_row_locked(
    db,
    user_id: str,
    config: LeadMagnetConfig,
    now_value: int,
) -> LeadMagnetState:
    state = db.query(LeadMagnetState).filter(LeadMagnetState.user_id == user_id).with_for_update().first()
    if not state:
        state = LeadMagnetState(
            id=str(uuid.uuid4()),
            user_id=user_id,
            cycle_start=now_value,
            cycle_end=now_value + (config.cycle_days * 86400),
            tokens_input_used=0,
            tokens_output_used=0,
            images_used=0,
            tts_seconds_used=0,
            stt_seconds_used=0,
            config_version=config.config_version,
            created_at=now_value,
            updated_at=now_value,
        )
        db.add(state)
        db.flush()
        return state

    cycle_end = int(state.cycle_end)
    if state.config_version != config.config_version:
        cycle_end = int(state.cycle_start) + (config.cycle_days * 86400)
        state.config_version = config.config_version
        state.cycle_end = cycle_end
    if now_value >= cycle_end:
        state.cycle_start = now_value
        state.cycle_end = now_value + (config.cycle_days * 86400)
        state.tokens_input_used = 0
        state.tokens_output_used = 0
        state.images_used = 0
        state.tts_seconds_used = 0
        state.stt_seconds_used = 0
        state.config_version = config.config_version
    state.updated_at = now_value
    return state


def _apply_state_delta(
    state: LeadMagnetState,
    values: Dict[str, int],
    direction: int,
) -> None:
    for key, amount in values.items():
        if amount <= 0:
            continue
        attribute = f"{key}_used"
        current = int(getattr(state, attribute, 0))
        setattr(state, attribute, max(current + (amount * direction), 0))


def _release_expired_lead_reservations_locked(db, user_id: str, now: int) -> None:
    reservations = (
        db.query(QuotaReservation)
        .filter(
            QuotaReservation.user_id == user_id,
            QuotaReservation.source == "lead_magnet",
            QuotaReservation.expires_at <= now,
        )
        .all()
    )
    if not reservations:
        return
    state = db.query(LeadMagnetState).filter(LeadMagnetState.user_id == user_id).with_for_update().first()
    for reservation in reservations:
        if state:
            _apply_state_delta(
                state,
                _normalize_quotas(reservation.requirements_json or {}),
                -1,
            )
        db.delete(reservation)
    if state:
        state.updated_at = now


def estimate_tts_seconds(char_count: int) -> int:
    if char_count <= 0:
        return 0
    chars_per_second = 15
    return max(1, int(math.ceil(char_count / chars_per_second)))
