"""Remove effective_from/effective_to from rate cards.

Revision ID: f4d2c9e8a1b0
Revises: e0f6b1c2d3e4
Create Date: 2026-01-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "f4d2c9e8a1b0"
down_revision = "e0f6b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("billing_pricing_rate_card", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_at",
                sa.BigInteger(),
                nullable=True,
            )
        )
        bind = op.get_bind()
        if bind.dialect.name == "postgresql":
            batch_op.execute(
                "UPDATE billing_pricing_rate_card "
                "SET created_at = COALESCE(effective_from, CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT))"
            )
        else:
            batch_op.execute(
                "UPDATE billing_pricing_rate_card "
                "SET created_at = COALESCE(effective_from, strftime('%s','now'))"
            )
        batch_op.alter_column("created_at", nullable=False)
        batch_op.drop_constraint("uq_rate_card_version", type_="unique")
        batch_op.drop_index("idx_rate_card_active")
        batch_op.drop_index("idx_rate_card_model")
        batch_op.drop_column("effective_to")
        batch_op.drop_column("effective_from")
        batch_op.create_unique_constraint(
            "uq_rate_card_version",
            ["model_id", "modality", "unit", "version", "created_at"],
        )
        batch_op.create_index(
            "idx_rate_card_active", ["is_active", "created_at"], unique=False
        )
        batch_op.create_index("idx_rate_card_model", ["model_id"], unique=False)


def downgrade():
    with op.batch_alter_table("billing_pricing_rate_card", schema=None) as batch_op:
        batch_op.drop_index("idx_rate_card_active")
        batch_op.drop_index("idx_rate_card_model")
        batch_op.drop_constraint("uq_rate_card_version", type_="unique")
        batch_op.add_column(sa.Column("effective_from", sa.BigInteger(), nullable=False))
        batch_op.add_column(sa.Column("effective_to", sa.BigInteger(), nullable=True))
        batch_op.execute(
            "UPDATE billing_pricing_rate_card "
            "SET effective_from = created_at"
        )
        batch_op.create_unique_constraint(
            "uq_rate_card_version",
            ["model_id", "modality", "unit", "version", "effective_from"],
        )
        batch_op.create_index(
            "idx_rate_card_active", ["is_active", "effective_from"], unique=False
        )
        batch_op.create_index("idx_rate_card_model", ["model_id"], unique=False)
        batch_op.drop_column("created_at")
