from typing import Dict, List

import time

from open_webui.models.billing import Plans, RateCards
from open_webui.models.models import Models
from open_webui.utils.plan_templates import get_default_plans, get_promo_plans
from open_webui.utils.rate_card_templates import build_rate_cards_for_model


def seed_default_plans_if_missing() -> int:
    """Seed default/promo plans if they don't exist. Returns count created."""
    created = 0
    plans: List[dict[str, object]] = []
    plans.extend(get_default_plans())
    plans.extend(get_promo_plans())

    for plan_data in plans:
        plan_id = str(plan_data.get("id", ""))
        if not plan_id:
            continue
        if Plans.get_plan_by_id(plan_id):
            continue
        Plans.create_plan(plan_data)
        created += 1

    return created


def seed_default_rate_cards_if_missing() -> int:
    """Seed default rate cards for base models if they don't exist."""
    created = 0
    models = Models.get_base_models()
    if not models:
        return 0

    for model in models:
        templates = build_rate_cards_for_model(model.id, created_at=int(time.time()))
        for template in templates:
            model_id = str(template.get("model_id", ""))
            modality = str(template.get("modality", ""))
            unit = str(template.get("unit", ""))
            version = str(template.get("version", ""))
            if not model_id or not modality or not unit or not version:
                continue
            if RateCards.get_rate_card_by_version(model_id, modality, unit, version):
                continue
            RateCards.create_rate_card(template)
            created += 1

    return created


def seed_default_billing_if_missing() -> Dict[str, int]:
    """Seed default billing data (plans + rate cards)."""
    return {
        "plans": seed_default_plans_if_missing(),
        "rate_cards": seed_default_rate_cards_if_missing(),
    }
