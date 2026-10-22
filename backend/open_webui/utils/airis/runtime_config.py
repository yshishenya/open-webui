from __future__ import annotations

import time
from dataclasses import dataclass

from open_webui.internal.db import get_async_db
from open_webui.models.config import Config
from sqlalchemy import String, cast, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

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
    config_version = max(0, config_version)
    # A refresh or committed save may resume after a newer version was published.
    if config_version < _runtime_config.config_version:
        return _runtime_config
    _runtime_config = LeadMagnetRuntimeConfig(
        enabled=enabled,
        cycle_days=max(1, cycle_days),
        quotas=_normalize_quotas(quotas),
        config_version=config_version,
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


async def save_lead_magnet_config_if_current(
    *, expected_version: int, enabled: bool, cycle_days: int, quotas: dict[str, int]
) -> LeadMagnetRuntimeConfig | None:
    """Compare-and-swap the version and all allowance fields in one transaction."""
    if not Config.persistent_enabled_for(LEAD_MAGNET_CONFIG_VERSION_KEY):
        raise RuntimeError('Persistent lead magnet configuration is disabled')

    async with get_async_db() as db:
        # The conflict-safe insert also serializes first-ever saves on a missing version row.
        insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else postgres_insert
        now = int(time.time())
        await db.execute(
            insert(Config)
            .values(
                key=LEAD_MAGNET_CONFIG_VERSION_KEY,
                value=Config.default_value(LEAD_MAGNET_CONFIG_VERSION_KEY, 0),
                updated_at=now,
            )
            .on_conflict_do_nothing(index_elements=['key'])
        )
        result = await db.execute(
            update(Config)
            .where(
                Config.key == LEAD_MAGNET_CONFIG_VERSION_KEY,
                cast(Config.value, String) == str(expected_version),
            )
            .values(value=expected_version + 1, updated_at=now)
        )
        if result.rowcount != 1:
            await db.rollback()
            return None

        updates: dict[str, bool | int | dict[str, int]] = {
            LEAD_MAGNET_ENABLED_KEY: enabled,
            LEAD_MAGNET_CYCLE_DAYS_KEY: cycle_days,
            LEAD_MAGNET_QUOTAS_KEY: quotas,
        }
        for key, value in updates.items():
            statement = insert(Config).values(key=key, value=value, updated_at=now)
            await db.execute(
                statement.on_conflict_do_update(index_elements=['key'], set_={'value': value, 'updated_at': now})
            )
        await db.commit()

    return set_lead_magnet_runtime_config(
        enabled=enabled,
        cycle_days=cycle_days,
        quotas=quotas,
        config_version=expected_version + 1,
    )
