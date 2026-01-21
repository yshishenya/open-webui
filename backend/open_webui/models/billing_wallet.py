from __future__ import annotations

from enum import Enum
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict, JsonValue
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)

from open_webui.internal.db import Base

JsonDict = Dict[str, JsonValue]


####################
# Wallet Enums
####################


class LedgerEntryType(str, Enum):
    HOLD = "hold"
    CHARGE = "charge"
    REFUND = "refund"
    TOPUP = "topup"
    SUBSCRIPTION_CREDIT = "subscription_credit"
    ADJUSTMENT = "adjustment"
    RELEASE = "release"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class PaymentKind(str, Enum):
    TOPUP = "topup"
    SUBSCRIPTION = "subscription"
    ADJUSTMENT = "adjustment"


class BillingSource(str, Enum):
    PAYG = "payg"
    LEAD_MAGNET = "lead_magnet"


####################
# Wallet DB Schema
####################


class Wallet(Base):
    """User wallet balances and limits (kopeks)"""

    __tablename__ = "billing_wallet"
    __table_args__ = (
        UniqueConstraint("user_id", "currency", name="uq_wallet_user_currency"),
    )

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    currency = Column(String, nullable=False, default="RUB")

    balance_topup_kopeks = Column(BigInteger, nullable=False, default=0)
    balance_included_kopeks = Column(BigInteger, nullable=False, default=0)
    included_expires_at = Column(BigInteger, nullable=True)

    max_reply_cost_kopeks = Column(BigInteger, nullable=True)
    daily_cap_kopeks = Column(BigInteger, nullable=True)
    daily_spent_kopeks = Column(BigInteger, nullable=False, default=0)
    daily_reset_at = Column(BigInteger, nullable=True)

    auto_topup_enabled = Column(Boolean, nullable=False, default=False)
    auto_topup_threshold_kopeks = Column(BigInteger, nullable=True)
    auto_topup_amount_kopeks = Column(BigInteger, nullable=True)
    auto_topup_fail_count = Column(Integer, nullable=False, default=0)
    auto_topup_last_failed_at = Column(BigInteger, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


Index("idx_wallet_user", Wallet.user_id)


class WalletModel(BaseModel):
    id: str
    user_id: str
    currency: str
    balance_topup_kopeks: int
    balance_included_kopeks: int
    included_expires_at: Optional[int] = None
    max_reply_cost_kopeks: Optional[int] = None
    daily_cap_kopeks: Optional[int] = None
    daily_spent_kopeks: int = 0
    daily_reset_at: Optional[int] = None
    auto_topup_enabled: bool = False
    auto_topup_threshold_kopeks: Optional[int] = None
    auto_topup_amount_kopeks: Optional[int] = None
    auto_topup_fail_count: int = 0
    auto_topup_last_failed_at: Optional[int] = None
    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Pricing DB Schema
####################


class PricingRateCard(Base):
    """Rate card entries per model/modality/unit"""

    __tablename__ = "billing_pricing_rate_card"
    __table_args__ = (
        UniqueConstraint(
            "model_id",
            "modality",
            "unit",
            "version",
            "effective_from",
            name="uq_rate_card_version",
        ),
    )

    id = Column(String, primary_key=True, unique=True)
    model_id = Column(String, nullable=False, index=True)
    model_tier = Column(String, nullable=True)
    modality = Column(String, nullable=False)
    unit = Column(String, nullable=False)

    raw_cost_per_unit_kopeks = Column(BigInteger, nullable=False, default=0)

    version = Column(String, nullable=False)
    effective_from = Column(BigInteger, nullable=False)
    effective_to = Column(BigInteger, nullable=True)

    provider = Column(String, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)


Index("idx_rate_card_active", PricingRateCard.is_active, PricingRateCard.effective_from)


class PricingRateCardModel(BaseModel):
    id: str
    model_id: str
    model_tier: Optional[str] = None
    modality: str
    unit: str
    raw_cost_per_unit_kopeks: int
    version: str
    effective_from: int
    effective_to: Optional[int] = None
    provider: Optional[str] = None
    is_default: bool = False
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


####################
# Usage Events DB Schema
####################


class UsageEvent(Base):
    """Detailed billing usage events with pricing snapshot"""

    __tablename__ = "billing_usage_event"
    __table_args__ = (
        UniqueConstraint("request_id", "modality", name="uq_usage_request_modality"),
    )

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    wallet_id = Column(String, nullable=False, index=True)
    plan_id = Column(String, nullable=True)
    subscription_id = Column(String, nullable=True)

    chat_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    request_id = Column(String, nullable=False)

    model_id = Column(String, nullable=False)
    modality = Column(String, nullable=False)
    provider = Column(String, nullable=True)

    measured_units_json = Column(JSON, nullable=True)
    prompt_tokens = Column(BigInteger, nullable=True)
    completion_tokens = Column(BigInteger, nullable=True)
    cost_raw_kopeks = Column(BigInteger, nullable=False, default=0)
    cost_raw_input_kopeks = Column(BigInteger, nullable=True)
    cost_raw_output_kopeks = Column(BigInteger, nullable=True)
    cost_charged_kopeks = Column(BigInteger, nullable=False, default=0)
    cost_charged_input_kopeks = Column(BigInteger, nullable=True)
    cost_charged_output_kopeks = Column(BigInteger, nullable=True)
    billing_source = Column(
        String, nullable=False, default=BillingSource.PAYG.value
    )
    is_estimated = Column(Boolean, nullable=False, default=False)
    estimate_reason = Column(Text, nullable=True)
    pricing_version = Column(String, nullable=True)
    pricing_rate_card_id = Column(String, nullable=True)
    pricing_rate_card_input_id = Column(String, nullable=True)
    pricing_rate_card_output_id = Column(String, nullable=True)
    wallet_snapshot_json = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)


