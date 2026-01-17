"""Add wallet, ledger, pricing tables and extend billing plans/subscriptions

Revision ID: c9d7e2a1b4f0
Revises: b2f8a9c1d5e3
Create Date: 2025-12-12 12:00:00.000000

"""

import time
import uuid

from alembic import op
import sqlalchemy as sa

revision = "c9d7e2a1b4f0"
down_revision = "b2f8a9c1d5e3"
branch_labels = None
depends_on = None


def upgrade():
    # Extend billing_plan
    op.add_column(
        "billing_plan",
        sa.Column("price_kopeks", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.add_column(
        "billing_plan",
        sa.Column(
            "included_kopeks_per_period",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "billing_plan",
        sa.Column(
            "discount_percent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "billing_plan",
        sa.Column("model_tiers_allowed", sa.JSON(), nullable=True),
    )
    op.add_column(
        "billing_plan",
        sa.Column("images_per_period", sa.Integer(), nullable=True),
    )
    op.add_column(
        "billing_plan",
        sa.Column("tts_seconds_per_period", sa.Integer(), nullable=True),
    )
    op.add_column(
        "billing_plan",
        sa.Column("max_reply_cost_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_plan",
        sa.Column("daily_cap_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_plan",
        sa.Column("is_annual", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Extend billing_subscription
    op.add_column(
        "billing_subscription",
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "billing_subscription",
        sa.Column("last_payment_id", sa.String(), nullable=True),
    )
    op.add_column(
        "billing_subscription",
        sa.Column("wallet_id", sa.String(), nullable=True),
    )
    op.add_column(
        "billing_subscription",
        sa.Column("payment_method_id", sa.String(), nullable=True),
    )
    op.add_column(
        "billing_subscription",
        sa.Column("next_plan_id", sa.String(), nullable=True),
    )

    # Create billing_wallet table
    op.create_table(
        "billing_wallet",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column(
            "currency", sa.String(), nullable=False, server_default="RUB"
        ),
        sa.Column(
            "balance_topup_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "balance_included_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("included_expires_at", sa.BigInteger(), nullable=True),
        sa.Column("max_reply_cost_kopeks", sa.BigInteger(), nullable=True),
        sa.Column("daily_cap_kopeks", sa.BigInteger(), nullable=True),
        sa.Column(
            "daily_spent_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("daily_reset_at", sa.BigInteger(), nullable=True),
        sa.Column(
            "auto_topup_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("auto_topup_threshold_kopeks", sa.BigInteger(), nullable=True),
        sa.Column("auto_topup_amount_kopeks", sa.BigInteger(), nullable=True),
        sa.Column(
            "auto_topup_fail_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("auto_topup_last_failed_at", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("user_id", "currency", name="uq_wallet_user_currency"),
    )
    op.create_index("idx_wallet_user", "billing_wallet", ["user_id"])

    # Create billing_pricing_rate_card table
    op.create_table(
        "billing_pricing_rate_card",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=False),
        sa.Column("model_tier", sa.String(), nullable=True),
        sa.Column("modality", sa.String(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column(
            "raw_cost_per_unit_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "platform_factor",
            sa.Numeric(10, 4),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "fixed_fee_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "min_charge_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("rounding_rules_json", sa.JSON(), nullable=True),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("effective_from", sa.BigInteger(), nullable=False),
        sa.Column("effective_to", sa.BigInteger(), nullable=True),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint(
            "model_id",
            "modality",
            "unit",
            "version",
            "effective_from",
            name="uq_rate_card_version",
        ),
    )
    op.create_index("idx_rate_card_active", "billing_pricing_rate_card", ["is_active", "effective_from"])
    op.create_index("idx_rate_card_model", "billing_pricing_rate_card", ["model_id"])

    # Create billing_usage_event table
    op.create_table(
        "billing_usage_event",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("wallet_id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=True),
        sa.Column("subscription_id", sa.String(), nullable=True),
        sa.Column("chat_id", sa.String(), nullable=True),
        sa.Column("message_id", sa.String(), nullable=True),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=False),
        sa.Column("modality", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("measured_units_json", sa.JSON(), nullable=True),
        sa.Column(
            "cost_raw_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "cost_charged_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "is_estimated", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("estimate_reason", sa.Text(), nullable=True),
        sa.Column("pricing_version", sa.String(), nullable=True),
        sa.Column("pricing_rate_card_id", sa.String(), nullable=True),
        sa.Column("wallet_snapshot_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint(
            "request_id", "modality", name="uq_usage_request_modality"
        ),
    )
    op.create_index(
        "idx_usage_event_user_time", "billing_usage_event", ["user_id", "created_at"]
    )

    # Create billing_ledger_entry table
    op.create_table(
        "billing_ledger_entry",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("wallet_id", sa.String(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("amount_kopeks", sa.BigInteger(), nullable=False),
        sa.Column("balance_included_after", sa.BigInteger(), nullable=False),
        sa.Column("balance_topup_after", sa.BigInteger(), nullable=False),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("reference_type", sa.String(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=True, unique=True),
        sa.Column("hold_expires_at", sa.BigInteger(), nullable=True),
        sa.Column("expires_at", sa.BigInteger(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint(
            "reference_type",
            "reference_id",
            "type",
            name="uq_ledger_reference",
        ),
    )
    op.create_index(
        "idx_ledger_user_time", "billing_ledger_entry", ["user_id", "created_at"]
    )
    op.create_index(
        "idx_ledger_wallet_type", "billing_ledger_entry", ["wallet_id", "type"]
    )

    # Create billing_payment table
    op.create_table(
        "billing_payment",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("amount_kopeks", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("idempotency_key", sa.String(), nullable=True, unique=True),
        sa.Column("provider_payment_id", sa.String(), nullable=True, unique=True),
        sa.Column("payment_method_id", sa.String(), nullable=True),
        sa.Column("status_details", sa.JSON(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("raw_payload_json", sa.JSON(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("wallet_id", sa.String(), nullable=True),
        sa.Column("subscription_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(
        "idx_payment_user_time", "billing_payment", ["user_id", "created_at"]
    )
    op.create_index(
        "idx_payment_status_time", "billing_payment", ["status", "created_at"]
    )

    # Create billing_promo_code table
    op.create_table(
        "billing_promo_code",
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("bonus_kopeks", sa.BigInteger(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=True),
        sa.Column("usage_limit", sa.Integer(), nullable=True),
        sa.Column("per_user_limit", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("code"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("idx_promo_expires", "billing_promo_code", ["expires_at"])

    # Backfill price_kopeks from price
    op.execute(sa.text("UPDATE billing_plan SET price_kopeks = CAST(price * 100 AS BIGINT)"))

    # Create wallets for existing users
    now = int(time.time())
    connection = op.get_bind()
    users = connection.execute(sa.text('SELECT id FROM "user"')).fetchall()
    for row in users:
        connection.execute(
            sa.text(
                """
                INSERT INTO billing_wallet (id, user_id, currency, created_at, updated_at)
                VALUES (:id, :user_id, :currency, :created_at, :updated_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": row[0],
                "currency": "RUB",
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade():
    op.drop_index("idx_promo_expires", table_name="billing_promo_code")
    op.drop_table("billing_promo_code")

    op.drop_index("idx_payment_status_time", table_name="billing_payment")
    op.drop_index("idx_payment_user_time", table_name="billing_payment")
    op.drop_table("billing_payment")

    op.drop_index("idx_ledger_wallet_type", table_name="billing_ledger_entry")
    op.drop_index("idx_ledger_user_time", table_name="billing_ledger_entry")
    op.drop_table("billing_ledger_entry")

    op.drop_index("idx_usage_event_user_time", table_name="billing_usage_event")
    op.drop_table("billing_usage_event")

    op.drop_index("idx_rate_card_model", table_name="billing_pricing_rate_card")
    op.drop_index("idx_rate_card_active", table_name="billing_pricing_rate_card")
    op.drop_table("billing_pricing_rate_card")

    op.drop_index("idx_wallet_user", table_name="billing_wallet")
    op.drop_table("billing_wallet")

    op.drop_column("billing_subscription", "next_plan_id")
    op.drop_column("billing_subscription", "payment_method_id")
    op.drop_column("billing_subscription", "wallet_id")
    op.drop_column("billing_subscription", "last_payment_id")
    op.drop_column("billing_subscription", "auto_renew")

    op.drop_column("billing_plan", "is_annual")
    op.drop_column("billing_plan", "daily_cap_kopeks")
    op.drop_column("billing_plan", "max_reply_cost_kopeks")
    op.drop_column("billing_plan", "tts_seconds_per_period")
    op.drop_column("billing_plan", "images_per_period")
    op.drop_column("billing_plan", "model_tiers_allowed")
    op.drop_column("billing_plan", "discount_percent")
    op.drop_column("billing_plan", "included_kopeks_per_period")
    op.drop_column("billing_plan", "price_kopeks")
