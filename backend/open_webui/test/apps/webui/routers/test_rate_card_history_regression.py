"""Synthetic price revisions must not reprice persisted usage history."""

from decimal import Decimal
from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestRateCardHistoryRegression(AbstractPostgresTest):
    BASE_PATH = '/api/v1/admin/billing'

    def _seed_usage(self) -> None:
        from open_webui.models.billing import (
            PricingRateCardModel,
            RateCards,
            UsageEventModel,
            UsageEvents,
        )
        from open_webui.utils.pricing import PricingService

        pricing = PricingService()
        raw_parts: list[int] = []
        charged_parts: list[int] = []
        for unit, cost, units in (
            ('token_in', 100, Decimal('1')),
            ('token_out', 200, Decimal('0.4')),
        ):
            rate = RateCards.create_rate_card(
                PricingRateCardModel(
                    id=f'original-{unit}',
                    model_id='g3-model',
                    modality='text',
                    unit=unit,
                    raw_cost_per_unit_kopeks=cost,
                    version='g3-original',
                    created_at=100,
                    is_default=False,
                    is_active=True,
                ).model_dump()
            )
            raw_parts.append(pricing.calculate_cost_kopeks(units, rate))
            charged_parts.append(pricing.calculate_cost_kopeks(units, rate, 25))
        UsageEvents.create_usage_event(
            UsageEventModel(
                id='historical-usage',
                user_id='g3-user',
                wallet_id='synthetic-wallet',
                request_id='g3-request',
                model_id='g3-model',
                modality='text',
                prompt_tokens=1000,
                completion_tokens=400,
                measured_units_json={'token_in': 1000, 'token_out': 400},
                cost_raw_kopeks=sum(raw_parts),
                cost_raw_input_kopeks=raw_parts[0],
                cost_raw_output_kopeks=raw_parts[1],
                cost_charged_kopeks=sum(charged_parts),
                cost_charged_input_kopeks=charged_parts[0],
                cost_charged_output_kopeks=charged_parts[1],
                pricing_version='g3-original',
                pricing_rate_card_id='original-token_in',
                pricing_rate_card_input_id='original-token_in',
                pricing_rate_card_output_id='original-token_out',
                created_at=150,
            )
        )

    @pytest.mark.parametrize('revision_path', ['editor', 'patch'])
    def test_revision_and_deactivation_preserve_usage_cost_parts_and_rate_references(
        self,
        monkeypatch: MonkeyPatch,
        revision_path: str,
    ) -> None:
        from open_webui.models.billing import RateCards, UsageEvents
        from open_webui.routers import admin_billing_rate_card
        from open_webui.utils.pricing import PricingService

        monkeypatch.setattr(admin_billing_rate_card, 'ENABLE_BILLING_WALLET', True)
        monkeypatch.setattr(admin_billing_rate_card, 'time', SimpleNamespace(time=lambda: 200))
        self._seed_usage()
        original = UsageEvents.list_events_by_user('g3-user')[0].model_dump()
        assert (original['cost_raw_kopeks'], original['cost_charged_kopeks']) == (
            180,
            135,
        )
        assert (
            original['cost_charged_input_kopeks'],
            original['cost_charged_output_kopeks'],
        ) == (75, 60)

        revised_ids: list[str] = []
        with mock_webui_user(role='admin'):
            for unit, new_cost in (('token_in', 300), ('token_out', 500)):
                old_id = f'original-{unit}'
                old_rate = RateCards.get_rate_card_by_id(old_id)
                assert old_rate is not None
                old_snapshot = old_rate.model_dump()
                if revision_path == 'editor':
                    response = self.fast_api_client.post(
                        self.create_url('/rate-card'),
                        json={
                            'model_id': 'g3-model',
                            'modality': 'text',
                            'unit': unit,
                            'raw_cost_per_unit_kopeks': new_cost,
                            'version': 'g3-original',
                            'is_active': True,
                        },
                    )
                    assert response.status_code == 201, response.text
                    deactivated = self.fast_api_client.patch(
                        self.create_url(f'/rate-card/{old_id}'),
                        json={'is_active': False},
                    )
                    assert deactivated.status_code == 200, deactivated.text
                else:
                    response = self.fast_api_client.patch(
                        self.create_url(f'/rate-card/{old_id}'),
                        json={'raw_cost_per_unit_kopeks': new_cost},
                    )
                    assert response.status_code == 200, response.text
                revised_id = response.json()['id']
                revised_ids.append(revised_id)
                assert revised_id != old_id
                active = RateCards.get_active_rate_card('g3-model', 'text', unit)
                assert active is not None
                assert (active.id, active.raw_cost_per_unit_kopeks) == (
                    revised_id,
                    new_cost,
                )
                old_after = RateCards.get_rate_card_by_id(old_id)
                assert old_after is not None
                assert old_after.model_dump() == {**old_snapshot, 'is_active': False}
                assert UsageEvents.list_events_by_user('g3-user')[0].model_dump() == original

            # New work uses the new rates, while the saved event retains both old cost parts.
            pricing = PricingService()
            current = [RateCards.get_rate_card_by_id(rate_id) for rate_id in revised_ids]
            assert all(rate is not None for rate in current)
            assert (
                sum(
                    pricing.calculate_cost_kopeks(units, rate, 25)
                    for units, rate in zip((Decimal('1'), Decimal('0.4')), current)
                )
                == 375
            )
            for rate_id in revised_ids:
                response = self.fast_api_client.patch(
                    self.create_url(f'/rate-card/{rate_id}'),
                    json={'is_active': False},
                )
                assert response.status_code == 200, response.text

        assert RateCards.get_active_rate_card('g3-model', 'text', 'token_in') is None
        assert RateCards.get_active_rate_card('g3-model', 'text', 'token_out') is None
        events = UsageEvents.list_events_by_user('g3-user')
        assert [event.model_dump() for event in events] == [original]
        for unit in ('token_in', 'token_out'):
            assert RateCards.get_rate_card_by_id(f'original-{unit}') is not None