Index("idx_usage_event_user_time", UsageEvent.user_id, UsageEvent.created_at)


class UsageEventModel(BaseModel):
    id: str
    user_id: str
    wallet_id: str
    plan_id: Optional[str] = None
    subscription_id: Optional[str] = None
    chat_id: Optional[str] = None
    message_id: Optional[str] = None
    request_id: str
    model_id: str
    modality: str
    provider: Optional[str] = None
    measured_units_json: Optional[JsonDict] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    cost_raw_kopeks: int
    cost_raw_input_kopeks: Optional[int] = None
    cost_raw_output_kopeks: Optional[int] = None
    cost_charged_kopeks: int
    cost_charged_input_kopeks: Optional[int] = None
    cost_charged_output_kopeks: Optional[int] = None
    billing_source: str = BillingSource.PAYG.value
    is_estimated: bool = False
    estimate_reason: Optional[str] = None
    pricing_version: Optional[str] = None
    pricing_rate_card_id: Optional[str] = None
    pricing_rate_card_input_id: Optional[str] = None
    pricing_rate_card_output_id: Optional[str] = None
    wallet_snapshot_json: Optional[JsonDict] = None
    created_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Lead Magnet State DB Schema
####################


class LeadMagnetState(Base):
    """Per-user lead magnet usage and cycle tracking."""

    __tablename__ = "billing_lead_magnet_state"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_lead_magnet_user"),
    )

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    cycle_start = Column(BigInteger, nullable=False)
    cycle_end = Column(BigInteger, nullable=False)
    tokens_input_used = Column(BigInteger, nullable=False, default=0)
    tokens_output_used = Column(BigInteger, nullable=False, default=0)
    images_used = Column(BigInteger, nullable=False, default=0)
    tts_seconds_used = Column(BigInteger, nullable=False, default=0)
    stt_seconds_used = Column(BigInteger, nullable=False, default=0)
    config_version = Column(Integer, nullable=False, default=0)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


Index("idx_lead_magnet_user", LeadMagnetState.user_id)


