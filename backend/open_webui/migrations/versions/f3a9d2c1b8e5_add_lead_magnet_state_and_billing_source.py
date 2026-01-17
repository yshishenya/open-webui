"""Add lead magnet state table and billing source column.

Revision ID: f3a9d2c1b8e5
Revises: e3b9f4d1a2c7
Create Date: 2025-12-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "f3a9d2c1b8e5"
down_revision = "e3b9f4d1a2c7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "billing_usage_event",
        sa.Column(
            "billing_source",
            sa.String(),
            nullable=False,
            server_default="payg",
        ),
    )

    op.create_table(
        "billing_lead_magnet_state",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("cycle_start", sa.BigInteger(), nullable=False),
        sa.Column("cycle_end", sa.BigInteger(), nullable=False),
        sa.Column(
            "tokens_input_used",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "tokens_output_used",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("images_used", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "tts_seconds_used",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "stt_seconds_used",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "config_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_lead_magnet_user"),
    )
    op.create_index(
        "idx_lead_magnet_user",
        "billing_lead_magnet_state",
        ["user_id"],
    )


def downgrade():
    op.drop_index("idx_lead_magnet_user", table_name="billing_lead_magnet_state")
    op.drop_table("billing_lead_magnet_state")
    op.drop_column("billing_usage_event", "billing_source")
