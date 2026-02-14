import time
from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch

from open_webui.models.billing import PlanModel
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingRouterExpandedPaths(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def _plan_model(self, plan_id: str = "plan_core") -> PlanModel:
        now = int(time.time())
        return PlanModel(
            id=plan_id,
            name="Core",
            price=100,
            currency="RUB",
            interval="month",
            quotas={"requests": 10},
            features=["priority"],
            is_active=True,
            display_order=1,
            created_at=now,
            updated_at=now,
        )

    def test_admin_plan_routes_success_and_error_paths(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        plan = self._plan_model()

        monkeypatch.setattr(billing_router.billing_service, "get_active_plans", lambda: [plan])
        with mock_webui_user(id="1", role="admin"):
            plans_response = self.fast_api_client.get(self.create_url("/plans"))

        assert plans_response.status_code == 200
        assert plans_response.json()[0]["id"] == plan.id

        def _raise_plans_error() -> list[object]:
            raise RuntimeError("plans db unavailable")

        monkeypatch.setattr(billing_router.billing_service, "get_active_plans", _raise_plans_error)
        with mock_webui_user(id="1", role="admin"):
            plans_error_response = self.fast_api_client.get(self.create_url("/plans"))

        assert plans_error_response.status_code == 500
        assert plans_error_response.json()["detail"] == "Failed to get plans"

        monkeypatch.setattr(
            billing_router.billing_service,
            "get_plan",
            lambda plan_id: plan if plan_id == plan.id else None,
        )
        with mock_webui_user(id="1"):
            get_plan_response = self.fast_api_client.get(self.create_url(f"/plans/{plan.id}"))
            missing_plan_response = self.fast_api_client.get(
                self.create_url("/plans/unknown")
            )

        assert get_plan_response.status_code == 200
        assert get_plan_response.json()["id"] == plan.id
        assert missing_plan_response.status_code == 404
        assert missing_plan_response.json()["detail"] == "Plan not found"

        monkeypatch.setattr(
            billing_router.billing_service,
            "create_plan",
            lambda **_: plan,
        )
        with mock_webui_user(id="1", role="admin"):
            create_response = self.fast_api_client.post(
                self.create_url("/plans"),
                json={
                    "name": "Core",
                    "price": 100,
                    "currency": "RUB",
                    "interval": "month",
                    "features": ["priority"],
                    "quotas": {"requests": 10},
                    "is_active": True,
                    "display_order": 1,
                },
            )

        assert create_response.status_code == 200
        assert create_response.json()["id"] == plan.id

        def _raise_create_error(**_: object) -> PlanModel:
            raise RuntimeError("create plan failed")

        monkeypatch.setattr(billing_router.billing_service, "create_plan", _raise_create_error)
        with mock_webui_user(id="1", role="admin"):
            create_error_response = self.fast_api_client.post(
                self.create_url("/plans"),
                json={
                    "name": "Core",
                    "price": 100,
                    "currency": "RUB",
                    "interval": "month",
                },
            )

        assert create_error_response.status_code == 500
        assert create_error_response.json()["detail"] == "Failed to create plan"

    def test_ledger_and_transactions_routes_error_mapping(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)
        monkeypatch.setattr(billing_router.LedgerEntries, "get_entries_by_user", lambda *_args, **_kwargs: [])
        monkeypatch.setattr(
            billing_router.billing_service.transactions,
            "get_transactions_by_user",
            lambda *_args, **_kwargs: [],
        )

        with mock_webui_user(id="1"):
            ledger_ok = self.fast_api_client.get(self.create_url("/ledger"))
            transactions_ok = self.fast_api_client.get(self.create_url("/transactions"))

        assert ledger_ok.status_code == 200
        assert ledger_ok.json() == []
        assert transactions_ok.status_code == 200
        assert transactions_ok.json() == []

        def _raise_ledger(*_args: object, **_kwargs: object) -> list[object]:
            raise RuntimeError("ledger unavailable")

        def _raise_transactions(*_args: object, **_kwargs: object) -> list[object]:
            raise RuntimeError("transactions unavailable")

        monkeypatch.setattr(billing_router.LedgerEntries, "get_entries_by_user", _raise_ledger)
        monkeypatch.setattr(
            billing_router.billing_service.transactions,
            "get_transactions_by_user",
            _raise_transactions,
        )

        with mock_webui_user(id="1"):
            ledger_fail = self.fast_api_client.get(self.create_url("/ledger"))
            transactions_fail = self.fast_api_client.get(self.create_url("/transactions"))

        assert ledger_fail.status_code == 500
        assert ledger_fail.json()["detail"] == "Failed to get ledger"
        assert transactions_fail.status_code == 500
        assert transactions_fail.json()["detail"] == "Failed to get transactions"

    def test_usage_routes_map_internal_errors_to_500(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(
            billing_router.billing_service,
            "check_quota",
            lambda *_args, **_kwargs: True,
        )

        def _raise_usage(*_args: object, **_kwargs: object) -> int:
            raise RuntimeError("usage storage unavailable")

        monkeypatch.setattr(
            billing_router.billing_service,
            "get_current_period_usage",
            _raise_usage,
        )

        with mock_webui_user(id="1"):
            usage_response = self.fast_api_client.get(self.create_url("/usage/requests"))
            quota_response = self.fast_api_client.post(
                self.create_url("/usage/check"),
                json={"metric": "requests", "amount": 1},
            )

        assert usage_response.status_code == 500
        assert usage_response.json()["detail"] == "Failed to get usage"
        assert quota_response.status_code == 500
        assert quota_response.json()["detail"] == "Failed to check quota"

    def test_subscription_routes_require_feature_flag(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", False)

        with mock_webui_user(id="1"):
            plans_response = self.fast_api_client.get(self.create_url("/plans"))
            plan_response = self.fast_api_client.get(self.create_url("/plans/plan_core"))
            create_response = self.fast_api_client.post(
                self.create_url("/plans"),
                json={"name": "Core", "price": 100, "currency": "RUB", "interval": "month"},
            )
            subscription_response = self.fast_api_client.get(self.create_url("/subscription"))

        assert plans_response.status_code == 404
        assert plan_response.status_code == 404
        assert create_response.status_code == 404
        assert subscription_response.status_code == 404
