import time

import pytest

from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingQuota(AbstractPostgresTest):
    def setup_method(self) -> None:
        super().setup_method()

        from open_webui.models.billing import PlanModel, Plans

        now = int(time.time())
        self.plan_id = "plan_quota"

        Plans.create_plan(
            PlanModel(
                id=self.plan_id,
                name="Quota Plan",
                price=0,
                currency="RUB",
                interval="month",
                quotas={"requests": 1},
                features=[],
                is_active=True,
                display_order=0,
                created_at=now,
                updated_at=now,
            ).model_dump()
        )

    def test_check_quota_uses_metric_value(self) -> None:
        from open_webui.models.billing import (
            SubscriptionModel,
            Subscriptions,
            SubscriptionStatus,
            UsageMetric,
        )
        from open_webui.utils.billing import BillingService, QuotaExceededError

        now = int(time.time())
        subscription = SubscriptionModel(
            id="sub_quota_1",
            user_id="user_1",
            plan_id=self.plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now - 60,
            current_period_end=now + 3600,
            cancel_at_period_end=False,
            created_at=now,
            updated_at=now,
        )
        Subscriptions.create_subscription(subscription)

        billing_service = BillingService()
        billing_service.track_usage("user_1", UsageMetric.REQUESTS, 1)

        assert (
            billing_service.check_quota("user_1", UsageMetric.REQUESTS, 1) is False
        )
        with pytest.raises(QuotaExceededError):
            billing_service.enforce_quota("user_1", UsageMetric.REQUESTS, 1)

