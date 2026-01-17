import time
import pytest

from test.util.abstract_integration_test import AbstractPostgresTest


class TestWalletService(AbstractPostgresTest):
    def test_hold_settle_release_included_and_topup(self) -> None:
        from open_webui.internal.db import Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_included_kopeks": 500, "balance_topup_kopeks": 700},
        )

        hold_entry = wallet_service.hold_funds(
            wallet.id, 1000, "hold_ref_1", "test"
        )
        assert hold_entry.amount_kopeks == -1000
        assert hold_entry.metadata_json["held_included_kopeks"] == 500
        assert hold_entry.metadata_json["held_topup_kopeks"] == 500

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_included_kopeks == 0
        assert updated_wallet.balance_topup_kopeks == 200

        charge_entry = wallet_service.settle_hold(
            wallet.id, "hold_ref_1", "test", 600
        )
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

        first = wallet_service.hold_funds(
            wallet.id, 200, "hold_ref_idem", "test"
        )
        second = wallet_service.hold_funds(
            wallet.id, 200, "hold_ref_idem", "test"
        )

        assert first.id == second.id

        updated_wallet = Wallets.get_wallet_by_id(wallet.id)
        assert updated_wallet is not None
        assert updated_wallet.balance_topup_kopeks == 800

        from open_webui.internal.db import Session

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
        from open_webui.utils.wallet import WalletError, wallet_service
        from open_webui.models.billing import Wallets

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(wallet.id, {"balance_topup_kopeks": 500})

        wallet_service.hold_funds(wallet.id, 300, "hold_ref_err", "test")

        with pytest.raises(WalletError):
            wallet_service.settle_hold(wallet.id, "hold_ref_err", "test", 400)

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
        from open_webui.internal.db import Session
        from open_webui.models.billing import LedgerEntry, Wallets
        from open_webui.utils.wallet import wallet_service

        wallet = wallet_service.get_or_create_wallet("1", "RUB")
        Wallets.update_wallet(
            wallet.id,
            {"balance_included_kopeks": 200, "balance_topup_kopeks": 300},
        )

        wallet_service.hold_funds(
            wallet.id, 400, "hold_ref_release", "test"
        )

        released = wallet_service.release_hold(
            wallet.id, "hold_ref_release", "test"
        )
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
        from open_webui.internal.db import Session
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