class LeadMagnetStateModel(BaseModel):
    id: str
    user_id: str
    cycle_start: int
    cycle_end: int
    tokens_input_used: int = 0
    tokens_output_used: int = 0
    images_used: int = 0
    tts_seconds_used: int = 0
    stt_seconds_used: int = 0
    config_version: int = 0
    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Ledger DB Schema
####################


class LedgerEntry(Base):
    """Ledger entries for wallet accounting"""

    __tablename__ = "billing_ledger_entry"
    __table_args__ = (
        UniqueConstraint(
            "reference_type",
            "reference_id",
            "type",
            name="uq_ledger_reference",
        ),
    )

    id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=False, index=True)
    wallet_id = Column(String, nullable=False, index=True)
    currency = Column(String, nullable=False)

    type = Column(String, nullable=False)
    amount_kopeks = Column(BigInteger, nullable=False)
    charged_input_kopeks = Column(BigInteger, nullable=True)
    charged_output_kopeks = Column(BigInteger, nullable=True)
    balance_included_after = Column(BigInteger, nullable=False)
    balance_topup_after = Column(BigInteger, nullable=False)

    reference_id = Column(String, nullable=True)
    reference_type = Column(String, nullable=True)
    idempotency_key = Column(String, nullable=True, unique=True)

    hold_expires_at = Column(BigInteger, nullable=True)
    expires_at = Column(BigInteger, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(BigInteger, nullable=False)


Index("idx_ledger_user_time", LedgerEntry.user_id, LedgerEntry.created_at)
Index("idx_ledger_wallet_type", LedgerEntry.wallet_id, LedgerEntry.type)


class LedgerEntryModel(BaseModel):
    id: str
    user_id: str
    wallet_id: str
    currency: str
    type: str
    amount_kopeks: int
    charged_input_kopeks: Optional[int] = None
    charged_output_kopeks: Optional[int] = None
    balance_included_after: int
    balance_topup_after: int
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    idempotency_key: Optional[str] = None
    hold_expires_at: Optional[int] = None
    expires_at: Optional[int] = None
    metadata_json: Optional[JsonDict] = None
    created_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Payments DB Schema
####################


class Payment(Base):
    """Payments (topup/subscription) with provider metadata"""

    __tablename__ = "billing_payment"

    id = Column(String, primary_key=True, unique=True)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False)
    kind = Column(String, nullable=False)

    amount_kopeks = Column(BigInteger, nullable=False)
    currency = Column(String, nullable=False)
    idempotency_key = Column(String, nullable=True, unique=True)
    provider_payment_id = Column(String, nullable=True, unique=True)
    payment_method_id = Column(String, nullable=True)

    status_details = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    raw_payload_json = Column(JSON, nullable=True)

    user_id = Column(String, nullable=False, index=True)
    wallet_id = Column(String, nullable=True, index=True)
    subscription_id = Column(String, nullable=True)

    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


Index("idx_payment_user_time", Payment.user_id, Payment.created_at)
Index("idx_payment_status_time", Payment.status, Payment.created_at)


class PaymentModel(BaseModel):
    id: str
    provider: str
    status: str
    kind: str
    amount_kopeks: int
    currency: str
    idempotency_key: Optional[str] = None
    provider_payment_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    status_details: Optional[JsonDict] = None
    metadata_json: Optional[JsonDict] = None
    raw_payload_json: Optional[JsonDict] = None
    user_id: str
    wallet_id: Optional[str] = None
    subscription_id: Optional[str] = None
    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


####################
# Promo Codes DB Schema
####################


class PromoCode(Base):
    """Promo codes for wallet bonuses"""

    __tablename__ = "billing_promo_code"

    code = Column(String, primary_key=True, unique=True)
    bonus_kopeks = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    per_user_limit = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)


Index("idx_promo_expires", PromoCode.expires_at)


class PromoCodeModel(BaseModel):
    code: str
    bonus_kopeks: int
    expires_at: Optional[int] = None
    usage_limit: Optional[int] = None
    per_user_limit: Optional[int] = None
    metadata_json: Optional[JsonDict] = None

    model_config = ConfigDict(from_attributes=True)
