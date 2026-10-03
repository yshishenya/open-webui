from __future__ import annotations

from open_webui.models.access_grants import has_public_read_access_grant
from open_webui.models.billing import RateCards
from open_webui.models.models import Models
from starlette.concurrency import run_in_threadpool


async def filter_public_pricing_selection(
    popular_ids: list[str], recommended_ids: dict[str, str]
) -> tuple[list[str], dict[str, str | None]]:
    """Recommend only registered models eligible for the public rate catalogue."""
    candidates = {model_id.strip() for model_id in [*popular_ids, *recommended_ids.values()] if model_id.strip()}
    eligible: set[str] = set()
    for model_id in candidates:
        model = await Models.get_model_by_id(model_id)
        if (
            model is not None
            and model.is_active
            and not model.base_model_id
            and not getattr(model.meta, 'hidden', False)
            and has_public_read_access_grant(model.access_grants)
        ):
            eligible.add(model_id)
    rates = await run_in_threadpool(RateCards.list_rate_cards_by_model_ids, list(eligible), True)
    supported_units = {
        ('text', 'token_in'),
        ('text', 'token_out'),
        ('image', 'image_1024'),
        ('tts', 'tts_char'),
        ('stt', 'stt_second'),
    }
    modalities: dict[str, set[str]] = {}
    for rate in rates:
        if (rate.modality, rate.unit) in supported_units:
            modalities.setdefault(rate.model_id, set()).add(rate.modality)
    recommended: dict[str, str | None] = {}
    for kind, raw_id in recommended_ids.items():
        model_id = raw_id.strip()
        expected = {'tts', 'stt'} if kind == 'audio' else {kind}
        recommended[kind] = model_id if modalities.get(model_id, set()) & expected else None
    return [model_id for model_id in popular_ids if model_id in modalities], recommended
