"""
Plan templates for billing system
Provides default plans based on market research
"""

import time
from typing import List, Dict, Any


def get_default_plans() -> List[Dict[str, Any]]:
    """
    Get default subscription plans

    Plans are based on market research (2025):
    - ChatGPT Plus: ~2000₽/месяц
    - GPTunnel: pay-as-you-go
    - SYNTX AI: токенная система

    Our competitive advantage:
    - Free tier (vs ChatGPT)
    - Flexible pricing (vs ChatGPT)
    - All models in one place
    """

    now = int(time.time())

    return [
        # FREE - Entry tier for onboarding
        {
            "id": "free",
            "name": "Free",
            "name_ru": "Бесплатный",
            "description": "Perfect for trying out AI models",
            "description_ru": "Идеально для знакомства с AI моделями",
            "price": 0.0,
            "currency": "RUB",
            "interval": "month",
            "quotas": {
                "tokens_input": 100000,    # 100K input tokens
                "tokens_output": 50000,    # 50K output tokens
                "requests": 500,           # 500 requests
            },
            "features": [
                "GPT 5 Nano",
                "GPT OSS 20B",
                "DeepSeek V3.2",
                "Qwen 3 8B",
                "Базовая поддержка",
            ],
            "is_active": True,
            "display_order": 0,
            "created_at": now,
            "updated_at": now,
        },

        # STARTER - For students and hobbyists
        {
            "id": "starter",
            "name": "Starter",
            "name_ru": "Старт",
            "description": "For students and hobbyists exploring AI",
            "description_ru": "Для студентов и любителей AI",
            "price": 490.0,
            "currency": "RUB",
            "interval": "month",
            "quotas": {
                "tokens_input": 1000000,   # 1M input tokens
                "tokens_output": 500000,   # 500K output tokens
                "requests": 5000,          # 5000 requests
            },
            "features": [
                "Все модели Free",
                "GPT 5 Mini",
                "Gemini 2.5 Flash",
                "Claude Haiku 4.5",
                "Mistral Small",
                "LLaMA-3.1 (8b)",
                "Приоритетная поддержка",
            ],
            "is_active": True,
            "display_order": 1,
            "created_at": now,
            "updated_at": now,
        },

        # PRO - For professionals and small businesses
        {
            "id": "pro",
            "name": "Pro",
            "name_ru": "Профессиональный",
            "description": "Advanced features and higher quotas",
            "description_ru": "Расширенные возможности и увеличенные квоты",
            "price": 1490.0,
            "currency": "RUB",
            "interval": "month",
            "quotas": {
                "tokens_input": 5000000,   # 5M input tokens
                "tokens_output": 2000000,  # 2M output tokens
                "requests": 20000,         # 20000 requests
            },
            "features": [
                "Все модели Starter",
                "GPT-4o",
                "GPT-4o Mini",
                "Claude 4.5 Sonnet",
                "Gemini 2.5 Pro",
                "o4-mini",
                "Mistral Large",
                "Qwen 3 Max",
                "Приоритетная обработка",
                "Email поддержка",
            ],
            "is_active": True,
            "display_order": 2,
            "created_at": now,
            "updated_at": now,
        },

        # BUSINESS - For companies and power users
        {
            "id": "business",
            "name": "Business",
            "name_ru": "Бизнес",
            "description": "For companies and power users",
            "description_ru": "Для компаний и профессионалов",
            "price": 4990.0,
            "currency": "RUB",
            "interval": "month",
            "quotas": {
                "tokens_input": 20000000,  # 20M input tokens
                "tokens_output": 10000000, # 10M output tokens
                "requests": 100000,        # 100000 requests
            },
            "features": [
                "Все модели Pro",
                "GPT-5.1",
                "o1",
                "o3",
                "Claude 4.5 Opus",
                "Claude Opus-4.1",
                "Gemini 3 Pro Preview",
                "xAI Grok 4",
                "DeepSeek R1",
                "Приоритетная обработка",
                "API доступ",
                "Выделенная поддержка",
                "SLA 99.9%",
            ],
            "is_active": True,
            "display_order": 3,
            "created_at": now,
            "updated_at": now,
        },

        # UNLIMITED - For enterprises (optional, can be created later)
        {
            "id": "unlimited",
            "name": "Unlimited",
            "name_ru": "Безлимит",
            "description": "Unlimited access to all models",
            "description_ru": "Безлимитный доступ ко всем моделям",
            "price": 14990.0,
            "currency": "RUB",
            "interval": "month",
            "quotas": None,  # Unlimited
            "features": [
                "ВСЕ модели",
                "Безлимитные запросы",
                "Безлимитные токены",
                "API доступ",
                "Приоритетная обработка",
                "Выделенная поддержка 24/7",
                "SLA 99.95%",
                "Custom интеграции",
            ],
            "is_active": False,  # Inactive by default, can be enabled later
            "display_order": 4,
            "created_at": now,
            "updated_at": now,
        },
    ]


