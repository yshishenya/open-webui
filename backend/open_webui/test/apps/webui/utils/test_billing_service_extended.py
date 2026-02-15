import time
from types import SimpleNamespace

import pytest
from _pytest.monkeypatch import MonkeyPatch

from open_webui.models.billing import SubscriptionStatus, UsageMetric
from open_webui.utils.billing import BillingService


class TestBillingServiceExtended:
    def test_get_active_plans_delegates_to_storage(self) -> None:
        service = BillingService()
        service.plans.get_all_plans = lambda active_only=True: [active_only]  # type: ignore[assignment]

        result = service.get_active_plans()

        assert result == [True]

    def test_get_usage_for_period_delegates_to_storage(self) -> None:
        service = BillingService()
        service.usage_tracking.get_usage_for_period = (  # type: ignore[assignment]
            lambda user_id, period_start, period_end, metric: [
                user_id,
                period_start,
                period_end,
                metric,
            ]
        )

        result = service.get_usage_for_period(
            user_id="user_1",
            period_start=10,
            period_end=20,
            metric=UsageMetric.REQUESTS,
        )

        assert result == ["user_1", 10, 20, UsageMetric.REQUESTS]

    def test_create_plan_delegates_and_sets_defaults(self) -> None:
        service = BillingService()

        created_payload: dict[str, object] = {}

        def _create_plan(plan: object) -> object:
            created_payload["plan"] = plan
            return plan

        service.plans.create_plan = _create_plan  # type: ignore[assignment]

        result = service.create_plan(name="Core", price=100, interval="month")

        assert result.name == "Core"
        assert result.price == 100
        assert result.interval == "month"
        assert result.quotas == {}
        assert result.features == []
        assert created_payload["plan"].id

    def test_has_active_subscription_checks_status_and_period(self) -> None:
        service = BillingService()
        now = int(time.time())

        service.get_user_subscription = lambda *_: None  # type: ignore[method-assign]
        assert service.has_active_subscription("user_1") is False

        service.get_user_subscription = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            status=SubscriptionStatus.CANCELED,
            current_period_end=now + 60,
        )
        assert service.has_active_subscription("user_1") is False

        service.get_user_subscription = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            status=SubscriptionStatus.ACTIVE,
            current_period_end=now - 1,
        )
        assert service.has_active_subscription("user_1") is False

        service.get_user_subscription = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            status=SubscriptionStatus.TRIALING,
            current_period_end=now + 60,
        )
        assert service.has_active_subscription("user_1") is True

    def test_create_subscription_handles_intervals_and_invalid_values(self) -> None:
        service = BillingService()
        now = int(time.time())

        service.subscriptions.create_subscription = lambda sub: sub  # type: ignore[assignment]

        service.get_plan = lambda *_: None  # type: ignore[method-assign]
        with pytest.raises(ValueError, match="Plan .* not found"):
            service.create_subscription("user_1", "plan_missing")

        service.get_plan = lambda *_: SimpleNamespace(  # type: ignore[method-assign]
            interval="month",
        )
        month_sub = service.create_subscription("user_1", "plan_month")
        assert month_sub.status == SubscriptionStatus.ACTIVE
        assert month_sub.current_period_end > month_sub.current_period_start

        year_plan = SimpleNamespace(interval="year")
        service.get_plan = lambda *_: year_plan  # type: ignore[method-assign]
        year_sub = service.create_subscription("user_1", "plan_year", trial_days=3)
        assert year_sub.status == SubscriptionStatus.TRIALING
        assert year_sub.trial_end is not None

        service.get_plan = lambda *_: SimpleNamespace(interval="week")  # type: ignore[method-assign]
        with pytest.raises(ValueError, match="Invalid interval"):
            service.create_subscription("user_1", "plan_invalid")

    def test_cancel_subscription_modes(self) -> None:
        service = BillingService()

        updates: list[dict[str, object]] = []

        def _update_subscription(_sub_id: str, payload: dict[str, object]) -> object:
            updates.append(payload)
            return SimpleNamespace(id="sub_1")

        service.subscriptions.update_subscription = _update_subscription  # type: ignore[assignment]

        immediate_result = service.cancel_subscription("sub_1", immediate=True)
        assert immediate_result is not None
        assert updates[-1]["status"] == SubscriptionStatus.CANCELED
        assert isinstance(updates[-1]["current_period_end"], int)

        delayed_result = service.cancel_subscription("sub_1", immediate=False)
        assert delayed_result is not None
        assert updates[-1] == {"cancel_at_period_end": True}

    def test_get_current_period_usage_without_subscription_uses_fallback_window(self) -> None:
        service = BillingService()

        service.get_user_subscription = lambda *_: None  # type: ignore[method-assign]

        captured: dict[str, object] = {}

        def _total_usage(
            user_id: str,
            period_start: int,
            period_end: int,
            metric: UsageMetric,
        ) -> int:
            captured["user_id"] = user_id
            captured["period_start"] = period_start
            captured["period_end"] = period_end
            captured["metric"] = metric
            return 7

        service.usage_tracking.get_total_usage = _total_usage  # type: ignore[assignment]

        total = service.get_current_period_usage("user_1", UsageMetric.REQUESTS)

        assert total == 7
        assert captured["user_id"] == "user_1"
        assert captured["metric"] == UsageMetric.REQUESTS
        assert int(captured["period_end"]) - int(captured["period_start"]) == 30 * 24 * 60 * 60

    def test_track_usage_without_subscription_sets_period_to_now(self) -> None:
        service = BillingService()
        service.get_user_subscription = lambda *_: None  # type: ignore[method-assign]

        captured: dict[str, object] = {}

        def _track_usage(usage: object) -> object:
            captured["usage"] = usage
            return usage

        service.usage_tracking.track_usage = _track_usage  # type: ignore[assignment]

        created = service.track_usage(
            user_id="user_1",
            metric=UsageMetric.REQUESTS,
            amount=2,
            model_id="model_1",
            chat_id="chat_1",
            metadata={"source": "test"},
        )

        usage = captured["usage"]
        assert created is usage
        assert usage.user_id == "user_1"
        assert usage.metric == UsageMetric.REQUESTS
        assert usage.amount == 2
        assert usage.period_start == usage.period_end
        assert usage.extra_metadata == {"source": "test"}

    def test_renew_subscription_handles_missing_entities_and_valid_flow(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        service = BillingService()
        now = int(time.time())

        service.subscriptions.get_subscription_by_id = lambda *_: None  # type: ignore[assignment]
        assert service.renew_subscription("sub_1") is None

        service.subscriptions.get_subscription_by_id = lambda *_: SimpleNamespace(  # type: ignore[assignment]
            id="sub_1",
            plan_id="plan_1",
            current_period_end=now,
        )
        service.get_plan = lambda *_: None  # type: ignore[method-assign]
        assert service.renew_subscription("sub_1") is None

        service.get_plan = lambda *_: SimpleNamespace(interval="week")  # type: ignore[method-assign]
        assert service.renew_subscription("sub_1") is None

        service.get_plan = lambda *_: SimpleNamespace(interval="month")  # type: ignore[method-assign]

        updates: list[dict[str, object]] = []

        def _update_subscription(_sub_id: str, payload: dict[str, object]) -> object:
            updates.append(payload)
            return SimpleNamespace(id="sub_1", **payload)

        service.subscriptions.update_subscription = _update_subscription  # type: ignore[assignment]

        renewed = service.renew_subscription("sub_1")

        assert renewed is not None
        assert updates
        assert updates[-1]["status"] == SubscriptionStatus.ACTIVE
        assert updates[-1]["cancel_at_period_end"] is False
