import time
from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch

from open_webui.models.billing import SubscriptionModel, SubscriptionStatus
from open_webui.utils.wallet import WalletError
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingCorePaths(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def _subscription_model(self, user_id: str = "1") -> SubscriptionModel:
        now = int(time.time())
        return SubscriptionModel(
            id="sub_core",
            user_id=user_id,
            plan_id="plan_core",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + 3600,
            cancel_at_period_end=False,
            created_at=now,
            updated_at=now,
        )

    def test_public_plans_sorted_and_serialized(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)

        plans = [
            SimpleNamespace(
                id="plan_b",
                name="Pro",
                name_ru="Про",
                description="Pro desc",
                description_ru="Про описание",
                price=200,
                currency="RUB",
                interval="month",
                features=["f2"],
                quotas={"requests": 10},
                display_order=2,
            ),
            SimpleNamespace(
                id="plan_a",
                name="Basic",
                name_ru="Базовый",
                description="Basic desc",
                description_ru="Базовое описание",
                price=100,
                currency="RUB",
                interval="month",
                features=["f1"],
                quotas={"requests": 5},
                display_order=1,
            ),
        ]

        monkeypatch.setattr(billing_router.billing_service, "get_active_plans", lambda: plans)

        response = self.fast_api_client.get(self.create_url("/plans/public"))

        assert response.status_code == 200
        payload = response.json()
        assert [item["id"] for item in payload] == ["plan_a", "plan_b"]
        assert payload[0]["display_order"] == 1
        assert payload[0]["name_ru"] == "Базовый"
        assert payload[1]["description_ru"] == "Про описание"

    def test_public_plans_returns_500_when_service_fails(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)

        def _raise_error() -> list[object]:
            raise RuntimeError("plans storage unavailable")

        monkeypatch.setattr(billing_router.billing_service, "get_active_plans", _raise_error)

        response = self.fast_api_client.get(self.create_url("/plans/public"))

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to get plans"

    def test_get_balance_handles_disabled_wallet(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", False)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/balance"))

        assert response.status_code == 404
        assert response.json()["detail"] == "Billing wallet is disabled"

    def test_get_balance_maps_wallet_error_to_400(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        def _raise_wallet_error(*_: object, **__: object) -> object:
            raise WalletError("wallet unavailable")

        monkeypatch.setattr(
            billing_router.wallet_service,
            "get_or_create_wallet",
            _raise_wallet_error,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/balance"))

        assert response.status_code == 400
        assert response.json()["detail"] == "wallet unavailable"

    def test_get_balance_reports_saved_payment_method(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        wallet = SimpleNamespace(
            id="wallet_core",
            balance_topup_kopeks=1200,
            balance_included_kopeks=300,
            included_expires_at=None,
            max_reply_cost_kopeks=250,
            daily_cap_kopeks=1000,
            daily_spent_kopeks=150,
            daily_reset_at=123,
            auto_topup_enabled=True,
            auto_topup_threshold_kopeks=500,
            auto_topup_amount_kopeks=1000,
            auto_topup_fail_count=1,
            auto_topup_last_failed_at=321,
            currency="RUB",
        )

        monkeypatch.setattr(
            billing_router.wallet_service,
            "get_or_create_wallet",
            lambda *_: wallet,
        )
        monkeypatch.setattr(
            billing_router.Payments,
            "get_latest_payment_with_method",
            lambda *_, **__: object(),
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/balance"))

        assert response.status_code == 200
        payload = response.json()
        assert payload["balance_topup_kopeks"] == 1200
        assert payload["auto_topup_payment_method_saved"] is True
        assert payload["currency"] == "RUB"

    @pytest.mark.parametrize(
        "payload, expected_detail",
        [
            (
                {"enabled": True, "amount_kopeks": 1000},
                "threshold_kopeks and amount_kopeks are required when enabled",
            ),
            (
                {"enabled": True, "threshold_kopeks": -1, "amount_kopeks": 1000},
                "Auto-topup threshold and amount must be positive",
            ),
            (
                {"enabled": True, "threshold_kopeks": 100, "amount_kopeks": 999},
                "Invalid auto-topup amount",
            ),
        ],
    )
    def test_update_auto_topup_rejects_invalid_payloads(
        self,
        monkeypatch: MonkeyPatch,
        payload: dict[str, object],
        expected_detail: str,
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(billing_router, "BILLING_TOPUP_PACKAGES_KOPEKS", [1000, 1500])
        monkeypatch.setattr(
            billing_router.wallet_service,
            "get_or_create_wallet",
            lambda *_: SimpleNamespace(id="wallet_core"),
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/auto-topup"), json=payload)

        assert response.status_code == 400
        assert response.json()["detail"] == expected_detail

    def test_update_auto_topup_success_and_update_failure(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(billing_router, "BILLING_TOPUP_PACKAGES_KOPEKS", [1000, 1500])
        monkeypatch.setattr(
            billing_router.wallet_service,
            "get_or_create_wallet",
            lambda *_: SimpleNamespace(id="wallet_core"),
        )

        captured: dict[str, object] = {}

        def _update_wallet(wallet_id: str, updates: dict[str, object]) -> object:
            captured["wallet_id"] = wallet_id
            captured["updates"] = updates
            return object()

        monkeypatch.setattr(billing_router.Wallets, "update_wallet", _update_wallet)

        with mock_webui_user(id="1"):
            success_response = self.fast_api_client.post(
                self.create_url("/auto-topup"),
                json={
                    "enabled": True,
                    "threshold_kopeks": 500,
                    "amount_kopeks": 1000,
                },
            )

        assert success_response.status_code == 200
        assert success_response.json() == {"status": "ok"}
        assert captured["wallet_id"] == "wallet_core"
        assert captured["updates"] == {
            "auto_topup_enabled": True,
            "auto_topup_threshold_kopeks": 500,
            "auto_topup_amount_kopeks": 1000,
            "auto_topup_fail_count": 0,
            "auto_topup_last_failed_at": None,
        }

        monkeypatch.setattr(
            billing_router.Wallets,
            "update_wallet",
            lambda *_args, **_kwargs: None,
        )

        with mock_webui_user(id="1"):
            failed_response = self.fast_api_client.post(
                self.create_url("/auto-topup"),
                json={
                    "enabled": False,
                },
            )

        assert failed_response.status_code == 500
        assert failed_response.json()["detail"] == "Failed to update auto-topup settings"

    def test_update_billing_settings_validates_and_updates_contact(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(
            billing_router.wallet_service,
            "get_or_create_wallet",
            lambda *_: SimpleNamespace(id="wallet_core"),
        )

        wallet_updates: list[dict[str, object]] = []

        def _update_wallet(_wallet_id: str, updates: dict[str, object]) -> object:
            wallet_updates.append(updates)
            return object()

        contact_updates: list[dict[str, object]] = []

        def _update_user(_user_id: str, payload: dict[str, object]) -> object:
            contact_updates.append(payload)
            return object()

        monkeypatch.setattr(billing_router.Wallets, "update_wallet", _update_wallet)
        monkeypatch.setattr(billing_router.Users, "update_user_by_id", _update_user)

        with mock_webui_user(id="1"):
            invalid_response = self.fast_api_client.post(
                self.create_url("/settings"),
                json={"max_reply_cost_kopeks": -1},
            )

        assert invalid_response.status_code == 400
        assert invalid_response.json()["detail"] == "max_reply_cost_kopeks must be non-negative"

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/settings"),
                json={
                    "max_reply_cost_kopeks": 250,
                    "daily_cap_kopeks": 900,
                    "billing_contact_email": "billing@example.com",
                    "billing_contact_phone": "+79990000000",
                },
            )

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert wallet_updates[-1] == {
            "max_reply_cost_kopeks": 250,
            "daily_cap_kopeks": 900,
        }
        assert contact_updates[-1]["info"]["billing_contact_email"] == "billing@example.com"
        assert contact_updates[-1]["info"]["billing_contact_phone"] == "+79990000000"

        monkeypatch.setattr(
            billing_router.Wallets,
            "update_wallet",
            lambda *_args, **_kwargs: None,
        )

        with mock_webui_user(id="1"):
            failed_response = self.fast_api_client.post(
                self.create_url("/settings"),
                json={"daily_cap_kopeks": 1},
            )

        assert failed_response.status_code == 500
        assert failed_response.json()["detail"] == "Failed to update billing settings"

    def test_usage_and_quota_endpoints_cover_validation_and_remaining(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(
            billing_router.billing_service,
            "get_current_period_usage",
            lambda *_: 3,
        )
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: SimpleNamespace(plan_id="plan_core"),
        )
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_plan",
            lambda *_: SimpleNamespace(quotas={"requests": 10}),
        )
        monkeypatch.setattr(
            billing_router.billing_service,
            "check_quota",
            lambda *_: True,
        )

        with mock_webui_user(id="1"):
            invalid_usage = self.fast_api_client.get(self.create_url("/usage/invalid_metric"))
            usage = self.fast_api_client.get(self.create_url("/usage/requests"))
            invalid_quota = self.fast_api_client.post(
                self.create_url("/usage/check"),
                json={"metric": "invalid_metric", "amount": 1},
            )
            quota = self.fast_api_client.post(
                self.create_url("/usage/check"),
                json={"metric": "requests", "amount": 2},
            )

        assert invalid_usage.status_code == 400
        assert invalid_quota.status_code == 400

        assert usage.status_code == 200
        assert usage.json()["remaining"] == 7
        assert usage.json()["quota_limit"] == 10

        assert quota.status_code == 200
        assert quota.json()["allowed"] is True
        assert quota.json()["remaining"] == 7

    def test_cancel_subscription_error_and_success_paths(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)

        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: None,
        )

        with mock_webui_user(id="1"):
            missing_response = self.fast_api_client.post(
                self.create_url("/subscription/cancel"), json={"immediate": False}
            )

        assert missing_response.status_code == 404
        assert missing_response.json()["detail"] == "No active subscription found"

        subscription = self._subscription_model(user_id="1")
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: subscription,
        )
        monkeypatch.setattr(
            billing_router.billing_service,
            "cancel_subscription",
            lambda *_args, **_kwargs: None,
        )

        with mock_webui_user(id="1"):
            failed_response = self.fast_api_client.post(
                self.create_url("/subscription/cancel"), json={"immediate": True}
            )

        assert failed_response.status_code == 500
        assert failed_response.json()["detail"] == "Failed to cancel subscription"

        resumed = self._subscription_model(user_id="1")
        resumed.cancel_at_period_end = True
        monkeypatch.setattr(
            billing_router.billing_service,
            "cancel_subscription",
            lambda *_args, **_kwargs: resumed,
        )

        with mock_webui_user(id="1"):
            success_response = self.fast_api_client.post(
                self.create_url("/subscription/cancel"), json={"immediate": False}
            )

        assert success_response.status_code == 200
        assert success_response.json()["id"] == resumed.id
        assert success_response.json()["cancel_at_period_end"] is True
