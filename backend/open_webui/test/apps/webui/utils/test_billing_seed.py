from test.util.abstract_integration_test import AbstractPostgresTest


class TestBillingSeed(AbstractPostgresTest):
    def test_seed_rate_cards_are_inactive_by_default(self) -> None:
        from open_webui.env import BILLING_RATE_CARD_VERSION
        from open_webui.models.billing import RateCards
        from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models
        from open_webui.utils.billing_seed import seed_default_rate_cards_if_missing
        from open_webui.utils.rate_card_templates import DEFAULT_RATE_CARD_TEMPLATES

        model_id = "seed-model"

        Models.insert_new_model(
            ModelForm(
                id=model_id,
                name="Seed Model",
                base_model_id=None,
                meta=ModelMeta(),
                params=ModelParams(),
                access_control=None,
                is_active=True,
            ),
            user_id="admin",
        )

        created = seed_default_rate_cards_if_missing()
        assert created == len(DEFAULT_RATE_CARD_TEMPLATES)

        for template in DEFAULT_RATE_CARD_TEMPLATES:
            entry = RateCards.get_rate_card_by_version(
                model_id,
                str(template["modality"]),
                str(template["unit"]),
                BILLING_RATE_CARD_VERSION,
            )
            assert entry is not None
            assert entry.is_active is False
            assert entry.raw_cost_per_unit_kopeks == 0
