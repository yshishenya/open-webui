from __future__ import annotations

from dataclasses import dataclass

from open_webui.models.config import Config

LEAD_MAGNET_ENABLED_KEY = 'billing.lead_magnet.enabled'
LEAD_MAGNET_CYCLE_DAYS_KEY = 'billing.lead_magnet.cycle_days'
LEAD_MAGNET_QUOTAS_KEY = 'billing.lead_magnet.quotas'
LEAD_MAGNET_CONFIG_VERSION_KEY = 'billing.lead_magnet.config_version'

DEFAULT_LEAD_MAGNET_QUOTAS: dict[str, int] = {
    'tokens_input': 0,
    'tokens_output': 0,
    'images': 0,
    'tts_seconds': 0,
    'stt_seconds': 0,
}


@dataclass(frozen=True)
class LeadMagnetRuntimeConfig:
    enabled: bool
    cycle_days: int
    quotas: dict[str, int]
    config_version: int


_runtime_config = LeadMagnetRuntimeConfig(
    enabled=False,
    cycle_days=30,
    quotas=DEFAULT_LEAD_MAGNET_QUOTAS.copy(),
    config_version=0,
)


def _normalize_quotas(value: object) -> dict[str, int]:
    quotas = DEFAULT_LEAD_MAGNET_QUOTAS.copy()
    if not isinstance(value, dict):
        return quotas

    for key in quotas:
        item = value.get(key)
        if isinstance(item, int) and not isinstance(item, bool) and item >= 0:
            quotas[key] = item
    return quotas


def _coerce_int(value: object, *, default: int, minimum: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        return default
    return max(minimum, parsed)


def get_lead_magnet_runtime_config() -> LeadMagnetRuntimeConfig:
    return _runtime_config


def set_lead_magnet_runtime_config(
    *,
    enabled: bool,
    cycle_days: int,
    quotas: object,
    config_version: int,
) -> LeadMagnetRuntimeConfig:
    global _runtime_config
    _runtime_config = LeadMagnetRuntimeConfig(
        enabled=enabled,
        cycle_days=max(1, cycle_days),
        quotas=_normalize_quotas(quotas),
        config_version=max(0, config_version),
    )
    return _runtime_config


async def refresh_lead_magnet_runtime_config() -> LeadMagnetRuntimeConfig:
    values = await Config.get_many(
        LEAD_MAGNET_ENABLED_KEY,
        LEAD_MAGNET_CYCLE_DAYS_KEY,
        LEAD_MAGNET_QUOTAS_KEY,
        LEAD_MAGNET_CONFIG_VERSION_KEY,
    )
    return set_lead_magnet_runtime_config(
        enabled=bool(values.get(LEAD_MAGNET_ENABLED_KEY, False)),
        cycle_days=_coerce_int(
            values.get(LEAD_MAGNET_CYCLE_DAYS_KEY),
            default=30,
            minimum=1,
        ),
        quotas=values.get(LEAD_MAGNET_QUOTAS_KEY),
        config_version=_coerce_int(
            values.get(LEAD_MAGNET_CONFIG_VERSION_KEY),
            default=0,
            minimum=0,
        ),
    )
