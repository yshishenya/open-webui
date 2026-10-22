"""A delayed read or save must not roll back the published allowance settings."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from open_webui.utils.airis import runtime_config


@pytest.fixture(autouse=True)
def isolated_runtime_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        runtime_config,
        '_runtime_config',
        runtime_config.LeadMagnetRuntimeConfig(
            enabled=False,
            cycle_days=30,
            quotas=runtime_config.DEFAULT_LEAD_MAGNET_QUOTAS.copy(),
            config_version=0,
        ),
    )


def publish(version: int, *, enabled: bool = True) -> runtime_config.LeadMagnetRuntimeConfig:
    return runtime_config.set_lead_magnet_runtime_config(
        enabled=enabled,
        cycle_days=7,
        quotas={'tokens_input': 200},
        config_version=version,
    )


def test_delayed_save_publication_cannot_replace_a_newer_version() -> None:
    latest = publish(3, enabled=False)
    stale = publish(2)
    assert stale is latest
    assert runtime_config.get_lead_magnet_runtime_config() is latest
    assert latest.enabled is False
    assert latest.config_version == 3


def test_initial_and_equal_versions_publish_and_keep_normalization() -> None:
    initial = publish(0)
    assert initial.enabled is True
    assert initial.config_version == 0
    refreshed = runtime_config.set_lead_magnet_runtime_config(
        enabled=False,
        cycle_days=0,
        quotas={'tokens_input': 50, 'tokens_output': -1, 'images': True},
        config_version=0,
    )
    assert runtime_config.get_lead_magnet_runtime_config() is refreshed
    assert refreshed.enabled is False
    assert refreshed.cycle_days == 1
    assert refreshed.quotas == {**runtime_config.DEFAULT_LEAD_MAGNET_QUOTAS, 'tokens_input': 50}
    assert publish(1).config_version == 1


def test_delayed_refresh_cannot_overwrite_a_successful_save(monkeypatch: pytest.MonkeyPatch) -> None:
    async def race() -> None:
        captured = asyncio.Event()
        release = asyncio.Event()

        async def get_many(*keys: str) -> dict[str, object]:
            snapshot: dict[str, object] = {
                runtime_config.LEAD_MAGNET_ENABLED_KEY: True,
                runtime_config.LEAD_MAGNET_CYCLE_DAYS_KEY: 30,
                runtime_config.LEAD_MAGNET_QUOTAS_KEY: {'tokens_input': 100},
                runtime_config.LEAD_MAGNET_CONFIG_VERSION_KEY: 1,
            }
            captured.set()
            await release.wait()
            return snapshot

        monkeypatch.setattr(runtime_config.Config, 'get_many', get_many)
        old_refresh = asyncio.create_task(runtime_config.refresh_lead_magnet_runtime_config())
        await captured.wait()
        latest = publish(2, enabled=False)
        release.set()
        assert await old_refresh is latest
        assert runtime_config.get_lead_magnet_runtime_config() is latest
        assert latest.enabled is False
        assert latest.quotas['tokens_input'] == 200

    asyncio.run(race())


def test_refresh_can_publish_a_newer_database_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    publish(1)
    monkeypatch.setattr(
        runtime_config.Config,
        'get_many',
        AsyncMock(
            return_value={
                runtime_config.LEAD_MAGNET_ENABLED_KEY: False,
                runtime_config.LEAD_MAGNET_CYCLE_DAYS_KEY: 14,
                runtime_config.LEAD_MAGNET_QUOTAS_KEY: {'tokens_input': 300},
                runtime_config.LEAD_MAGNET_CONFIG_VERSION_KEY: 2,
            }
        ),
    )
    latest = asyncio.run(runtime_config.refresh_lead_magnet_runtime_config())
    assert latest is runtime_config.get_lead_magnet_runtime_config()
    assert latest.config_version == 2
    assert latest.enabled is False
    assert latest.cycle_days == 14
    assert latest.quotas['tokens_input'] == 300
