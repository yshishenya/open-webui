import time


from open_webui.internal.db import get_db
from open_webui.models.billing_wallet import (
    JsonDict,
    LedgerEntry,
    LedgerEntryModel,
    LeadMagnetState,
    LeadMagnetStateModel,
    Payment,
    PaymentModel,
    PricingRateCard,
    PricingRateCardModel,
    PromoCode,
    PromoCodeModel,
    UsageEvent,
    UsageEventModel,
    Wallet,
    WalletModel,
)


class WalletsTable:
    def get_wallet_by_id(self, wallet_id: str) -> WalletModel | None:
        """Get wallet by ID"""
        with get_db() as db:
            wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
            return WalletModel.model_validate(wallet) if wallet else None

    def get_wallet_by_user(self, user_id: str, currency: str) -> WalletModel | None:
        """Get wallet by user and currency"""
        with get_db() as db:
            wallet = db.query(Wallet).filter(Wallet.user_id == user_id, Wallet.currency == currency).first()
            return WalletModel.model_validate(wallet) if wallet else None

    def create_wallet(self, wallet_data: WalletModel) -> WalletModel:
        """Create wallet"""
        with get_db() as db:
            wallet = Wallet(**wallet_data.model_dump())
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
            return WalletModel.model_validate(wallet)

    def update_wallet(self, wallet_id: str, updates: JsonDict) -> WalletModel | None:
        """Update wallet by ID"""
        with get_db() as db:
            wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
            if not wallet:
                return None
            for key, value in updates.items():
                setattr(wallet, key, value)
            wallet.updated_at = int(time.time())
            db.commit()
            db.refresh(wallet)
            return WalletModel.model_validate(wallet)


