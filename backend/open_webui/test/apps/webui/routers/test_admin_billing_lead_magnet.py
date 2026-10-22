"""Regression coverage for conflicting allowance edits, including the first save."""

import asyncio

import pytest
from _pytest.monkeypatch import MonkeyPatch
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestAdminBillingLeadMagnet(AbstractPostgresTest):
    BASE_PATH = '/api/v1/admin/billing'

    def test_stale_config_returns_409_without_changing_saved_values(self, monkeypatch: MonkeyPatch) -> None:
        from open_webui.models.config import Config
        from open_webui.utils.airis import runtime_config

        monkeypatch.setattr(Config, 'PERSISTENT_ENABLED', True)
        monkeypatch.setattr(Config, 'DEFAULTS', {})
        monkeypatch.setattr(runtime_config, '_runtime_config', runtime_config.get_lead_magnet_runtime_config())
        draft: dict[str, object] = {
            'expected_config_version': 0,
            'enabled': True,
            'cycle_days': 30,
            'quotas': {'tokens_input': 100, 'tokens_output': 200},
        }
        with mock_webui_user(role='admin'):
            first = self.fast_api_client.post(self.create_url('/lead-magnet'), json=draft)
            assert first.status_code == 200
            assert first.json()['config_version'] == 1
            stale = self.fast_api_client.post(
                self.create_url('/lead-magnet'),
                json={**draft, 'enabled': False, 'cycle_days': 7},
            )
            assert stale.status_code == 409
            saved = self.fast_api_client.get(self.create_url('/lead-magnet')).json()
        assert saved == first.json()
        assert saved['enabled'] is True
        assert saved['cycle_days'] == 30

    def test_missing_or_invalid_expected_version_is_rejected(self) -> None:
        draft: dict[str, object] = {'enabled': True, 'cycle_days': 30, 'quotas': {}}
        with mock_webui_user(role='admin'):
            for version in [None, -1, True, '0']:
                payload = draft if version is None else {**draft, 'expected_config_version': version}
                response = self.fast_api_client.post(self.create_url('/lead-magnet'), json=payload)
                assert response.status_code == 422

    @pytest.mark.parametrize('initial_version', [0, 3])
    def test_concurrent_saves_have_exactly_one_winner(self, monkeypatch: MonkeyPatch, initial_version: int) -> None:
        from open_webui.models.config import Config
        from open_webui.utils.airis import runtime_config
        from open_webui.utils.airis.runtime_config import (
            LEAD_MAGNET_CONFIG_VERSION_KEY,
            LEAD_MAGNET_CYCLE_DAYS_KEY,
            save_lead_magnet_config_if_current,
        )

        monkeypatch.setattr(Config, 'PERSISTENT_ENABLED', True)
        monkeypatch.setattr(Config, 'DEFAULTS', {})
        monkeypatch.setattr(runtime_config, '_runtime_config', runtime_config.get_lead_magnet_runtime_config())

        async def race() -> None:
            if initial_version:
                await Config.upsert({LEAD_MAGNET_CONFIG_VERSION_KEY: initial_version})
            results = await asyncio.gather(
                *(
                    save_lead_magnet_config_if_current(
                        expected_version=initial_version,
                        enabled=True,
                        cycle_days=days,
                        quotas={'tokens_input': days},
                    )
                    for days in (7, 30)
                )
            )
            winners = [result for result in results if result is not None]
            assert len(winners) == 1
            saved = await Config.get_many(LEAD_MAGNET_CONFIG_VERSION_KEY, LEAD_MAGNET_CYCLE_DAYS_KEY)
            assert saved[LEAD_MAGNET_CONFIG_VERSION_KEY] == initial_version + 1
            assert saved[LEAD_MAGNET_CYCLE_DAYS_KEY] == winners[0].cycle_days

        asyncio.run(race())
