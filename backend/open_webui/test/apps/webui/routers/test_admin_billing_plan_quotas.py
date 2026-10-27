from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestAdminBillingPlanQuotas(AbstractPostgresTest):
    BASE_PATH = '/api/v1/admin/billing'

    def test_finite_quota_increase_preserves_existing_paid_term_and_usage(self) -> None:
        import time

        from open_webui.models.billing import (
            Plans,
            SubscriptionModel,
            Subscriptions,
            UsageModel,
            UsageTracking,
        )

        now = int(time.time())
        with mock_webui_user(id='admin-1', role='admin', email='admin@example.com'):
            created = self.fast_api_client.post(
                self.create_url('/plans'),
                json={
                    'id': 'finite-quota',
                    'name': 'Finite quota',
                    'price': 100,
                    'interval': 'month',
                    'quotas': {'requests': 100},
                },
            )
            assert created.status_code == 200, created.text
            before = Subscriptions.create_subscription(
                SubscriptionModel(
                    id='finite-subscriber',
                    user_id='finite-user',
                    plan_id='finite-quota',
                    status='active',
                    current_period_start=now - 100,
                    current_period_end=now + 100,
                    last_payment_id='paid-period-fixture',
                    created_at=now - 100,
                    updated_at=now - 100,
                )
            )
            used = UsageTracking.track_usage(
                UsageModel(
                    id='finite-used',
                    user_id=before.user_id,
                    subscription_id=before.id,
                    metric='requests',
                    amount=90,
                    period_start=before.current_period_start,
                    period_end=before.current_period_end,
                    created_at=now - 1,
                )
            )
            increased = self.fast_api_client.put(
                self.create_url('/plans/finite-quota'), json={'quotas': {'requests': 200}}
            )
        assert increased.status_code == 200, increased.text
        assert increased.json()['quotas'] == {'requests': 200}
        assert Plans.get_plan_by_id(before.plan_id).quotas == {'requests': 200}
        after = Subscriptions.get_subscription_by_id(before.id)
        assert after.model_dump() == before.model_dump()
        assert after.next_plan_id is None
        assert UsageTracking.get_usage_for_period(
            before.user_id, before.current_period_start, before.current_period_end
        ) == [used]

    def test_unlimited_and_sparse_quotas_round_trip(self) -> None:
        with mock_webui_user(id='admin-1', role='admin', email='admin@example.com'):
            created = self.fast_api_client.post(
                self.create_url('/plans'),
                json={
                    'id': 'quota-contract',
                    'name': 'Quota contract',
                    'price': 0,
                    'interval': 'month',
                    'quotas': {'tokens_input': None, 'requests': 10, 'images': 0},
                },
            )
            assert created.status_code == 200, created.text
            assert created.json()['quotas'] == {'tokens_input': None, 'requests': 10, 'images': 0}
            assert created.json()['features'] is None

            updated = self.fast_api_client.put(
                self.create_url('/plans/quota-contract'),
                json={'quotas': {'tokens_input': 100, 'requests': None, 'images': 0}},
            )
            assert updated.status_code == 200, updated.text
            loaded = self.fast_api_client.get(self.create_url('/plans/quota-contract'))
            assert loaded.status_code == 200
            assert loaded.json()['quotas'] == {'tokens_input': 100, 'requests': None, 'images': 0}

            invalid = self.fast_api_client.put(
                self.create_url('/plans/quota-contract'), json={'quotas': {'requests': 1.5}}
            )
            assert invalid.status_code == 422
            unchanged = self.fast_api_client.get(self.create_url('/plans/quota-contract'))
            assert unchanged.json()['quotas'] == loaded.json()['quotas']

            from open_webui.models.billing import SubscriptionModel, Subscriptions

            Subscriptions.create_subscription(
                SubscriptionModel(
                    id='quota-subscriber',
                    user_id='quota-user',
                    plan_id='quota-contract',
                    status='active',
                    current_period_start=1,
                    current_period_end=2,
                    created_at=1,
                    updated_at=1,
                )
            )
            decreased = self.fast_api_client.put(
                self.create_url('/plans/quota-contract'), json={'quotas': {'tokens_input': 99}}
            )
            assert decreased.status_code == 400
            assert 'Cannot decrease quota' in decreased.json()['detail']
            unlimited = self.fast_api_client.put(
                self.create_url('/plans/quota-contract'),
                json={'quotas': {'tokens_input': None, 'requests': None, 'images': 0}},
            )
            assert unlimited.status_code == 200, unlimited.text
            assert unlimited.json()['quotas']['tokens_input'] is None
            for quotas in [{'tokens_input': 100}, {'requests': 10}]:
                reduced_unlimited = self.fast_api_client.put(
                    self.create_url('/plans/quota-contract'), json={'quotas': quotas}
                )
                assert reduced_unlimited.status_code == 400
                assert 'Cannot decrease quota' in reduced_unlimited.json()['detail']
