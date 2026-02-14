import time
from types import SimpleNamespace

from _pytest.monkeypatch import MonkeyPatch

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingSubscription(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def setup_method(self):
        super().setup_method()
        from open_webui.models.billing import PlanModel, Plans

        now = int(time.time())
        self.paid_plan_id = "plan_paid"

        Plans.create_plan(
            PlanModel(
                id=self.paid_plan_id,
                name="Pro",
                price=100,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=1,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

    def _subscription_payload(self, cancel_at_period_end: bool = True) -> SimpleNamespace:
        now = int(time.time())
        return SimpleNamespace(
            id="sub_resume",
            user_id="1",
            plan_id=self.paid_plan_id,
            status="active",
            current_period_start=now,
            current_period_end=now + (30 * 24 * 60 * 60),
            cancel_at_period_end=cancel_at_period_end,
            created_at=now,
            updated_at=now,
        )

    def test_resume_subscription_success(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        subscription = self._subscription_payload(cancel_at_period_end=True)

        def _get_subscription(_user_id: str) -> SimpleNamespace:
            return subscription

        def _resume_subscription(_subscription_id: str) -> SimpleNamespace:
            payload = subscription.__dict__.copy()
            payload["cancel_at_period_end"] = False
            return SimpleNamespace(**payload)

        monkeypatch.setattr(billing_router.billing_service, "get_user_subscription", _get_subscription)
        monkeypatch.setattr(billing_router.billing_service, "resume_subscription", _resume_subscription)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 200
        assert response.json()["cancel_at_period_end"] is False

    def test_resume_subscription_disabled(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", False)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 404
        assert response.json()["detail"] == "Billing subscriptions are disabled"

    def test_resume_subscription_not_found(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        monkeypatch.setattr(billing_router.billing_service, "get_user_subscription", lambda *_: None)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 404
        assert response.json()["detail"] == "No active subscription found"

    def test_resume_subscription_not_scheduled(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: self._subscription_payload(cancel_at_period_end=False),
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 400
        assert response.json()["detail"] == "Subscription is not scheduled for cancellation"

    def test_resume_subscription_already_ended(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        now = int(time.time())
        subscription = self._subscription_payload(cancel_at_period_end=True)
        subscription.current_period_end = now - 10
        monkeypatch.setattr(billing_router.billing_service, "get_user_subscription", lambda *_: subscription)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 400
        assert response.json()["detail"] == "Subscription already ended"

    def test_resume_subscription_update_failed(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.billing as billing_router

        monkeypatch.setattr(billing_router, "ENABLE_BILLING_SUBSCRIPTIONS", True)
        monkeypatch.setattr(
            billing_router.billing_service,
            "get_user_subscription",
            lambda *_: self._subscription_payload(cancel_at_period_end=True),
        )
        monkeypatch.setattr(
            billing_router.billing_service,
            "resume_subscription",
            lambda *_args: None,
        )

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to resume subscription"