def get_promo_plans() -> List[Dict[str, Any]]:
    """
    Get promotional/seasonal plans
    These can be activated during special events
    """
    now = int(time.time())

    return [
        # NEW YEAR PROMO - Example promotional plan
        {
            "id": "newyear_2025",
            "name": "New Year 2025",
            "name_ru": "Новый Год 2025",
            "description": "Special New Year offer - 50% off Pro plan",
            "description_ru": "Специальное новогоднее предложение - 50% скидка на Pro",
            "price": 745.0,  # 50% off Pro (1490/2)
            "currency": "RUB",
            "interval": "month",
            "quotas": {
                "tokens_input": 5000000,
                "tokens_output": 2000000,
                "requests": 20000,
            },
            "features": [
                "Все возможности Pro плана",
                "Скидка 50%",
                "Действует 3 месяца",
            ],
            "is_active": False,  # Activate during promo period
            "display_order": 10,  # Show after main plans
            "created_at": now,
            "updated_at": now,
            "metadata": {
                "promo": True,
                "promo_code": "NEWYEAR2025",
                "promo_ends": now + (90 * 24 * 60 * 60),  # 90 days
            },
        },
    ]


def get_annual_plans() -> List[Dict[str, Any]]:
    """
    Get annual versions of main plans (20% discount)
    """
    now = int(time.time())

    return [
        {
            "id": "starter_annual",
            "name": "Starter Annual",
            "name_ru": "Старт (Годовой)",
            "description": "Starter plan billed annually - save 20%",
            "description_ru": "План Старт с годовой оплатой - экономия 20%",
            "price": 4704.0,  # 490 * 12 * 0.8 = 4704
            "currency": "RUB",
            "interval": "year",
            "quotas": {
                "tokens_input": 1000000,
                "tokens_output": 500000,
                "requests": 5000,
            },
            "features": [
                "Все возможности Starter",
                "Скидка 20% при годовой оплате",
                "2 месяца бесплатно",
            ],
            "is_active": True,
            "display_order": 5,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "pro_annual",
            "name": "Pro Annual",
            "name_ru": "Профессиональный (Годовой)",
            "description": "Pro plan billed annually - save 20%",
            "description_ru": "План Профессиональный с годовой оплатой - экономия 20%",
            "price": 14304.0,  # 1490 * 12 * 0.8 = 14304
            "currency": "RUB",
            "interval": "year",
            "quotas": {
                "tokens_input": 5000000,
                "tokens_output": 2000000,
                "requests": 20000,
            },
            "features": [
                "Все возможности Pro",
                "Скидка 20% при годовой оплате",
                "2 месяца бесплатно",
            ],
            "is_active": True,
            "display_order": 6,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "business_annual",
            "name": "Business Annual",
            "name_ru": "Бизнес (Годовой)",
            "description": "Business plan billed annually - save 20%",
            "description_ru": "План Бизнес с годовой оплатой - экономия 20%",
            "price": 47904.0,  # 4990 * 12 * 0.8 = 47904
            "currency": "RUB",
            "interval": "year",
            "quotas": {
                "tokens_input": 20000000,
                "tokens_output": 10000000,
                "requests": 100000,
            },
            "features": [
                "Все возможности Business",
                "Скидка 20% при годовой оплате",
                "2 месяца бесплатно",
            ],
            "is_active": True,
            "display_order": 7,
            "created_at": now,
            "updated_at": now,
        },
    ]
