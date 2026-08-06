import time
import uuid
from typing import Dict, Optional, Tuple

import sqlalchemy as sa

from open_webui.internal.db import get_db
from open_webui.models.billing import (
    LedgerEntry,
    LedgerEntryType,
    QuotaReservation,
    Subscription,
    Usage,
    UsageEvent,
    UsageEventModel,
    Wallet,
)
from open_webui.models.billing_wallet import JsonDict


class WalletError(Exception):
    """Base wallet error."""


class InsufficientFundsError(WalletError):
    """Raised when wallet balance is insufficient."""


class HoldNotFoundError(WalletError):
    """Raised when hold entry cannot be found."""


class DailyCapExceededError(WalletError):
    """Raised when a hold would exceed the wallet daily cap."""

    def __init__(self, cap_kopeks: int, spent_kopeks: int, required_kopeks: int):
        self.cap_kopeks = cap_kopeks
        self.spent_kopeks = spent_kopeks
        self.required_kopeks = required_kopeks
        super().__init__("Daily spending cap exceeded")


class QuotaReservationExceededError(WalletError):
    """Raised when a subscription quota cannot be reserved."""

    def __init__(self, metric: str, limit: int, used: int, required: int):
        self.metric = metric
        self.limit = limit
        self.used = used
        self.required = required
        super().__init__(f"Quota exceeded for {metric}")


