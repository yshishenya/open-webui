"""Plan assignment policy; changing access is not a payment or an extension."""

from open_webui.models.billing import PlanModel


def subscription_terms(plan: PlanModel) -> dict[str, object]:
    """Order terms, excluding editable presentation and administrative metadata."""
    return plan.model_dump(
        include={
            'id',
            'price',
            'price_kopeks',
            'currency',
            'interval',
            'quotas',
            'features',
            'included_kopeks_per_period',
            'discount_percent',
            'model_tiers_allowed',
            'images_per_period',
            'tts_seconds_per_period',
            'max_reply_cost_kopeks',
            'daily_cap_kopeks',
            'is_annual',
        }
    )


def _effective_quotas(plan: PlanModel) -> dict[str, int]:
    """Match the limits enforced by billing_integration._subscription_quota_limits."""
    quotas = {str(key): value for key, value in (plan.quotas or {}).items() if isinstance(value, int) and value >= 0}
    for field, metric in [('images_per_period', 'images'), ('tts_seconds_per_period', 'tts_seconds')]:
        limit: int | None = getattr(plan, field)
        if limit is not None:
            quotas[metric] = limit
    return quotas


def requires_next_term(old: PlanModel, new: PlanModel) -> bool:
    """Defer any reduction or incomparable terms, regardless of plan price."""
    if old.currency != new.currency or old.interval != new.interval:
        return True
    if not set(old.features or []).issubset(new.features or []):
        return True
    if new.included_kopeks_per_period < old.included_kopeks_per_period:
        return True
    if new.discount_percent < old.discount_percent:
        return True
    if new.model_tiers_allowed is not None and (
        old.model_tiers_allowed is None or not set(old.model_tiers_allowed).issubset(new.model_tiers_allowed)
    ):
        return True
    for field in ('max_reply_cost_kopeks', 'daily_cap_kopeks'):
        old_limit, new_limit = getattr(old, field), getattr(new, field)
        if new_limit is not None and (old_limit is None or new_limit < old_limit):
            return True
    old_quotas, new_quotas = _effective_quotas(old), _effective_quotas(new)
    return any(
        new_value is not None and (old_quotas.get(key) is None or new_value < old_quotas[key])
        for key, new_value in new_quotas.items()
    )
