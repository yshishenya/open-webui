import time
import uuid
from typing import Optional, Tuple

import sqlalchemy as sa

from open_webui.internal.db import get_db
from open_webui.models.billing import LedgerEntry, LedgerEntryType, Wallet
from open_webui.models.billing_wallet import JsonDict


class WalletError(Exception):
    """Base wallet error."""


class InsufficientFundsError(WalletError):
    """Raised when wallet balance is insufficient."""


class HoldNotFoundError(WalletError):
    """Raised when hold entry cannot be found."""


class WalletService:
    """Wallet operations for hold/settle/release flows."""

    def _reset_daily_spent_if_needed(self, wallet: Wallet, now: int) -> None:
        reset_at = wallet.daily_reset_at or 0
        if reset_at <= now:
            wallet.daily_spent_kopeks = 0
            wallet.daily_reset_at = now + 86400

    def get_or_create_wallet(self, user_id: str, currency: str) -> Wallet:
        """Get existing wallet or create a new one for user."""
        now = int(time.time())
        with get_db() as db:
            wallet = (
                db.query(Wallet)
                .filter(Wallet.user_id == user_id, Wallet.currency == currency)
                .first()
            )
            if wallet:
                return wallet

            wallet = Wallet(
                id=str(uuid.uuid4()),
                user_id=user_id,
                currency=currency,
                balance_topup_kopeks=0,
                balance_included_kopeks=0,
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
            self._reset_daily_spent_if_needed(wallet, now)
            wallet.updated_at = now
            db.commit()
            db.refresh(wallet)
            return wallet

    def _lock_wallet(self, db, wallet_id: str) -> Wallet:
        dialect = getattr(db.bind, "dialect", None)
        if dialect and dialect.name == "sqlite":
            db.execute(sa.text("BEGIN IMMEDIATE"))
        wallet = (
            db.query(Wallet)
            .filter(Wallet.id == wallet_id)
            .with_for_update()
            .first()
        )
        if not wallet:
            raise WalletError(f"Wallet {wallet_id} not found")
        return wallet

    def _compute_hold_breakdown(
        self, wallet: Wallet, amount_kopeks: int
    ) -> Tuple[int, int]:
        hold_included = min(wallet.balance_included_kopeks, amount_kopeks)
        remaining = amount_kopeks - hold_included
        hold_topup = min(wallet.balance_topup_kopeks, remaining)
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
    ) -> LedgerEntry:
        """Place a hold on wallet funds and return ledger entry."""
        if amount_kopeks <= 0:
            raise WalletError("Hold amount must be positive")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._reset_daily_spent_if_needed(wallet, now)

            existing = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.HOLD.value,
                )
                .first()
            )
            if existing:
                return existing

            hold_included, hold_topup = self._compute_hold_breakdown(
                wallet, amount_kopeks
            )

            wallet.balance_included_kopeks -= hold_included
            wallet.balance_topup_kopeks -= hold_topup
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
                idempotency_key=idempotency_key,
                hold_expires_at=hold_expires_at,
                metadata_json={
                    "held_included_kopeks": hold_included,
                    "held_topup_kopeks": hold_topup,
                },
                created_at=now,
            )

            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

    def release_hold(
        self, wallet_id: str, reference_id: str, reference_type: str
    ) -> Optional[LedgerEntry]:
        """Release a hold and return release ledger entry if created."""
        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)
            self._reset_daily_spent_if_needed(wallet, now)

            hold_entry = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.HOLD.value,
                )
                .first()
            )
            if not hold_entry:
                raise HoldNotFoundError("Hold not found")

            existing_charge = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.CHARGE.value,
                )
                .first()
            )
            if existing_charge:
                return None

            already_released = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.RELEASE.value,
                )
                .first()
            )
            if already_released:
                return already_released

            held_amount = abs(hold_entry.amount_kopeks)
            release_topup, release_included = self._release_breakdown(
                hold_entry.metadata_json or {}, held_amount
            )

            wallet.balance_topup_kopeks += release_topup
            wallet.balance_included_kopeks += release_included
            wallet.updated_at = now

            release_entry = LedgerEntry(
                id=str(uuid.uuid4()),
                user_id=wallet.user_id,
                wallet_id=wallet.id,
                currency=wallet.currency,
                type=LedgerEntryType.RELEASE.value,
                amount_kopeks=held_amount,
                balance_included_after=wallet.balance_included_kopeks,
                balance_topup_after=wallet.balance_topup_kopeks,
                reference_id=reference_id,
                reference_type=reference_type,
                metadata_json={
                    "release_topup_kopeks": release_topup,
                    "release_included_kopeks": release_included,
                },
                created_at=now,
            )

            db.add(release_entry)
            db.commit()
            db.refresh(release_entry)
            return release_entry

    def settle_hold(
        self,
        wallet_id: str,
        reference_id: str,
        reference_type: str,
        actual_amount_kopeks: int,
        charged_input_kopeks: Optional[int] = None,
        charged_output_kopeks: Optional[int] = None,
    ) -> LedgerEntry:
        """Settle hold with actual amount, release delta, and log charge."""
        if actual_amount_kopeks < 0:
            raise WalletError("Actual amount must be non-negative")

        now = int(time.time())
        with get_db() as db:
            wallet = self._lock_wallet(db, wallet_id)

            hold_entry = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.HOLD.value,
                )
                .first()
            )
            if not hold_entry:
                raise HoldNotFoundError("Hold not found")

            existing_charge = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.CHARGE.value,
                )
                .first()
            )
            if existing_charge:
                return existing_charge

            held_amount = abs(hold_entry.amount_kopeks)
            if actual_amount_kopeks > held_amount:
                raise WalletError("Actual amount exceeds held amount")

            release_amount = held_amount - actual_amount_kopeks
            if release_amount > 0:
                release_topup, release_included = self._release_breakdown(
                    hold_entry.metadata_json or {}, release_amount
                )
                wallet.balance_topup_kopeks += release_topup
                wallet.balance_included_kopeks += release_included
                wallet.updated_at = now

                release_entry = LedgerEntry(
                    id=str(uuid.uuid4()),
                    user_id=wallet.user_id,
                    wallet_id=wallet.id,
                    currency=wallet.currency,
                    type=LedgerEntryType.RELEASE.value,
                    amount_kopeks=release_amount,
                    balance_included_after=wallet.balance_included_kopeks,
                    balance_topup_after=wallet.balance_topup_kopeks,
                    reference_id=reference_id,
                    reference_type=reference_type,
                    metadata_json={
                        "release_topup_kopeks": release_topup,
                        "release_included_kopeks": release_included,
                    },
                    created_at=now,
                )
                db.add(release_entry)

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
                metadata_json={
                    "charged_kopeks": actual_amount_kopeks,
                },
                created_at=now,
            )
            db.add(charge_entry)
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

            existing = (
                db.query(LedgerEntry)
                .filter(
                    LedgerEntry.reference_type == reference_type,
                    LedgerEntry.reference_id == reference_id,
                    LedgerEntry.type == LedgerEntryType.TOPUP.value,
                )
                .first()
            )
            if existing:
                return existing

            wallet.balance_topup_kopeks += amount_kopeks
            wallet.updated_at = now

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
                metadata_json=metadata,
                created_at=now,
            )

            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry

    def _release_breakdown(
        self, metadata_json: JsonDict, release_amount: int
    ) -> Tuple[int, int]:
        held_included = int(metadata_json.get("held_included_kopeks", 0))
        held_topup = int(metadata_json.get("held_topup_kopeks", 0))

        release_topup = min(held_topup, release_amount)
        remaining = release_amount - release_topup
        release_included = min(held_included, remaining)
        return release_topup, release_included


wallet_service = WalletService()
