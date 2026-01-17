from decimal import Decimal, ROUND_CEILING
from typing import Optional, Tuple

from open_webui.models.billing import PricingRateCardModel, RateCards


class PricingError(Exception):
    """Raised when pricing cannot be calculated."""


class PricingService:
    """Pricing calculator based on rate card."""

    def __init__(self):
        self.rate_cards = RateCards

    def get_rate_card(
        self, model_id: str, modality: str, unit: str, as_of: int
    ) -> Optional[PricingRateCardModel]:
        """Fetch active rate card for model/modality/unit."""
        return self.rate_cards.get_active_rate_card(model_id, modality, unit, as_of)

    def calculate_cost_kopeks(
        self,
        units: Decimal,
        rate: PricingRateCardModel,
        discount_percent: int = 0,
    ) -> int:
        """Calculate charged cost in kopeks for given units."""
        if units <= 0:
            return 0

        discount_factor = Decimal(100 - max(discount_percent, 0)) / Decimal(100)
        raw = Decimal(rate.raw_cost_per_unit_kopeks) * units
        factor = Decimal(str(rate.platform_factor))
        fixed_fee = Decimal(rate.fixed_fee_kopeks)

        amount = (raw * factor * discount_factor) + fixed_fee
        rounded = int(amount.to_integral_value(rounding=ROUND_CEILING))

        if rounded < rate.min_charge_kopeks:
            return rate.min_charge_kopeks
        return rounded

    def calculate_cost_range(
        self,
        min_units: Decimal,
        max_units: Decimal,
        rate: PricingRateCardModel,
        discount_percent: int = 0,
    ) -> Tuple[int, int]:
        """Calculate min/max cost in kopeks for unit range."""
        min_cost = self.calculate_cost_kopeks(min_units, rate, discount_percent)
        max_cost = self.calculate_cost_kopeks(max_units, rate, discount_percent)
        return min_cost, max_cost
