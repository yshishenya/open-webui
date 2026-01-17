from decimal import Decimal

from open_webui.models.billing import PricingRateCardModel
from open_webui.utils.pricing import PricingService


def _rate_card(
    raw_cost: int,
    platform_factor: float = 1.0,
    fixed_fee: int = 0,
    min_charge: int = 0,
) -> PricingRateCardModel:
    return PricingRateCardModel(
        id="rate_test",
        model_id="model",
        model_tier=None,
        modality="text",
        unit="token_in",
        raw_cost_per_unit_kopeks=raw_cost,
        platform_factor=platform_factor,
        fixed_fee_kopeks=fixed_fee,
        min_charge_kopeks=min_charge,
        rounding_rules_json=None,
        version="2025-01",
        effective_from=0,
        effective_to=None,
        provider=None,
        is_default=True,
        is_active=True,
    )


def test_calculate_cost_kopeks_min_charge_and_rounding() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=1, platform_factor=1.0, fixed_fee=0, min_charge=5)

    cost = service.calculate_cost_kopeks(Decimal("1.1"), rate, 0)
    assert cost == 5


def test_calculate_cost_kopeks_fixed_fee_and_discount() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, platform_factor=1.0, fixed_fee=50, min_charge=0)

    cost = service.calculate_cost_kopeks(Decimal(1), rate, 20)
    assert cost == 130


def test_calculate_cost_kopeks_platform_factor() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, platform_factor=1.25, fixed_fee=0, min_charge=0)

    cost = service.calculate_cost_kopeks(Decimal(2), rate, 0)
    assert cost == 250


def test_calculate_cost_kopeks_zero_units() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, platform_factor=1.0, fixed_fee=0, min_charge=0)

    cost = service.calculate_cost_kopeks(Decimal(0), rate, 0)
    assert cost == 0


def test_calculate_cost_range_uses_min_max() -> None:
    service = PricingService()
    rate = _rate_card(raw_cost=100, platform_factor=1.0, fixed_fee=0, min_charge=0)

    min_cost, max_cost = service.calculate_cost_range(
        Decimal("0.5"), Decimal("1.5"), rate, 0
    )
    assert min_cost == 50
    assert max_cost == 150
