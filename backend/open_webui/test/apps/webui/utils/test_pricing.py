from decimal import Decimal

from open_webui.models.billing import PricingRateCardModel
from open_webui.utils.pricing import PricingService


def _rate_card(
    raw_cost: int,
    modality: str = "text",
    unit: str = "token_in",
) -> PricingRateCardModel:
    return PricingRateCardModel(
        id="rate_test",
        model_id="model",
        model_tier=None,
        modality=modality,
        unit=unit,
        raw_cost_per_unit_kopeks=raw_cost,
        version="2025-01",
        created_at=0,
        provider=None,
        is_default=True,
        is_active=True,
    )


def test_calculate_cost_kopeks_rounds_up() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, modality="image", unit="image_1024")

    cost = service.calculate_cost_kopeks(Decimal("1.1"), rate, 0)
    assert cost == 110


def test_calculate_cost_kopeks_discount_applied() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, modality="image", unit="image_1024")

    cost = service.calculate_cost_kopeks(Decimal(1), rate, 20)
    assert cost == 80


def test_calculate_cost_kopeks_discount_clamped() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, modality="image", unit="image_1024")

    assert service.calculate_cost_kopeks(Decimal(1), rate, -10) == 100
    assert service.calculate_cost_kopeks(Decimal(1), rate, 200) == 0


def test_calculate_cost_kopeks_negative_rate_clamped() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=-100, modality="image", unit="image_1024")

    assert service.calculate_cost_kopeks(Decimal(1), rate, 0) == 0


def test_calculate_cost_kopeks_zero_units() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100)

    cost = service.calculate_cost_kopeks(Decimal(0), rate, 0)
    assert cost == 0


def test_calculate_cost_range_uses_min_max() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100)

    min_cost, max_cost = service.calculate_cost_range(
        Decimal("0.5"), Decimal("1.5"), rate, 0
    )
    assert min_cost == 50
    assert max_cost == 150
