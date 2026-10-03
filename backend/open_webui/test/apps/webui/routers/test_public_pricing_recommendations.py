from __future__ import annotations

import asyncio
import time

import pytest
from _pytest.monkeypatch import MonkeyPatch
from open_webui.models.billing import PricingRateCardModel, RateCards
from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models
from test.util.abstract_integration_test import AbstractPostgresTest


class TestPublicPricingRecommendations(AbstractPostgresTest):
    BASE_PATH = '/api/v1/billing'

    @pytest.mark.parametrize(
        'case', ['disabled', 'private', 'hidden', 'missing', 'unpriced', 'wrong-modality', 'inactive-rate']
    )
    def test_recommendations_exclude_unavailable_models(self, monkeypatch: MonkeyPatch, case: str) -> None:
        import open_webui.routers.billing as billing

        if case != 'missing':
            model = asyncio.run(
                Models.insert_new_model(
                    ModelForm(
                        id='recommended-image',
                        name='Image',
                        meta=ModelMeta(hidden=case == 'hidden'),
                        params=ModelParams(),
                        is_active=case != 'disabled',
                        access_grants=(
                            []
                            if case == 'private'
                            else [{'principal_type': 'user', 'principal_id': '*', 'permission': 'read'}]
                        ),
                    ),
                    user_id='owner',
                )
            )
            assert model is not None
        if case != 'unpriced':
            RateCards.create_rate_card(
                PricingRateCardModel(
                    id='rate-image',
                    model_id='recommended-image',
                    modality='text' if case == 'wrong-modality' else 'image',
                    unit='token_in' if case == 'wrong-modality' else 'image_1024',
                    raw_cost_per_unit_kopeks=1325,
                    version='test',
                    created_at=int(time.time()),
                    is_active=case != 'inactive-rate',
                ).model_dump()
            )
        monkeypatch.setattr(billing, 'PUBLIC_PRICING_RECOMMENDED_IMAGE_MODEL', 'recommended-image')
        monkeypatch.setattr(billing, 'PUBLIC_PRICING_POPULAR_MODELS', ['recommended-image'])
        response = self.fast_api_client.get(self.create_url('/public/pricing-config'))
        assert response.status_code == 200
        assert response.json()['recommended_model_ids']['image'] is None
        if case != 'wrong-modality':
            assert response.json()['popular_model_ids'] == []

    @pytest.mark.parametrize(
        ('kind', 'modality', 'unit'),
        [
            ('text', 'text', 'token_in'),
            ('image', 'image', 'image_1024'),
            ('audio', 'tts', 'tts_char'),
            ('audio', 'stt', 'stt_second'),
        ],
    )
    def test_public_priced_recommendations_remain(
        self, monkeypatch: MonkeyPatch, kind: str, modality: str, unit: str
    ) -> None:
        import open_webui.routers.billing as billing

        model = asyncio.run(
            Models.insert_new_model(
                ModelForm(
                    id='eligible-model',
                    name='Eligible',
                    meta=ModelMeta(),
                    params=ModelParams(),
                    access_grants=[{'principal_type': 'user', 'principal_id': '*', 'permission': 'read'}],
                ),
                user_id='owner',
            )
        )
        assert model is not None
        RateCards.create_rate_card(
            PricingRateCardModel(
                id='eligible-rate',
                model_id='eligible-model',
                modality=modality,
                unit=unit,
                raw_cost_per_unit_kopeks=10,
                version='test',
                created_at=int(time.time()),
                is_active=True,
            ).model_dump()
        )
        monkeypatch.setattr(billing, f'PUBLIC_PRICING_RECOMMENDED_{kind.upper()}_MODEL', ' eligible-model ')
        monkeypatch.setattr(billing, 'PUBLIC_PRICING_POPULAR_MODELS', ['eligible-model'])
        response = self.fast_api_client.get(self.create_url('/public/pricing-config'))
        assert response.status_code == 200
        assert response.json()['recommended_model_ids'][kind] == 'eligible-model'
        assert response.json()['popular_model_ids'] == ['eligible-model']
