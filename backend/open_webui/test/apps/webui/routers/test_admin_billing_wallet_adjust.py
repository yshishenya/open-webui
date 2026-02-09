from __future__ import annotations

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestAdminBillingWalletAdjust(AbstractPostgresTest):
    BASE_PATH = "/api/v1/admin/billing"

    def setup_method(self) -> None:
        super().setup_method()
        from open_webui.models.users import Users

        self.target_user_id = "2"
        if not Users.get_user_by_id(self.target_user_id):
            Users.insert_new_user(
                id=self.target_user_id,
                name="Target User",
                email="target.user@example.com",
                profile_image_url="/user.png",
                role="user",
            )

    def test_get_user_wallet_summary(self, monkeypatch) -> None:
        from open_webui.routers import admin_billing

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        with mock_webui_user(id="admin-1", role="admin", email="admin@example.com"):
            response = self.fast_api_client.get(
                self.create_url(f"/users/{self.target_user_id}/wallet")
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["user_id"] == self.target_user_id
        assert payload["wallet"]["currency"] == "RUB"
        assert payload["wallet"]["balance_topup_kopeks"] == 0
        assert payload["wallet"]["balance_included_kopeks"] == 0
        assert isinstance(payload["ledger_preview"], list)

    def test_adjust_user_wallet_success_and_idempotency(self, monkeypatch) -> None:
        from open_webui.models.audit import AuditLogs
        from open_webui.models.billing import LedgerEntries, Wallets
        from open_webui.routers import admin_billing
        from open_webui.utils.wallet import wallet_service

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        wallet = wallet_service.get_or_create_wallet(self.target_user_id, "RUB")
        Wallets.update_wallet(
            wallet.id,
            {
                "balance_topup_kopeks": 1_000,
                "balance_included_kopeks": 500,
            },
        )

        payload = {
            "delta_topup_kopeks": -200,
            "delta_included_kopeks": 300,
            "reason": "manual correction",
            "idempotency_key": "wallet-adjust-idem-1",
        }

        with mock_webui_user(id="admin-1", role="admin", email="admin@example.com"):
            first = self.fast_api_client.post(
                self.create_url(f"/users/{self.target_user_id}/wallet/adjust"),
                json=payload,
            )
            second = self.fast_api_client.post(
                self.create_url(f"/users/{self.target_user_id}/wallet/adjust"),
                json=payload,
            )

        assert first.status_code == 200
        assert second.status_code == 200

        first_json = first.json()
        second_json = second.json()

        assert first_json["success"] is True
        assert first_json["wallet"]["balance_topup_kopeks"] == 800
        assert first_json["wallet"]["balance_included_kopeks"] == 800
        assert first_json["ledger_entry"]["type"] == "adjustment"
        assert (
            first_json["ledger_entry"]["metadata_json"]["reason"] == "manual correction"
        )

        assert second_json["wallet"]["balance_topup_kopeks"] == 800
        assert second_json["wallet"]["balance_included_kopeks"] == 800
        assert second_json["ledger_entry"]["id"] == first_json["ledger_entry"]["id"]

        entries = LedgerEntries.get_entries_by_user(
            self.target_user_id, limit=20, offset=0
        )
        adjustment_entries = [entry for entry in entries if entry.type == "adjustment"]
        assert len(adjustment_entries) == 1

        logs = AuditLogs.get_logs(entity_type="wallet", entity_id=wallet.id, limit=10)
        assert len(logs) >= 1
        assert logs[0].action == "wallet_adjusted"

    def test_adjust_user_wallet_rejects_zero_delta(self, monkeypatch) -> None:
        from open_webui.routers import admin_billing

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        with mock_webui_user(id="admin-1", role="admin", email="admin@example.com"):
            response = self.fast_api_client.post(
                self.create_url(f"/users/{self.target_user_id}/wallet/adjust"),
                json={
                    "delta_topup_kopeks": 0,
                    "delta_included_kopeks": 0,
                    "reason": "noop",
                },
            )

        assert response.status_code == 400
        assert "non-zero" in response.json()["detail"]

    def test_adjust_user_wallet_rejects_blank_reason(self, monkeypatch) -> None:
        from open_webui.routers import admin_billing

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        with mock_webui_user(id="admin-1", role="admin", email="admin@example.com"):
            response = self.fast_api_client.post(
                self.create_url(f"/users/{self.target_user_id}/wallet/adjust"),
                json={
                    "delta_topup_kopeks": 1,
                    "delta_included_kopeks": 0,
                    "reason": "   ",
                },
            )

        assert response.status_code == 400
        assert "reason is required" in response.json()["detail"]

    def test_adjust_user_wallet_for_unknown_user(self, monkeypatch) -> None:
        from open_webui.routers import admin_billing

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        with mock_webui_user(id="admin-1", role="admin", email="admin@example.com"):
            response = self.fast_api_client.post(
                self.create_url("/users/missing-user-id/wallet/adjust"),
                json={
                    "delta_topup_kopeks": 100,
                    "delta_included_kopeks": 0,
                    "reason": "manual credit",
                },
            )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_adjust_user_wallet_rejects_non_admin(self, monkeypatch) -> None:
        from fastapi import HTTPException, status
        from open_webui.routers import admin_billing

        monkeypatch.setattr(admin_billing, "ENABLE_BILLING_WALLET", True)

        def reject_non_admin():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )

        self.fast_api_client.app.dependency_overrides[admin_billing.get_admin_user] = (
            reject_non_admin
        )
        try:
            response = self.fast_api_client.post(
                self.create_url(f"/users/{self.target_user_id}/wallet/adjust"),
                json={
                    "delta_topup_kopeks": 100,
                    "delta_included_kopeks": 0,
                    "reason": "manual credit",
                },
            )
        finally:
            self.fast_api_client.app.dependency_overrides.pop(
                admin_billing.get_admin_user, None
            )

        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]