class WalletService:
    """Wallet operations for hold/settle/release flows."""

    def _reset_daily_spent_if_needed(self, wallet: Wallet, now: int) -> None:
        reset_at = wallet.daily_reset_at or 0
        if reset_at <= now:
            wallet.daily_spent_kopeks = 0
            wallet.daily_reserved_kopeks = 0
            wallet.daily_reset_at = now + 86400

    def get_or_create_wallet(self, user_id: str, currency: str) -> Wallet:
        """Get existing wallet or create a new one for user."""
        now = int(time.time())
        with get_db() as db:
            self._begin_wallet_transaction(db)
            wallet = (
                db.query(Wallet)
                .filter(Wallet.user_id == user_id, Wallet.currency == currency)
                .with_for_update()
                .first()
            )
            if wallet:
                self._refresh_wallet_state(db, wallet, now)
                db.commit()
                db.refresh(wallet)
                return wallet

            wallet = Wallet(
                id=str(uuid.uuid4()),
                user_id=user_id,
                currency=currency,
                balance_topup_kopeks=0,
                balance_included_kopeks=0,
                daily_reserved_kopeks=0,
                auto_topup_enabled=False,
                auto_topup_fail_count=0,
                created_at=now,
                updated_at=now,
            )
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
            return wallet

    def refresh_wallet(self, wallet_id: str) -> Wallet:
        """Refresh wallet limits and reset daily spend if needed."""
        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)
            wallet.updated_at = now
            db.commit()
            db.refresh(wallet)
            return wallet

    def _lock_wallet(self, db, wallet_id: str) -> Wallet:
        self._begin_wallet_transaction(db)
        wallet = db.query(Wallet).filter(Wallet.id == wallet_id).with_for_update().first()
        if not wallet:
            raise WalletError(f"Wallet {wallet_id} not found")
        return wallet

    def _begin_wallet_transaction(self, db) -> None:
        dialect = getattr(db.bind, "dialect", None)
        if dialect and dialect.name == "sqlite":
            db.execute(sa.text("BEGIN IMMEDIATE"))

    def _refresh_wallet_state(self, db, wallet: Wallet, now: int) -> None:
        self._reset_daily_spent_if_needed(wallet, now)
        self._release_expired_holds(db, wallet, now)
        self._expire_wallet_balances(db, wallet, now)

    def _entry_query(
        self,
        db,
        wallet_id: str,
        reference_id: str,
        reference_type: str,
        entry_type: LedgerEntryType,
    ):
        return db.query(LedgerEntry).filter(
            LedgerEntry.wallet_id == wallet_id,
            LedgerEntry.reference_type == reference_type,
            LedgerEntry.reference_id == reference_id,
            LedgerEntry.type == entry_type.value,
        )

    def _expire_wallet_balances(self, db, wallet: Wallet, now: int) -> None:
        expired_included = 0
        if wallet.included_expires_at and wallet.included_expires_at <= now:
            expired_included = max(int(wallet.balance_included_kopeks), 0)
            wallet.balance_included_kopeks = 0
            wallet.included_expires_at = None

        expired_topup = 0
        if wallet.topup_expires_at and wallet.topup_expires_at <= now:
            expired_topup = max(int(wallet.balance_topup_kopeks), 0)
            wallet.balance_topup_kopeks = 0
            wallet.topup_expires_at = None

        expired_total = expired_included + expired_topup
        if expired_total <= 0:
            return

        db.add(
            LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.ADJUSTMENT.value,
                amount_kopeks=-expired_total,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=str(uuid.uuid4()),
                reference_type="wallet_credit_expiry",
                metadata_json={
                    "reason": "credit_expired",
                    "expired_included_kopeks": expired_included,
                    "expired_topup_kopeks": expired_topup,
                },
                created_at=now,
            )
        )

    def _release_expired_holds(self, db, wallet: Wallet, now: int) -> None:
        expired_holds = (
            db.query(LedgerEntry)
            .filter(
                LedgerEntry.wallet_id == wallet.id,
                LedgerEntry.type == LedgerEntryType.HOLD.value,
                LedgerEntry.hold_expires_at.isnot(None),
                LedgerEntry.hold_expires_at <= now,
            )
            .all()
        )
        for hold_entry in expired_holds:
            if not hold_entry.reference_id or not hold_entry.reference_type:
                continue
            terminal = (
                db.query(LedgerEntry.id)
                .filter(
                    LedgerEntry.wallet_id == wallet.id,
                    LedgerEntry.reference_type == hold_entry.reference_type,
                    LedgerEntry.reference_id == hold_entry.reference_id,
                    LedgerEntry.type.in_(
                        [
                            LedgerEntryType.CHARGE.value,
                            LedgerEntryType.RELEASE.value,
                        ]
                    ),
                )
                .first()
            )
            if terminal:
                continue
            self._release_hold_locked(db, wallet, hold_entry, now, "hold_expired")

    def _compute_hold_breakdown(self, wallet: Wallet, amount_kopeks: int) -> Tuple[int, int]:
        if int(wallet.balance_topup_kopeks) < 0:
            raise InsufficientFundsError("Wallet has outstanding balance")

        available_included = max(int(wallet.balance_included_kopeks), 0)
        available_topup = max(int(wallet.balance_topup_kopeks), 0)

        hold_included = min(available_included, amount_kopeks)
        remaining = amount_kopeks - hold_included
        hold_topup = min(available_topup, remaining)
        if hold_included + hold_topup < amount_kopeks:
            raise InsufficientFundsError("Insufficient funds for hold")
        return hold_included, hold_topup

    def hold_funds(
        self,
        wallet_id: str,
        amount_kopeks: int,
        reference_id: str,
        reference_type: str,
        idempotency_key: Optional[str] = None,
        hold_expires_at: Optional[int] = None,
        daily_cap_kopeks: Optional[int] = None,
        correlation_id: Optional[str] = None,
        quota_reservation_id: Optional[str] = None,
    ) -> LedgerEntry:
        """Place a hold on wallet funds and return ledger entry."""
        if amount_kopeks <= 0:
            raise WalletError("Hold amount must be positive")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)

            existing = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.HOLD,
            ).first()
            if existing:
                existing_metadata = existing.metadata_json or {}
                if (
                    abs(int(existing.amount_kopeks)) != amount_kopeks
                    or existing.user_id != wallet.user_id
                    or existing.correlation_id != correlation_id
                    or (idempotency_key is not None and existing.idempotency_key != idempotency_key)
                    or existing_metadata.get("quota_reservation_id") != quota_reservation_id
                ):
                    raise WalletError("Idempotency key reused with different hold data")
                db.commit()
                return existing

            effective_daily_cap = daily_cap_kopeks if daily_cap_kopeks is not None else wallet.daily_cap_kopeks
            daily_committed = int(wallet.daily_spent_kopeks) + int(wallet.daily_reserved_kopeks)
            if effective_daily_cap is not None and daily_committed + amount_kopeks > effective_daily_cap:
                raise DailyCapExceededError(
                    int(effective_daily_cap),
                    daily_committed,
                    amount_kopeks,
                )

            hold_included, hold_topup = self._compute_hold_breakdown(wallet, amount_kopeks)

            wallet.balance_included_kopeks -= hold_included
            wallet.balance_topup_kopeks -= hold_topup
            wallet.daily_reserved_kopeks += amount_kopeks
            wallet.updated_at = now

            entry = LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.HOLD.value,
                amount_kopeks=-amount_kopeks,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=reference_id,
                reference_type=reference_type,
                correlation_id=correlation_id,
                idempotency_key=idempotency_key,
                hold_expires_at=hold_expires_at,
                metadata_json={
                    "held_included_kopeks": hold_included,
                    "held_topup_kopeks": hold_topup,
                    "held_included_expires_at": wallet.included_expires_at,
                    "held_topup_expires_at": wallet.topup_expires_at,
                    "quota_reservation_id": quota_reservation_id,
                },
                created_at=now,
            )

            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

    def _release_hold_locked(
        self,
        db,
        wallet: Wallet,
        hold_entry: LedgerEntry,
        now: int,
        reason: str,
    ) -> LedgerEntry:
        metadata = hold_entry.metadata_json or {}
        held_amount = abs(int(hold_entry.amount_kopeks))
        release_topup, release_included = self._release_breakdown(
            metadata,
            held_amount,
        )

        held_topup_expires_at = metadata.get("held_topup_expires_at")
        if (
            isinstance(held_topup_expires_at, int)
            and held_topup_expires_at <= now
            and not (wallet.topup_expires_at and wallet.topup_expires_at > now)
        ):
            release_topup = 0

        held_included_expires_at = metadata.get("held_included_expires_at")
        if (
            isinstance(held_included_expires_at, int)
            and held_included_expires_at <= now
            and not (wallet.included_expires_at and wallet.included_expires_at > now)
        ):
            release_included = 0

        wallet.balance_topup_kopeks += release_topup
        wallet.balance_included_kopeks += release_included
        wallet.daily_reserved_kopeks = max(
            int(wallet.daily_reserved_kopeks) - held_amount,
            0,
        )
        wallet.updated_at = now

        reservation_id = metadata.get("quota_reservation_id")
        if isinstance(reservation_id, str) and reservation_id:
            reservation = db.get(QuotaReservation, reservation_id)
            if reservation and reservation.source == "subscription":
                db.delete(reservation)

        restored_amount = release_topup + release_included
        release_entry = LedgerEntry(
            id=str(uuid.uuid4()),
            user_id=wallet.user_id,
            wallet_id=wallet.id,
            currency=wallet.currency,
            type=LedgerEntryType.RELEASE.value,
            amount_kopeks=restored_amount,
            balance_included_after=wallet.balance_included_kopeks,
            balance_topup_after=wallet.balance_topup_kopeks,
            reference_id=hold_entry.reference_id,
            reference_type=hold_entry.reference_type,
            correlation_id=hold_entry.correlation_id,
            metadata_json={
                "reason": reason,
                "held_kopeks": held_amount,
                "release_topup_kopeks": release_topup,
                "release_included_kopeks": release_included,
                "expired_while_held_kopeks": held_amount - restored_amount,
            },
            created_at=now,
        )
        db.add(release_entry)
        return release_entry

    def release_hold(self, wallet_id: str, reference_id: str, reference_type: str) -> Optional[LedgerEntry]:
        """Release a hold and return release ledger entry if created."""
        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)

            hold_entry = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.HOLD,
            ).first()
            already_released = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.RELEASE,
            ).first()
            if already_released:
                db.commit()
                return already_released
            if not hold_entry:
                raise HoldNotFoundError("Hold not found")

            existing_charge = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.CHARGE,
            ).first()
            if existing_charge:
                db.commit()
                return None

            release_entry = self._release_hold_locked(
                db,
                wallet,
                hold_entry,
                now,
                "request_failed",
            )
            db.commit()
            db.refresh(release_entry)
            return release_entry

    def _add_usage_event_locked(
        self,
        db,
        event_data: UsageEventModel,
        wallet: Wallet,
    ) -> UsageEvent:
        if event_data.wallet_id != wallet.id or event_data.user_id != wallet.user_id:
            raise WalletError("Usage event does not match wallet owner")
        existing = (
            db.query(UsageEvent)
            .filter(
                UsageEvent.wallet_id == wallet.id,
                UsageEvent.request_id == event_data.request_id,
                UsageEvent.modality == event_data.modality,
            )
            .first()
        )
        if existing:
            if (
                existing.user_id != event_data.user_id
                or existing.model_id != event_data.model_id
                or int(existing.cost_charged_kopeks) != event_data.cost_charged_kopeks
            ):
                raise WalletError("Billing operation reused with different usage data")
            return existing

        payload = event_data.model_dump()
        payload["wallet_snapshot_json"] = {
            "balance_included_after": int(wallet.balance_included_kopeks),
            "balance_topup_after": int(wallet.balance_topup_kopeks),
        }
        event = UsageEvent(**payload)
        db.add(event)
        return event

    def _finalize_subscription_reservation_locked(
        self,
        db,
        reservation_id: Optional[str],
        actual_usage: Optional[Dict[str, int]],
        event_data: UsageEventModel,
    ) -> None:
        if not reservation_id:
            return
        reservation = db.get(QuotaReservation, reservation_id)
        if not reservation:
            return
        if (
            reservation.source != "subscription"
            or reservation.wallet_id != event_data.wallet_id
            or reservation.user_id != event_data.user_id
        ):
            raise WalletError("Quota reservation does not match billing operation")

        subscription = db.query(Subscription).filter(Subscription.id == reservation.subscription_id).first()
        if not subscription:
            raise WalletError("Subscription for quota reservation not found")

        for metric, amount in (actual_usage or {}).items():
            normalized_amount = max(int(amount), 0)
            if normalized_amount <= 0:
                continue
            db.add(
                Usage(
                    id=str(uuid.uuid4()),
                    user_id=event_data.user_id,
                    subscription_id=subscription.id,
                    metric=metric,
                    amount=normalized_amount,
                    period_start=subscription.current_period_start,
                    period_end=subscription.current_period_end,
                    model_id=event_data.model_id,
                    chat_id=event_data.chat_id,
                    extra_metadata={
                        "billing_operation_id": event_data.request_id,
                        "message_id": event_data.message_id,
                    },
                    created_at=event_data.created_at,
                )
            )
        db.delete(reservation)

    def reserve_subscription_quota(
        self,
        wallet_id: str,
        user_id: str,
        operation_id: str,
        subscription_id: str,
        requirements: Dict[str, int],
        limits: Dict[str, int],
        expires_at: int,
    ) -> str:
        """Reserve active subscription quota under the wallet lock."""
        now = int(time.time())
        normalized_requirements = {
            metric: max(int(amount), 0) for metric, amount in requirements.items() if int(amount) > 0
        }
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)
            if wallet.user_id != user_id:
                raise WalletError("Wallet does not belong to user")

            existing = db.query(QuotaReservation).filter(QuotaReservation.operation_id == operation_id).first()
            if existing:
                if (
                    existing.source != "subscription"
                    or existing.user_id != user_id
                    or existing.wallet_id != wallet_id
                    or existing.subscription_id != subscription_id
                    or existing.requirements_json != normalized_requirements
                ):
                    raise WalletError("Billing operation reused with different quota data")
                db.commit()
                return str(existing.id)

            subscription = (
                db.query(Subscription)
                .filter(
                    Subscription.id == subscription_id,
                    Subscription.user_id == user_id,
                    Subscription.status.in_(["active", "trialing"]),
                    Subscription.current_period_end > now,
                )
                .with_for_update()
                .first()
            )
            if not subscription:
                raise WalletError("Active subscription not found")

            expired_reservations = (
                db.query(QuotaReservation)
                .filter(
                    QuotaReservation.wallet_id == wallet_id,
                    QuotaReservation.source == "subscription",
                    QuotaReservation.expires_at <= now,
                )
                .all()
            )
            for expired in expired_reservations:
                db.delete(expired)

            active_reservations = (
                db.query(QuotaReservation)
                .filter(
                    QuotaReservation.subscription_id == subscription_id,
                    QuotaReservation.source == "subscription",
                    QuotaReservation.expires_at > now,
                )
                .all()
            )
            reserved: Dict[str, int] = {}
            for reservation in active_reservations:
                for metric, amount in (reservation.requirements_json or {}).items():
                    if isinstance(amount, int):
                        reserved[metric] = reserved.get(metric, 0) + max(amount, 0)

            for metric, required in normalized_requirements.items():
                limit = limits.get(metric)
                if limit is None:
                    continue
                used = int(
                    db.query(sa.func.coalesce(sa.func.sum(Usage.amount), 0))
                    .filter(
                        Usage.subscription_id == subscription_id,
                        Usage.metric == metric,
                        Usage.created_at >= subscription.current_period_start,
                        Usage.created_at <= subscription.current_period_end,
                    )
                    .scalar()
                    or 0
                ) + reserved.get(metric, 0)
                if used + required > limit:
                    raise QuotaReservationExceededError(
                        metric,
                        int(limit),
                        used,
                        required,
                    )

            reservation = QuotaReservation(
                id=str(uuid.uuid4()),
                operation_id=operation_id,
                user_id=user_id,
                wallet_id=wallet_id,
                source="subscription",
                subscription_id=subscription_id,
                requirements_json=normalized_requirements,
                expires_at=expires_at,
                created_at=now,
            )
            db.add(reservation)
            db.commit()
            return str(reservation.id)

    def release_subscription_quota(self, reservation_id: str) -> None:
        """Release a subscription reservation without a monetary hold."""
        with get_db() as db:
            self._begin_wallet_transaction(db)
            reservation = db.get(QuotaReservation, reservation_id)
            if not reservation or reservation.source != "subscription":
                return
            wallet = db.query(Wallet).filter(Wallet.id == reservation.wallet_id).with_for_update().first()
            if not wallet:
                raise WalletError("Wallet for quota reservation not found")
            reservation = db.get(QuotaReservation, reservation_id)
            if reservation and reservation.source == "subscription":
                db.delete(reservation)
                db.commit()

    def record_usage(
        self,
        wallet_id: str,
        event_data: UsageEventModel,
        quota_reservation_id: Optional[str] = None,
        subscription_usage: Optional[Dict[str, int]] = None,
    ) -> UsageEvent:
        """Record usage and finalize quota without a monetary hold."""
        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)
            event = self._add_usage_event_locked(db, event_data, wallet)
            self._finalize_subscription_reservation_locked(
                db,
                quota_reservation_id,
                subscription_usage,
                event_data,
            )
            db.commit()
            db.refresh(event)
            return event

    def settle_hold(
        self,
        wallet_id: str,
        reference_id: str,
        reference_type: str,
        actual_amount_kopeks: int,
        charged_input_kopeks: Optional[int] = None,
        charged_output_kopeks: Optional[int] = None,
        usage_event: Optional[UsageEventModel] = None,
        quota_reservation_id: Optional[str] = None,
        subscription_usage: Optional[Dict[str, int]] = None,
    ) -> LedgerEntry:
        """Atomically settle a hold, usage event, and subscription quota."""
        if actual_amount_kopeks < 0:
            raise WalletError("Actual amount must be non-negative")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._reset_daily_spent_if_needed(wallet, now)
            self._expire_wallet_balances(db, wallet, now)

            hold_entry = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.HOLD,
            ).first()
            if not hold_entry:
                raise HoldNotFoundError("Hold not found")

            released = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.RELEASE,
            ).first()
            if released:
                raise HoldNotFoundError("Hold already released")

            existing_charge = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.CHARGE,
            ).first()
            if existing_charge:
                if usage_event:
                    self._add_usage_event_locked(db, usage_event, wallet)
                    self._finalize_subscription_reservation_locked(
                        db,
                        quota_reservation_id,
                        subscription_usage,
                        usage_event,
                    )
                db.commit()
                return existing_charge

            held_amount = abs(int(hold_entry.amount_kopeks))
            hold_metadata = hold_entry.metadata_json or {}
            release_amount = max(held_amount - actual_amount_kopeks, 0)
            release_topup = 0
            release_included = 0
            if release_amount > 0:
                release_topup, release_included = self._release_breakdown(
                    hold_metadata,
                    release_amount,
                )
                held_topup_expires_at = hold_metadata.get("held_topup_expires_at")
                if (
                    isinstance(held_topup_expires_at, int)
                    and held_topup_expires_at <= now
                    and not (wallet.topup_expires_at and wallet.topup_expires_at > now)
                ):
                    release_topup = 0
                held_included_expires_at = hold_metadata.get("held_included_expires_at")
                if (
                    isinstance(held_included_expires_at, int)
                    and held_included_expires_at <= now
                    and not (wallet.included_expires_at and wallet.included_expires_at > now)
                ):
                    release_included = 0

                wallet.balance_topup_kopeks += release_topup
                wallet.balance_included_kopeks += release_included
                db.add(
                    LedgerEntry(
                        id=str(uuid.uuid4()),
                        user_id=wallet.user_id,
                        wallet_id=wallet.id,
                        currency=wallet.currency,
                        type=LedgerEntryType.RELEASE.value,
                        amount_kopeks=release_topup + release_included,
                        balance_included_after=wallet.balance_included_kopeks,
                        balance_topup_after=wallet.balance_topup_kopeks,
                        reference_id=reference_id,
                        reference_type=reference_type,
                        correlation_id=hold_entry.correlation_id,
                        metadata_json={
                            "reason": "settlement_delta",
                            "requested_release_kopeks": release_amount,
                            "release_topup_kopeks": release_topup,
                            "release_included_kopeks": release_included,
                        },
                        created_at=now,
                    )
                )

            overage_amount = max(actual_amount_kopeks - held_amount, 0)
            if overage_amount > 0:
                available_included = max(int(wallet.balance_included_kopeks), 0)
                available_topup = max(int(wallet.balance_topup_kopeks), 0)
                debit_included = min(available_included, overage_amount)
                remaining = overage_amount - debit_included
                debit_topup = min(available_topup, remaining)
                debt_topup = remaining - debit_topup
                wallet.balance_included_kopeks -= debit_included
                wallet.balance_topup_kopeks -= debit_topup + debt_topup
                db.add(
                    LedgerEntry(
                        id=str(uuid.uuid4()),
                        user_id=wallet.user_id,
                        wallet_id=wallet.id,
                        currency=wallet.currency,
                        type=LedgerEntryType.ADJUSTMENT.value,
                        amount_kopeks=-overage_amount,
                        balance_included_after=wallet.balance_included_kopeks,
                        balance_topup_after=wallet.balance_topup_kopeks,
                        reference_id=reference_id,
                        reference_type=reference_type,
                        correlation_id=hold_entry.correlation_id,
                        metadata_json={
                            "reason": "hold_overage",
                            "held_kopeks": held_amount,
                            "charged_kopeks": actual_amount_kopeks,
                            "overage_kopeks": overage_amount,
                            "debited_included_kopeks": debit_included,
                            "debited_topup_kopeks": debit_topup,
                            "debt_topup_kopeks": debt_topup,
                        },
                        created_at=now,
                    )
                )

            wallet.daily_reserved_kopeks = max(
                int(wallet.daily_reserved_kopeks) - held_amount,
                0,
            )
            wallet.daily_spent_kopeks += actual_amount_kopeks
            wallet.updated_at = now

            charge_entry = LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.CHARGE.value,
                amount_kopeks=0,
                charged_input_kopeks=charged_input_kopeks,
                charged_output_kopeks=charged_output_kopeks,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=reference_id,
                reference_type=reference_type,
                correlation_id=hold_entry.correlation_id,
                metadata_json={
                    "charged_kopeks": actual_amount_kopeks,
                    "held_kopeks": held_amount,
                    "overage_kopeks": overage_amount,
                },
                created_at=now,
            )
            db.add(charge_entry)

            if usage_event:
                self._add_usage_event_locked(db, usage_event, wallet)
                self._finalize_subscription_reservation_locked(
                    db,
                    quota_reservation_id,
                    subscription_usage,
                    usage_event,
                )

            db.commit()
            db.refresh(charge_entry)
            return charge_entry

    def apply_topup(
        self,
        wallet_id: str,
        amount_kopeks: int,
        reference_id: str,
        reference_type: str,
        idempotency_key: Optional[str] = None,
        expires_at: Optional[int] = None,
        metadata: Optional[JsonDict] = None,
    ) -> LedgerEntry:
        """Apply topup amount to wallet and write ledger entry."""
        if amount_kopeks <= 0:
            raise WalletError("Topup amount must be positive")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)

            existing = self._entry_query(
                db,
                wallet.id,
                reference_id,
                reference_type,
                LedgerEntryType.TOPUP,
            ).first()
            if existing and int(existing.amount_kopeks) != amount_kopeks:
                raise WalletError("Idempotency key reused with different topup amount")
            if existing:
                db.commit()
                return existing

            wallet.balance_topup_kopeks += amount_kopeks
            if expires_at is None:
                wallet.topup_expires_at = None
            else:
                wallet.topup_expires_at = max(
                    int(wallet.topup_expires_at or 0),
                    expires_at,
                )
            wallet.updated_at = now

            entry_metadata = dict(metadata or {})
            entry_metadata["expiry_policy"] = "rolling_wallet_balance"

            entry = LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.TOPUP.value,
                amount_kopeks=amount_kopeks,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=reference_id,
                reference_type=reference_type,
                idempotency_key=idempotency_key,
                expires_at=expires_at,
                metadata_json=entry_metadata,
                created_at=now,
            )

            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

    def adjust_balances(
        self,
        wallet_id: str,
        delta_topup_kopeks: int,
        delta_included_kopeks: int,
        reason: str,
        admin_user_id: str,
        idempotency_key: Optional[str] = None,
        reference_id: Optional[str] = None,
        reference_type: str = "admin_wallet_adjustment",
    ) -> LedgerEntry:
        """Apply manual admin balance adjustments and create ledger entry."""
        if delta_topup_kopeks == 0 and delta_included_kopeks == 0:
            raise WalletError("At least one balance delta must be non-zero")

        reason_normalized = reason.strip()
        if not reason_normalized:
            raise WalletError("Adjustment reason is required")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._refresh_wallet_state(db, wallet, now)

            if idempotency_key:
                existing_by_idempotency = (
                    db.query(LedgerEntry)
                    .filter(
                        LedgerEntry.idempotency_key == idempotency_key,
                        LedgerEntry.wallet_id == wallet.id,
                        LedgerEntry.type == LedgerEntryType.ADJUSTMENT.value,
                        LedgerEntry.reference_type == reference_type,
                    )
                    .first()
                )
                if existing_by_idempotency:
                    db.commit()
                    return existing_by_idempotency

            effective_reference_id = reference_id or str(uuid.uuid4())
            existing_by_reference = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == effective_reference_id,
                    LedgerEntry.wallet_id == wallet.id,
                    LedgerEntry.type == LedgerEntryType.ADJUSTMENT.value,
                )
                .first()
            )
            if existing_by_reference:
                db.commit()
                return existing_by_reference

            wallet.balance_topup_kopeks += delta_topup_kopeks
            wallet.balance_included_kopeks += delta_included_kopeks
            if delta_topup_kopeks > 0:
                wallet.topup_expires_at = None
            if delta_included_kopeks > 0:
                wallet.included_expires_at = None
            wallet.updated_at = now

            entry = LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.ADJUSTMENT.value,
                amount_kopeks=delta_topup_kopeks + delta_included_kopeks,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=effective_reference_id,
                reference_type=reference_type,
                idempotency_key=idempotency_key,
                metadata_json={
                    "reason": reason_normalized,
                    "source": "admin_adjustment",
                    "admin_user_id": admin_user_id,
                    "delta_topup_kopeks": delta_topup_kopeks,
                    "delta_included_kopeks": delta_included_kopeks,
                },
                created_at=now,
            )

            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

    def cleanup_expired_wallets(self, limit: int = 500) -> int:
        """Release expired holds and expire wallet credit buckets."""
        now = int(time.time())
        wallet_ids: set[str] = set()
        with get_db() as db:
            expiring_wallets = (
                db.query(Wallet.id)
                .filter(
                    sa.or_(
                        Wallet.included_expires_at <= now,
                        Wallet.topup_expires_at <= now,
                    )
                )
                .limit(limit)
                .all()
            )
            wallet_ids.update(str(row[0]) for row in expiring_wallets)

            remaining = max(limit - len(wallet_ids), 0)
            if remaining:
                expired_hold_wallets = (
                    db.query(LedgerEntry.wallet_id)
                    .filter(
                        LedgerEntry.type == LedgerEntryType.HOLD.value,
                        LedgerEntry.hold_expires_at.isnot(None),
                        LedgerEntry.hold_expires_at <= now,
                    )
                    .distinct()
                    .limit(remaining)
                    .all()
                )
                wallet_ids.update(str(row[0]) for row in expired_hold_wallets)

        for wallet_id in wallet_ids:
            self.refresh_wallet(wallet_id)
        return len(wallet_ids)

    def _release_breakdown(self, metadata_json: JsonDict, release_amount: int) -> Tuple[int, int]:
        held_included = int(metadata_json.get("held_included_kopeks", 0))
        held_topup = int(metadata_json.get("held_topup_kopeks", 0))

        release_topup = min(held_topup, release_amount)
        remaining = release_amount - release_topup
        release_included = min(held_included, remaining)
        return release_topup, release_included


wallet_service = WalletService()