class LedgerEntriesTable:
    def create_entry(self, entry_data: LedgerEntryModel) -> LedgerEntryModel:
        """Create ledger entry"""
        with get_db() as db:
            entry = LedgerEntry(**entry_data.model_dump())
            db.add(entry)
            db.commit()
            db.refresh(entry)
            return LedgerEntryModel.model_validate(entry)

    def get_entries_by_user(self, user_id: str, limit: int = 100, offset: int = 0) -> list[LedgerEntryModel]:
        """Get ledger entries for user"""
        with get_db() as db:
            entries = (
                db.query(LedgerEntry)
                .filter(LedgerEntry.user_id == user_id)
                .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [LedgerEntryModel.model_validate(entry) for entry in entries]


class PaymentsTable:
    def create_payment(self, payment_data: PaymentModel) -> PaymentModel:
        """Create payment record"""
        with get_db() as db:
            payment = Payment(**payment_data.model_dump())
            db.add(payment)
            db.commit()
            db.refresh(payment)
            return PaymentModel.model_validate(payment)

    def get_payment_by_provider_id(self, provider_payment_id: str) -> PaymentModel | None:
        """Get payment by provider ID"""
        with get_db() as db:
            payment = db.query(Payment).filter(Payment.provider_payment_id == provider_payment_id).first()
            return PaymentModel.model_validate(payment) if payment else None

    def get_payment_by_id(self, payment_id: str) -> PaymentModel | None:
        """Get payment by ID"""
        with get_db() as db:
            payment = db.query(Payment).filter(Payment.id == payment_id).first()
            return PaymentModel.model_validate(payment) if payment else None

    def update_payment_by_id(self, payment_id: str, updates: JsonDict) -> PaymentModel | None:
        """Update payment by ID"""
        with get_db() as db:
            payment = db.query(Payment).filter(Payment.id == payment_id).first()
            if not payment:
                return None
            for key, value in updates.items():
                setattr(payment, key, value)
            payment.updated_at = int(time.time())
            db.commit()
            db.refresh(payment)
            return PaymentModel.model_validate(payment)

    def update_payment_by_provider_id(self, provider_payment_id: str, updates: JsonDict) -> PaymentModel | None:
        """Update payment by provider payment ID"""
        with get_db() as db:
            payment = db.query(Payment).filter(Payment.provider_payment_id == provider_payment_id).first()
            if not payment:
                return None
            for key, value in updates.items():
                setattr(payment, key, value)
            payment.updated_at = int(time.time())
            db.commit()
            db.refresh(payment)
            return PaymentModel.model_validate(payment)

    def list_payments_by_wallet(
        self,
        wallet_id: str,
        status: str | None = None,
        kind: str | None = None,
        limit: int = 20,
    ) -> list[PaymentModel]:
        """List payments for a wallet with optional filters."""
        with get_db() as db:
            query = db.query(Payment).filter(Payment.wallet_id == wallet_id)
            if status:
                query = query.filter(Payment.status == status)
            if kind:
                query = query.filter(Payment.kind == kind)
            entries = query.order_by(Payment.created_at.desc()).limit(limit).all()
            return [PaymentModel.model_validate(entry) for entry in entries]

    def get_latest_payment_with_method(
        self,
        wallet_id: str,
        status: str | None = None,
        kind: str | None = None,
    ) -> PaymentModel | None:
        """Get latest payment with saved payment method for a wallet."""
        with get_db() as db:
            query = db.query(Payment).filter(
                Payment.wallet_id == wallet_id,
                Payment.payment_method_id.isnot(None),
            )
            if status:
                query = query.filter(Payment.status == status)
            if kind:
                query = query.filter(Payment.kind == kind)
            entry = query.order_by(Payment.created_at.desc()).first()
            return PaymentModel.model_validate(entry) if entry else None


class UsageEventsTable:
    def create_usage_event(self, event_data: UsageEventModel) -> UsageEventModel:
        """Create usage event"""
        with get_db() as db:
            event = UsageEvent(**event_data.model_dump())
            db.add(event)
            db.commit()
            db.refresh(event)
            return UsageEventModel.model_validate(event)

    def list_events_by_user(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        billing_source: str | None = None,
    ) -> list[UsageEventModel]:
        """List usage events for user with optional billing source filter."""
        with get_db() as db:
            query = db.query(UsageEvent).filter(UsageEvent.user_id == user_id)
            if billing_source:
                query = query.filter(UsageEvent.billing_source == billing_source)
            events = (
                query.order_by(UsageEvent.created_at.desc(), UsageEvent.id.desc()).offset(offset).limit(limit).all()
            )
            return [UsageEventModel.model_validate(event) for event in events]


class LeadMagnetStatesTable:
    def get_state_by_user(self, user_id: str) -> LeadMagnetStateModel | None:
        """Get lead magnet state by user ID."""
        with get_db() as db:
            state = db.query(LeadMagnetState).filter(LeadMagnetState.user_id == user_id).first()
            return LeadMagnetStateModel.model_validate(state) if state else None

    def create_state(self, state_data: LeadMagnetStateModel) -> LeadMagnetStateModel:
        """Create lead magnet state."""
        with get_db() as db:
            state = LeadMagnetState(**state_data.model_dump())
            db.add(state)
            db.commit()
            db.refresh(state)
            return LeadMagnetStateModel.model_validate(state)

    def update_state_by_id(self, state_id: str, updates: JsonDict) -> LeadMagnetStateModel | None:
        """Update lead magnet state by ID."""
        with get_db() as db:
            state = db.query(LeadMagnetState).filter(LeadMagnetState.id == state_id).first()
            if not state:
                return None
            for key, value in updates.items():
                setattr(state, key, value)
            state.updated_at = int(time.time())
            db.commit()
            db.refresh(state)
            return LeadMagnetStateModel.model_validate(state)

    def list_states(self, skip: int = 0, limit: int = 1000) -> list[LeadMagnetStateModel]:
        """List lead magnet states for recalculation."""
        with get_db() as db:
            states = (
                db.query(LeadMagnetState).order_by(LeadMagnetState.created_at.desc()).offset(skip).limit(limit).all()
            )
            return [LeadMagnetStateModel.model_validate(state) for state in states]


class PromoCodesTable:
    def get_promo_code(self, code: str) -> PromoCodeModel | None:
        """Get promo code by code"""
        with get_db() as db:
            promo = db.query(PromoCode).filter(PromoCode.code == code).first()
            return PromoCodeModel.model_validate(promo) if promo else None


class RateCardsTable:
    def get_rate_card_by_id(self, rate_card_id: str) -> PricingRateCardModel | None:
        """Get rate card by ID."""
        with get_db() as db:
            entry = db.query(PricingRateCard).filter(PricingRateCard.id == rate_card_id).first()
            return PricingRateCardModel.model_validate(entry) if entry else None

    def get_rate_card_by_version(
        self, model_id: str, modality: str, unit: str, version: str
    ) -> PricingRateCardModel | None:
        """Get latest rate card entry for model/modality/unit/version."""
        with get_db() as db:
            entry = (
                db.query(PricingRateCard)
                .filter(
                    PricingRateCard.model_id == model_id,
                    PricingRateCard.modality == modality,
                    PricingRateCard.unit == unit,
                    PricingRateCard.version == version,
                )
                .order_by(PricingRateCard.created_at.desc())
                .first()
            )
            return PricingRateCardModel.model_validate(entry) if entry else None

    def get_rate_card_by_unique(
        self,
        model_id: str,
        modality: str,
        unit: str,
        version: str,
        created_at: int,
    ) -> PricingRateCardModel | None:
        """Get rate card entry by unique version+created_at tuple."""
        with get_db() as db:
            entry = (
                db.query(PricingRateCard)
                .filter(
                    PricingRateCard.model_id == model_id,
                    PricingRateCard.modality == modality,
                    PricingRateCard.unit == unit,
                    PricingRateCard.version == version,
                    PricingRateCard.created_at == created_at,
                )
                .first()
            )
            return PricingRateCardModel.model_validate(entry) if entry else None

    def create_rate_card(self, rate_card_data: dict[str, object]) -> PricingRateCardModel:
        """Create a rate card entry."""
        with get_db() as db:
            entry = PricingRateCard(**rate_card_data)
            db.add(entry)
            db.commit()
            db.refresh(entry)
            return PricingRateCardModel.model_validate(entry)

    def update_rate_card(self, rate_card_id: str, updates: dict[str, object]) -> PricingRateCardModel | None:
        """Update rate card entry by ID."""
        with get_db() as db:
            entry = db.query(PricingRateCard).filter(PricingRateCard.id == rate_card_id).first()
            if not entry:
                return None
            for key, value in updates.items():
                setattr(entry, key, value)
            db.commit()
            db.refresh(entry)
            return PricingRateCardModel.model_validate(entry)

    def delete_rate_card(self, rate_card_id: str) -> bool:
        """Delete rate card entry by ID."""
        with get_db() as db:
            entry = db.query(PricingRateCard).filter(PricingRateCard.id == rate_card_id).first()
            if not entry:
                return False
            db.delete(entry)
            db.commit()
            return True

    def delete_rate_cards_by_ids(self, rate_card_ids: list[str]) -> int:
        """Delete rate card entries by IDs."""
        if not rate_card_ids:
            return 0
        with get_db() as db:
            deleted = (
                db.query(PricingRateCard)
                .filter(PricingRateCard.id.in_(rate_card_ids))
                .delete(synchronize_session=False)
            )
            db.commit()
            return int(deleted or 0)

    def delete_rate_cards_by_model_ids(self, model_ids: list[str]) -> int:
        """Delete rate card entries by model IDs."""
        if not model_ids:
            return 0
        with get_db() as db:
            deleted = (
                db.query(PricingRateCard)
                .filter(PricingRateCard.model_id.in_(model_ids))
                .delete(synchronize_session=False)
            )
            db.commit()
            return int(deleted or 0)

    def deactivate_rate_cards_by_model_ids(self, model_ids: list[str]) -> int:
        """Deactivate rate card entries by model IDs."""
        if not model_ids:
            return 0
        with get_db() as db:
            updated = (
                db.query(PricingRateCard)
                .filter(PricingRateCard.model_id.in_(model_ids))
                .update({'is_active': False}, synchronize_session=False)
            )
            db.commit()
            return int(updated or 0)

    def list_rate_cards(
        self,
        model_id: str | None = None,
        modality: str | None = None,
        unit: str | None = None,
        version: str | None = None,
        provider: str | None = None,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PricingRateCardModel]:
        """List rate card entries with optional filters."""
        with get_db() as db:
            query = db.query(PricingRateCard)
            if model_id:
                query = query.filter(PricingRateCard.model_id == model_id)
            if modality:
                query = query.filter(PricingRateCard.modality == modality)
            if unit:
                query = query.filter(PricingRateCard.unit == unit)
            if version:
                query = query.filter(PricingRateCard.version == version)
            if provider:
                query = query.filter(PricingRateCard.provider == provider)
            if is_active is not None:
                query = query.filter(PricingRateCard.is_active == is_active)

            entries = (
                query.order_by(
                    PricingRateCard.model_id.asc(),
                    PricingRateCard.modality.asc(),
                    PricingRateCard.unit.asc(),
                    PricingRateCard.created_at.desc(),
                )
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [PricingRateCardModel.model_validate(entry) for entry in entries]

    def list_rate_cards_by_model_ids(
        self,
        model_ids: list[str],
        is_active: bool | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[PricingRateCardModel]:
        """List rate cards for a set of model IDs."""
        if not model_ids:
            return []
        with get_db() as db:
            query = db.query(PricingRateCard).filter(PricingRateCard.model_id.in_(model_ids))
            if is_active is not None:
                query = query.filter(PricingRateCard.is_active == is_active)

            query = query.order_by(
                PricingRateCard.model_id.asc(),
                PricingRateCard.modality.asc(),
                PricingRateCard.unit.asc(),
                PricingRateCard.created_at.desc(),
            )
            if offset:
                query = query.offset(offset)
            if limit is not None:
                query = query.limit(limit)
            entries = query.all()
            return [PricingRateCardModel.model_validate(entry) for entry in entries]

    def count_rate_cards(
        self,
        model_id: str | None = None,
        modality: str | None = None,
        unit: str | None = None,
        version: str | None = None,
        provider: str | None = None,
        is_active: bool | None = None,
    ) -> int:
        """Count rate card entries with optional filters."""
        with get_db() as db:
            query = db.query(PricingRateCard)
            if model_id:
                query = query.filter(PricingRateCard.model_id == model_id)
            if modality:
                query = query.filter(PricingRateCard.modality == modality)
            if unit:
                query = query.filter(PricingRateCard.unit == unit)
            if version:
                query = query.filter(PricingRateCard.version == version)
            if provider:
                query = query.filter(PricingRateCard.provider == provider)
            if is_active is not None:
                query = query.filter(PricingRateCard.is_active == is_active)
            return query.count()

    def get_active_rate_card(self, model_id: str, modality: str, unit: str) -> PricingRateCardModel | None:
        """Get latest active rate card entry for model/modality/unit."""
        with get_db() as db:
            query = (
                db.query(PricingRateCard)
                .filter(
                    PricingRateCard.model_id == model_id,
                    PricingRateCard.modality == modality,
                    PricingRateCard.unit == unit,
                    PricingRateCard.is_active == True,
                )
                .order_by(PricingRateCard.created_at.desc())
            )
            entry = query.first()
            return PricingRateCardModel.model_validate(entry) if entry else None


Wallets = WalletsTable()
LedgerEntries = LedgerEntriesTable()
Payments = PaymentsTable()
UsageEvents = UsageEventsTable()
LeadMagnetStates = LeadMagnetStatesTable()
PromoCodes = PromoCodesTable()
RateCards = RateCardsTable()
