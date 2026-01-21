"""Remove rate card factors and rounding rules.

Revision ID: ab12cd34ef56
Revises: f3a9d2c1b8e5
Create Date: 2026-01-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "ab12cd34ef56"
down_revision = "f3a9d2c1b8e5"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("billing_pricing_rate_card", "rounding_rules_json")
    op.drop_column("billing_pricing_rate_card", "min_charge_kopeks")
    op.drop_column("billing_pricing_rate_card", "fixed_fee_kopeks")
    op.drop_column("billing_pricing_rate_card", "platform_factor")


def downgrade():
    op.add_column(
        "billing_pricing_rate_card",
        sa.Column(
            "platform_factor",
            sa.Numeric(10, 4),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "billing_pricing_rate_card",
        sa.Column(
            "fixed_fee_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "billing_pricing_rate_card",
        sa.Column(
            "min_charge_kopeks",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "billing_pricing_rate_card",
        sa.Column("rounding_rules_json", sa.JSON(), nullable=True),
    )
