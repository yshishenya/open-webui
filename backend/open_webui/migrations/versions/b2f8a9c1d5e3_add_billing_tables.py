"""Add billing tables

Revision ID: b2f8a9c1d5e3
Revises: 3e0e00844bb0
Create Date: 2025-12-10 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "b2f8a9c1d5e3"
down_revision = "3e0e00844bb0"
branch_labels = None
depends_on = None


def upgrade():
    # Create billing_plan table
    op.create_table(
        "billing_plan",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("name_ru", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("description_ru", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="RUB"),
        sa.Column("interval", sa.String(), nullable=False),
        sa.Column("quotas", sa.JSON(), nullable=True),
        sa.Column("features", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("plan_extra_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )

    # Create billing_subscription table
    op.create_table(
        "billing_subscription",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("yookassa_payment_id", sa.String(), nullable=True),
        sa.Column("yookassa_subscription_id", sa.String(), nullable=True),
        sa.Column("current_period_start", sa.BigInteger(), nullable=False),
        sa.Column("current_period_end", sa.BigInteger(), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("trial_end", sa.BigInteger(), nullable=True),
        sa.Column("extra_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )

    # Create index for subscription queries
    op.create_index(
        "idx_subscription_user_status",
        "billing_subscription",
        ["user_id", "status"]
    )

    # Create billing_usage table
    op.create_table(
        "billing_usage",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=True),
        sa.Column("metric", sa.String(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("period_start", sa.BigInteger(), nullable=False),
        sa.Column("period_end", sa.BigInteger(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=True),
        sa.Column("chat_id", sa.String(), nullable=True),
        sa.Column("extra_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )

    # Create indexes for usage analytics
    op.create_index(
        "idx_usage_user_metric",
        "billing_usage",
        ["user_id", "metric"]
    )
    op.create_index(
        "idx_usage_period",
        "billing_usage",
        ["period_start", "period_end"]
    )

    # Create billing_transaction table
    op.create_table(
        "billing_transaction",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="RUB"),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("yookassa_payment_id", sa.String(), nullable=True),
        sa.Column("yookassa_status", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("description_ru", sa.Text(), nullable=True),
        sa.Column("receipt_url", sa.Text(), nullable=True),
        sa.Column("extra_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("yookassa_payment_id"),
    )

    # Create indexes for transaction queries
    op.create_index(
        "idx_transaction_user",
        "billing_transaction",
        ["user_id"]
    )
    op.create_index(
        "idx_transaction_yookassa",
        "billing_transaction",
        ["yookassa_payment_id"]
    )

    # Create billing_audit_log table
    op.create_table(
        "billing_audit_log",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("changes", sa.JSON(), nullable=True),
        sa.Column("audit_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for audit log queries
    op.create_index(
        "idx_audit_user",
        "billing_audit_log",
        ["user_id"]
    )
    op.create_index(
        "idx_audit_entity",
        "billing_audit_log",
        ["entity_type", "entity_id"]
    )
    op.create_index(
        "idx_audit_created",
        "billing_audit_log",
        ["created_at"]
    )
    op.create_index(
        "idx_audit_action",
        "billing_audit_log",
        ["action"]
    )


def downgrade():
    # Drop indexes first
    op.drop_index("idx_audit_action", table_name="billing_audit_log")
    op.drop_index("idx_audit_created", table_name="billing_audit_log")
    op.drop_index("idx_audit_entity", table_name="billing_audit_log")
    op.drop_index("idx_audit_user", table_name="billing_audit_log")
    op.drop_index("idx_transaction_yookassa", table_name="billing_transaction")
    op.drop_index("idx_transaction_user", table_name="billing_transaction")
    op.drop_index("idx_usage_period", table_name="billing_usage")
    op.drop_index("idx_usage_user_metric", table_name="billing_usage")
    op.drop_index("idx_subscription_user_status", table_name="billing_subscription")

    # Drop tables
    op.drop_table("billing_audit_log")
    op.drop_table("billing_transaction")
    op.drop_table("billing_usage")
    op.drop_table("billing_subscription")
    op.drop_table("billing_plan")
