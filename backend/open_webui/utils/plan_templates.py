"""
Plan templates for billing system
Provides default plans for B2C monetization
"""

import time
from typing import Dict, List

PlanSeed = Dict[str, object]


def get_default_plans() -> List[PlanSeed]:
    """Get default subscription plans for Stage 1/2 rollout."""
    now = int(time.time())

    return [
        # FREE - Entry tier for onboarding (active)
        {
            "id": "free",
            "name": "Free",
            "name_ru": "Бесплатный",
            "description": "Start with AI and basic models",
            "description_ru": "Для старта и базовых моделей",
            "price": 0.0,
            "price_kopeks": 0,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 0,
            "discount_percent": 0,
            "model_tiers_allowed": ["Economy"],
            "images_per_period": 2,
            "tts_seconds_per_period": 300,
            "max_reply_cost_kopeks": 2000,
            "daily_cap_kopeks": 5000,
            "is_annual": False,
            "quotas": {
                "tokens_input": 100000,
                "tokens_output": 50000,
                "requests": 200,
            },
            "features": [
                "Economy models",
                "Basic support",
            ],
            "is_active": True,
            "display_order": 0,
            "created_at": now,
            "updated_at": now,
        },
        # PAYG - wallet only (active)
        {
            "id": "payg",
            "name": "PAYG",
            "name_ru": "PAYG",
            "description": "Pay as you go via wallet top-ups",
            "description_ru": "Оплата по факту через кошелёк",
            "price": 0.0,
            "price_kopeks": 0,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 0,
            "discount_percent": 0,
            "model_tiers_allowed": ["Economy", "Standard"],
            "images_per_period": None,
            "tts_seconds_per_period": None,
            "max_reply_cost_kopeks": None,
            "daily_cap_kopeks": None,
            "is_annual": False,
            "quotas": None,
            "features": [
                "Top-up wallet",
                "No subscription required",
            ],
            "is_active": True,
            "display_order": 1,
            "created_at": now,
            "updated_at": now,
        },
        # START - Subscription (inactive in Stage 1)
        {
            "id": "start",
            "name": "Start",
            "name_ru": "Старт",
            "description": "Included balance + 10% discount",
            "description_ru": "Включённый баланс + скидка 10%",
            "price": 299.0,
            "price_kopeks": 29900,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 30000,
            "discount_percent": 10,
            "model_tiers_allowed": ["Economy", "Standard"],
            "images_per_period": 20,
            "tts_seconds_per_period": 1800,
            "max_reply_cost_kopeks": 5000,
            "daily_cap_kopeks": 30000,
            "is_annual": False,
            "quotas": None,
            "features": [
                "Included balance",
                "Standard models",
            ],
            "is_active": False,
            "display_order": 2,
            "created_at": now,
            "updated_at": now,
        },
        # PLUS - Subscription (inactive in Stage 1)
        {
            "id": "plus",
            "name": "Plus",
            "name_ru": "Плюс",
            "description": "Bigger included balance + 20% discount",
            "description_ru": "Больше included + скидка 20%",
            "price": 599.0,
            "price_kopeks": 59900,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 70000,
            "discount_percent": 20,
            "model_tiers_allowed": ["Economy", "Standard", "Premium"],
            "images_per_period": 60,
            "tts_seconds_per_period": 7200,
            "max_reply_cost_kopeks": 10000,
            "daily_cap_kopeks": 70000,
            "is_annual": False,
            "quotas": None,
            "features": [
                "Included balance",
                "Premium models",
            ],
            "is_active": False,
            "display_order": 3,
            "created_at": now,
            "updated_at": now,
        },
        # PRO - Subscription (inactive in Stage 1)
        {
            "id": "pro",
            "name": "Pro",
            "name_ru": "Профессиональный",
            "description": "Maximum included balance + 30% discount",
            "description_ru": "Максимум included + скидка 30%",
            "price": 1690.0,
            "price_kopeks": 169000,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 220000,
            "discount_percent": 30,
            "model_tiers_allowed": ["All"],
            "images_per_period": 200,
            "tts_seconds_per_period": 21600,
            "max_reply_cost_kopeks": 20000,
            "daily_cap_kopeks": 200000,
            "is_annual": False,
            "quotas": None,
            "features": [
                "Included balance",
                "All model tiers",
            ],
            "is_active": False,
            "display_order": 4,
            "created_at": now,
            "updated_at": now,
        },
        # Annual plans (inactive in Stage 1)
        {
            "id": "start_annual",
            "name": "Start Annual",
            "name_ru": "Старт (годовой)",
            "description": "Annual plan with 16% discount",
            "description_ru": "Годовой план со скидкой 16%",
            "price": 3013.92,
            "price_kopeks": 301392,
            "currency": "RUB",
            "interval": "year",
            "included_kopeks_per_period": 360000,
            "discount_percent": 10,
            "model_tiers_allowed": ["Economy", "Standard"],
            "images_per_period": 20,
            "tts_seconds_per_period": 1800,
            "max_reply_cost_kopeks": 5000,
            "daily_cap_kopeks": 30000,
            "is_annual": True,
            "quotas": None,
            "features": [
                "Included balance",
                "Annual billing",
            ],
            "is_active": False,
            "display_order": 10,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "plus_annual",
            "name": "Plus Annual",
            "name_ru": "Плюс (годовой)",
            "description": "Annual plan with 16% discount",
            "description_ru": "Годовой план со скидкой 16%",
            "price": 6047.28,
            "price_kopeks": 604728,
            "currency": "RUB",
            "interval": "year",
            "included_kopeks_per_period": 840000,
            "discount_percent": 20,
            "model_tiers_allowed": ["Economy", "Standard", "Premium"],
            "images_per_period": 60,
            "tts_seconds_per_period": 7200,
            "max_reply_cost_kopeks": 10000,
            "daily_cap_kopeks": 70000,
            "is_annual": True,
            "quotas": None,
            "features": [
                "Included balance",
                "Annual billing",
            ],
            "is_active": False,
            "display_order": 11,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "pro_annual",
            "name": "Pro Annual",
            "name_ru": "Профи (годовой)",
            "description": "Annual plan with 16% discount",
            "description_ru": "Годовой план со скидкой 16%",
            "price": 17047.2,
            "price_kopeks": 1704720,
            "currency": "RUB",
            "interval": "year",
            "included_kopeks_per_period": 2640000,
            "discount_percent": 30,
            "model_tiers_allowed": ["All"],
            "images_per_period": 200,
            "tts_seconds_per_period": 21600,
            "max_reply_cost_kopeks": 20000,
            "daily_cap_kopeks": 200000,
            "is_annual": True,
            "quotas": None,
            "features": [
                "Included balance",
                "Annual billing",
            ],
            "is_active": False,
            "display_order": 12,
            "created_at": now,
            "updated_at": now,
        },
    ]


