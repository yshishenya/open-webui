import time

from _pytest.monkeypatch import MonkeyPatch

from open_webui.models.billing import SubscriptionModel, SubscriptionStatus
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingRouterAdditionalPaths(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def _subscription(self) -> SubscriptionModel:
        now = int(time.time())
        return SubscriptionModel(
            id="sub_additional",
            user_id="1",
            plan_id="plan_additional",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + 3600,
            cancel_at_period_end=False,
            created_at=now,
            updated_at=now,
        )

    def test_subscription_and_billing_info_error_paths(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: self._subscription(),
        )

        with mock_webui_user(id="1"):
            subscription_response = self.fast_api_client.get(self.create_url("/subscription"))

        assert subscription_response.status_code == 200
        assert subscription_response.json()["id"] == "sub_additional"

        def _raise_billing_info(*_args: object, **_kwargs: object) -> dict[str, object]:
            raise RuntimeError("billing info storage unavailable")

        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_billing_info",
            _raise_billing_info,
        )

        with mock_webui_user(id="1"):
            me_response = self.fast_api_client.get(self.create_url("/me"))
            lead_magnet_response = self.fast_api_client.get(self.create_url("/lead-magnet"))

        assert me_response.status_code == 500
        assert me_response.json()["detail"] == "Failed to get billing info"
        assert lead_magnet_response.status_code == 500
        assert lead_magnet_response.json()["detail"] == "Failed to get lead magnet info"

    def test_usage_events_validation_and_error_paths(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", False)
        with mock_webui_user(id="1"):
            disabled_response = self.fast_api_client.get(self.create_url("/usage-events"))

        assert disabled_response.status_code == 404

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", True)

        with mock_webui_user(id="1"):
            invalid_source_response = self.fast_api_client.get(
                self.create_url("/usage-events?billing_source=invalid")
            )

        assert invalid_source_response.status_code == 400
        assert invalid_source_response.json()["detail"] == "Invalid billing_source"

        def _raise_events(*_args: object, **_kwargs: object) -> list[object]:
            raise RuntimeError("usage events query failed")

        monkeypatch.setattr(
            billing_router.UsageEvents,
            "list_events_by_user",
            _raise_events,
        )

        with mock_webui_user(id="1"):
            events_error_response = self.fast_api_client.get(
                self.create_url("/usage-events?billing_source=payg")
            )

        assert events_error_response.status_code == 500
        assert events_error_response.json()["detail"] == "Failed to get usage events"

    def test_ledger_returns_404_when_wallet_disabled(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_WALLET", False)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.get(self.create_url("/ledger"))

        assert response.status_code == 404
        assert response.json()["detail"] == "Billing wallet is disabled"

    def test_public_lead_magnet_config_endpoint(self) -> None:
        response = self.fast_api_client.get(self.create_url("/public/lead-magnet"))

        assert response.status_code == 200
        payload = response.json()
        assert "enabled" in payload
        assert "cycle_days" in payload
        assert "quotas" in payload

    def test_public_rate_cards_handles_provider_fetch_failure(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        import open_webui.routers.billing as billing_router

        async def _raise_provider_fetch(_request):  # noqa: ARG001
            raise RuntimeError("provider catalog failed")

        monkeypatch.setattr(billing_router, "get_all_base_models", _raise_provider_fetch)

        response = self.fast_api_client.get(self.create_url("/public/rate-cards?currency=USD"))

        assert response.status_code == 200
        payload = response.json()
        assert payload["currency"] == "RUB"
        assert isinstance(payload["models"], list)
