"""Add input/output cost breakdown columns for usage and ledger.

Revision ID: e3b9f4d1a2c7
Revises: d5f2c8a9b1e0
Create Date: 2025-12-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "e3b9f4d1a2c7"
down_revision = "d5f2c8a9b1e0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "billing_usage_event",
        sa.Column("prompt_tokens", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("completion_tokens", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("cost_raw_input_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("cost_raw_output_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("cost_charged_input_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("cost_charged_output_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("pricing_rate_card_input_id", sa.String(), nullable=True),
    )
    op.add_column(
        "billing_usage_event",
        sa.Column("pricing_rate_card_output_id", sa.String(), nullable=True),
    )

    op.add_column(
        "billing_ledger_entry",
        sa.Column("charged_input_kopeks", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_ledger_entry",
        sa.Column("charged_output_kopeks", sa.BigInteger(), nullable=True),
    )


def downgrade():
    op.drop_column("billing_ledger_entry", "charged_output_kopeks")
    op.drop_column("billing_ledger_entry", "charged_input_kopeks")

    op.drop_column("billing_usage_event", "pricing_rate_card_output_id")
    op.drop_column("billing_usage_event", "pricing_rate_card_input_id")
    op.drop_column("billing_usage_event", "cost_charged_output_kopeks")
    op.drop_column("billing_usage_event", "cost_charged_input_kopeks")
    op.drop_column("billing_usage_event", "cost_raw_output_kopeks")
    op.drop_column("billing_usage_event", "cost_raw_input_kopeks")
    op.drop_column("billing_usage_event", "completion_tokens")
    op.drop_column("billing_usage_event", "prompt_tokens")
