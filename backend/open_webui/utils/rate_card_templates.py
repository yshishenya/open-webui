from __future__ import annotations

import time
import uuid
from typing import Dict, List, Optional, Sequence, Tuple

from open_webui.env import BILLING_RATE_CARD_VERSION

RateCardTemplate = Dict[str, object]
ModalityUnit = Tuple[str, str]


DEFAULT_RATE_CARD_TEMPLATES: List[RateCardTemplate] = [
    {
        "modality": "text",
        "unit": "token_in",
        "raw_cost_per_unit_kopeks": 0,
    },
    {
        "modality": "text",
        "unit": "token_out",
        "raw_cost_per_unit_kopeks": 0,
    },
    {
        "modality": "image",
        "unit": "image_1024",
        "raw_cost_per_unit_kopeks": 0,
    },
    {
        "modality": "tts",
        "unit": "tts_char",
        "raw_cost_per_unit_kopeks": 0,
    },
]


def build_rate_cards_for_model(
    model_id: str,
    model_tier: Optional[str] = None,
    provider: Optional[str] = None,
    version: Optional[str] = None,
    created_at: Optional[int] = None,
    is_active: bool = True,
    is_default: bool = True,
    allowed_units: Optional[Sequence[ModalityUnit]] = None,
) -> List[RateCardTemplate]:
    """Build rate card entries for a model based on default templates."""
    now = created_at or int(time.time())
    version_value = version or BILLING_RATE_CARD_VERSION
    allowed = set(allowed_units) if allowed_units else None

    entries: List[RateCardTemplate] = []
    for template in DEFAULT_RATE_CARD_TEMPLATES:
        modality = str(template.get("modality", ""))
        unit = str(template.get("unit", ""))
        if not modality or not unit:
            continue
        if allowed is not None and (modality, unit) not in allowed:
            continue

        entries.append(
            {
                "id": str(uuid.uuid4()),
                "model_id": model_id,
                "model_tier": model_tier,
                "modality": modality,
                "unit": unit,
                "raw_cost_per_unit_kopeks": int(template.get("raw_cost_per_unit_kopeks", 0)),
                "version": version_value,
                "created_at": now,
                "provider": provider,
                "is_default": is_default,
                "is_active": is_active,
            }
        )

    return entries
