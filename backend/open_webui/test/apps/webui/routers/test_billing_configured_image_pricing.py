import asyncio
from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch
from fastapi import Response

from open_webui.models.billing import PricingRateCardModel
from open_webui.routers import billing as billing_router


def test_configured_image_model_is_publicly_priced(monkeypatch: MonkeyPatch) -> None:
    model_id = "gpt-image-2"

    async def get_config(key: str, default: str = "") -> str:
        assert key == "image_generation.model"
        return model_id

    async def get_models() -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                id=model_id,
                name="GPT Image 2",
                is_active=False,
                access_control={},
                meta=None,
            )
        ]

    async def get_provider_models(request: object) -> list[dict[str, str]]:  # noqa: ARG001
        return []

    def get_rates(model_ids: list[str], active_only: bool) -> list[PricingRateCardModel]:
        assert model_ids == [model_id]
        assert active_only is True
        return [
            PricingRateCardModel(
                id="image-rate",
                model_id=model_id,
                modality="image",
                unit="image_1024",
                raw_cost_per_unit_kopeks=1325,
                version="2026-08-06",
                created_at=1,
                is_default=True,
                is_active=True,
            )
        ]

    monkeypatch.setattr(billing_router.Config, "get", get_config)
    monkeypatch.setattr(billing_router.Models, "get_base_models", get_models)
    monkeypatch.setattr(billing_router, "get_all_base_models", get_provider_models)
    monkeypatch.setattr(billing_router.RateCards, "list_rate_cards_by_model_ids", get_rates)

    payload = asyncio.run(billing_router.get_public_rate_cards(object(), Response()))

    assert payload.models[0].id == model_id
    assert payload.models[0].capabilities == ["image"]
    assert payload.models[0].rates.image_1024 == 1325
