import time

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestBillingSubscription(AbstractPostgresTest):
    BASE_PATH = "/api/v1/billing"

    def setup_method(self):
        super().setup_method()
        from open_webui.models.billing import PlanModel, Plans

        now = int(time.time())
        self.free_plan_id = "plan_free"
        self.paid_plan_id = "plan_paid"

        Plans.create_plan(
            PlanModel(
                id=self.free_plan_id,
                name="Free",
                price=0,
                currency="RUB",
                interval="month",
                quotas={},
                features=[],
                is_active=True,
                display_order=0,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )
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

    def test_resume_subscription(self):
        from open_webui.models.billing import SubscriptionModel, Subscriptions, SubscriptionStatus

        now = int(time.time())
        subscription = SubscriptionModel(
            id="sub_resume",
            user_id="1",
            plan_id=self.free_plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + (30 * 24 * 60 * 60),
            cancel_at_period_end=True,
            created_at=now,
            updated_at=now,
        )
        Subscriptions.create_subscription(subscription)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(self.create_url("/subscription/resume"))

        assert response.status_code == 200
        assert response.json()["cancel_at_period_end"] is False

    def test_activate_free_plan_updates_canceled_subscription(self):
        from open_webui.models.billing import SubscriptionModel, Subscriptions, SubscriptionStatus

        now = int(time.time())
        subscription = SubscriptionModel(
            id="sub_canceled",
            user_id="1",
            plan_id=self.paid_plan_id,
            status=SubscriptionStatus.CANCELED.value,
            current_period_start=now - (60 * 24 * 60 * 60),
            current_period_end=now - (30 * 24 * 60 * 60),
            cancel_at_period_end=False,
            created_at=now - (60 * 24 * 60 * 60),
            updated_at=now - (60 * 24 * 60 * 60),
        )
        Subscriptions.create_subscription(subscription)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/subscription/free"), json={"plan_id": self.free_plan_id}
            )

        assert response.status_code == 200
        assert response.json()["plan_id"] == self.free_plan_id
        assert response.json()["status"] == SubscriptionStatus.ACTIVE.value
        assert response.json()["cancel_at_period_end"] is False

    def test_activate_free_plan_blocks_active_paid_subscription(self):
        from open_webui.models.billing import SubscriptionModel, Subscriptions, SubscriptionStatus

        now = int(time.time())
        subscription = SubscriptionModel(
            id="sub_active_paid",
            user_id="1",
            plan_id=self.paid_plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + (30 * 24 * 60 * 60),
            cancel_at_period_end=False,
            created_at=now,
            updated_at=now,
        )
        Subscriptions.create_subscription(subscription)

        with mock_webui_user(id="1"):
            response = self.fast_api_client.post(
                self.create_url("/subscription/free"), json={"plan_id": self.free_plan_id}
            )

        assert response.status_code == 400
