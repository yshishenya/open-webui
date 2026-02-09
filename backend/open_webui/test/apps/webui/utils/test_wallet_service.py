import time
import pytest

from test.util.abstract_integration_test import AbstractPostgresTest


class TestWalletService(AbstractPostgresTest):
    def test_hold_settle_release_included_and_topup(self) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_included_kopeks": 500, "balance_topup_kopeks": 700},
        )

        hold_entry = wallet_service.hold_funds(wallet.id, 1000, "hold_ref_1", "test")
        assert hold_entry.amount_kopeks == -1000
        assert hold_entry.metadata_json["held_included_kopeks"] == 500
        assert hold_entry.metadata_json["held_topup_kopeks"] == 500

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_included_kopeks == 0
        assert updated_wallet.balance_topup_kopeks == 200

        charge_entry = wallet_service.settle_hold(wallet.id, "hold_ref_1", "test", 600)
        assert charge_entry.metadata_json["charged_kopeks"] == 600

        release_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "hold_ref_1",
                LedgerEntry.type == "release",
            )
            .first()
        )
        assert release_entry is not None
        assert release_entry.metadata_json["release_included_kopeks"] == 0
        assert release_entry.metadata_json["release_topup_kopeks"] == 400

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_included_kopeks == 0
        assert updated_wallet.balance_topup_kopeks == 600
        assert updated_wallet.daily_spent_kopeks == 600

    def test_hold_idempotency(self) -> None:
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 1000})

        first = wallet_service.hold_funds(wallet.id, 200, "hold_ref_idem", "test")
        second = wallet_service.hold_funds(wallet.id, 200, "hold_ref_idem", "test")

        assert first.id == second.id

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 800

        from open_webui.internal.db import ScopedSession as Session

        hold_entries = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "hold_ref_idem",
                LedgerEntry.type == "hold",
            )
            .all()
        )
        assert len(hold_entries) == 1

    def test_settle_hold_exceeds_held_raises(self) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 500})

        wallet_service.hold_funds(wallet.id, 300, "hold_ref_err", "test")

        charge_entry = wallet_service.settle_hold(
            wallet.id, "hold_ref_err", "test", 400
        )
        assert charge_entry.metadata_json["charged_kopeks"] == 400
        assert charge_entry.metadata_json["held_kopeks"] == 300
        assert charge_entry.metadata_json["overage_kopeks"] == 100

        overage_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "hold_ref_err",
                LedgerEntry.type == "adjustment",
            )
            .first()
        )
        assert overage_entry is not None
        assert overage_entry.amount_kopeks == -100

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 100

    def test_release_hold_after_charge_noop(self) -> None:
        from open_webui.utils.wallet import wallet_service
        from open_webui.models.billing import Wallets

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 500})

        wallet_service.hold_funds(wallet.id, 200, "hold_ref_charge", "test")
        wallet_service.settle_hold(wallet.id, "hold_ref_charge", "test", 200)

        release_entry = wallet_service.release_hold(
            wallet.id, "hold_ref_charge", "test"
        )
        assert release_entry is None

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 300

    def test_refresh_wallet_resets_daily_spent(self) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        now = int(time.time())
        Wallets.update_wallet(
            wallet.id,
            {"daily_spent_kopeks": 100, "daily_reset_at": now - 10},
        )

        refreshed = wallet_service.refresh_wallet(wallet.id)
        assert refreshed.daily_spent_kopeks == 0
        assert refreshed.daily_reset_at > now

    def test_release_hold_restores_balance(self) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_included_kopeks": 200, "balance_topup_kopeks": 300},
        )

        wallet_service.hold_funds(wallet.id, 400, "hold_ref_release", "test")

        released = wallet_service.release_hold(wallet.id, "hold_ref_release", "test")
        assert released is not None

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_included_kopeks == 200
        assert updated_wallet.balance_topup_kopeks == 300

        release_entry = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "hold_ref_release",
                LedgerEntry.type == "release",
            )
            .first()
        )
        assert release_entry is not None

    def test_apply_topup_idempotency_and_expires_at(self) -> None:
        from open_webui.internal.db import ScopedSession as Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 0})

        expires_at = int(time.time()) + 86400
        first = wallet_service.apply_topup(
            wallet_id=wallet.id,
            amount_kopeks=1000,
            reference_id="topup_ref_1",
            reference_type="payment",
            idempotency_key="idem_1",
            expires_at=expires_at,
        )
        second = wallet_service.apply_topup(
            wallet_id=wallet.id,
            amount_kopeks=1000,
            reference_id="topup_ref_1",
            reference_type="payment",
            idempotency_key="idem_1",
            expires_at=expires_at,
        )

        assert first.id == second.id
        assert first.expires_at == expires_at

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 1000

        entries = (
            Session.query(LedgerEntry)
            .filter(
                LedgerEntry.reference_id == "topup_ref_1",
                LedgerEntry.type == "topup",
            )
            .all()
        )
        assert len(entries) == 1

    def test_apply_topup_invalid_amount(self) -> None:
        from open_webui.utils.wallet import WalletError, wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        with pytest.raises(WalletError):
            wallet_service.apply_topup(
                wallet_id=wallet.id,
                amount_kopeks=0,
                reference_id="topup_ref_invalid",
                reference_type="payment",
            )

    def test_adjust_balances_updates_wallet_and_creates_adjustment_entry(self) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_topup_kopeks": 1000, "balance_included_kopeks": 500},
        )

        entry = wallet_service.adjust_balances(
            wallet_id=wallet.id,
            delta_topup_kopeks=-200,
            delta_included_kopeks=300,
            reason="admin correction",
            admin_user_id="admin-1",
            idempotency_key="adjust-idem-1",
        )

        assert entry.type == "adjustment"
        assert entry.amount_kopeks == 100
        assert entry.metadata_json is not None
        assert entry.metadata_json.get("reason") == "admin correction"
        assert entry.metadata_json.get("admin_user_id") == "admin-1"

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 800
        assert updated_wallet.balance_included_kopeks == 800

    def test_adjust_balances_idempotent_by_key(self) -> None:
        from open_webui.models.billing import Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_topup_kopeks": 1000, "balance_included_kopeks": 0},
        )

        first = wallet_service.adjust_balances(
            wallet_id=wallet.id,
            delta_topup_kopeks=-100,
            delta_included_kopeks=0,
            reason="manual debit",
            admin_user_id="admin-1",
            idempotency_key="adjust-idem-2",
        )
        second = wallet_service.adjust_balances(
            wallet_id=wallet.id,
            delta_topup_kopeks=-100,
            delta_included_kopeks=0,
            reason="manual debit",
            admin_user_id="admin-1",
            idempotency_key="adjust-idem-2",
        )

        assert first.id == second.id
        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 900

    def test_adjust_balances_requires_reason_and_non_zero_delta(self) -> None:
        from open_webui.utils.wallet import WalletError, wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")

        with pytest.raises(WalletError):
            wallet_service.adjust_balances(
                wallet_id=wallet.id,
                delta_topup_kopeks=0,
                delta_included_kopeks=0,
                reason="valid",
                admin_user_id="admin-1",
            )

        with pytest.raises(WalletError):
            wallet_service.adjust_balances(
                wallet_id=wallet.id,
                delta_topup_kopeks=100,
                delta_included_kopeks=0,
                reason="   ",
                admin_user_id="admin-1",
            )