def get_promo_plans() -> List[PlanSeed]:
    """Get promotional/seasonal plans."""
    now = int(time.time())

    return [
        {
            "id": "newyear_2025",
            "name": "New Year 2025",
            "name_ru": "Новый Год 2025",
            "description": "Special New Year offer - 50% off Pro",
            "description_ru": "Новогодняя скидка 50% на Pro",
            "price": 845.0,
            "price_kopeks": 84500,
            "currency": "RUB",
            "interval": "month",
            "included_kopeks_per_period": 220000,
            "discount_percent": 30,
            "model_tiers_allowed": ["All"],
            "images_per_period": 200,
            "tts_seconds_per_period": 21600,
            "max_reply_cost_kopeks": 20000,
            "daily_cap_kopeks": 200000,
            "is_annual": False,
            "quotas": None,
            "features": [
                "All model tiers",
                "Limited time offer",
            ],
            "is_active": False,
            "display_order": 100,
            "created_at": now,
            "updated_at": now,
            "plan_extra_metadata": {
                "promo": True,
                "promo_code": "NEWYEAR2025",
                "promo_ends": now + (90 * 24 * 60 * 60),
            },
        },
    ]


def get_annual_plans() -> List[PlanSeed]:
    """Get annual versions of main plans (16% discount)."""
    return [
        plan
        for plan in get_default_plans()
        if isinstance(plan.get("is_annual"), bool) and plan.get("is_annual")
    ]
