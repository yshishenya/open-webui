"""Harden billing integrity and reservation state.

Revision ID: b4c5d6e7f8a9
Revises: a91c0d8e4f62
Create Date: 2026-08-06
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: str | None = "a91c0d8e4f62"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    ledger_idempotency_metadata = next(
        (
            constraint
            for constraint in sa.inspect(bind).get_unique_constraints("billing_ledger_entry")
            if constraint.get("column_names") == ["idempotency_key"]
        ),
        None,
    )
    ledger_batch_kwargs = {}
    if bind.dialect.name == "sqlite":
        ledger_batch_kwargs["naming_convention"] = {"uq": "uq_%(table_name)s_%(column_0_name)s"}
        ledger_idempotency_constraint = (ledger_idempotency_metadata or {}).get("name") or (
            "uq_billing_ledger_entry_idempotency_key"
        )
    else:
        if not ledger_idempotency_metadata or not ledger_idempotency_metadata.get("name"):
            raise RuntimeError("billing_ledger_entry idempotency constraint is missing")
        ledger_idempotency_constraint = ledger_idempotency_metadata["name"]

    with op.batch_alter_table("billing_wallet") as batch_op:
        batch_op.add_column(sa.Column("topup_expires_at", sa.BigInteger(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "daily_reserved_kopeks",
                sa.BigInteger(),
                nullable=False,
                server_default="0",
            )
        )

    with op.batch_alter_table("billing_usage_event") as batch_op:
        batch_op.add_column(sa.Column("correlation_id", sa.String(), nullable=True))
        batch_op.drop_constraint("uq_usage_request_modality", type_="unique")
        batch_op.create_unique_constraint(
            "uq_usage_wallet_request_modality",
            ["wallet_id", "request_id", "modality"],
        )
        batch_op.create_index(
            "ix_billing_usage_event_correlation_id",
            ["correlation_id"],
            unique=False,
        )

    with op.batch_alter_table("billing_ledger_entry", **ledger_batch_kwargs) as batch_op:
        batch_op.add_column(sa.Column("correlation_id", sa.String(), nullable=True))
        batch_op.drop_constraint("uq_ledger_reference", type_="unique")
        batch_op.drop_constraint(
            ledger_idempotency_constraint,
            type_="unique",
        )
        batch_op.create_unique_constraint(
            "uq_ledger_wallet_reference",
            ["wallet_id", "reference_type", "reference_id", "type"],
        )
        batch_op.create_unique_constraint(
            "uq_ledger_wallet_idempotency",
            ["wallet_id", "idempotency_key"],
        )
        batch_op.create_index(
            "ix_billing_ledger_entry_correlation_id",
            ["correlation_id"],
            unique=False,
        )

    with op.batch_alter_table("billing_payment") as batch_op:
        batch_op.add_column(sa.Column("auto_topup_claim_key", sa.String(), nullable=True))
        batch_op.create_unique_constraint(
            "uq_billing_payment_auto_topup_claim_key",
            ["auto_topup_claim_key"],
        )

    op.create_table(
        "billing_quota_reservation",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("operation_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("wallet_id", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=True),
        sa.Column("requirements_json", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("operation_id"),
    )
    op.create_index(
        "idx_quota_reservation_expiry",
        "billing_quota_reservation",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_billing_quota_reservation_user_id",
        "billing_quota_reservation",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_billing_quota_reservation_wallet_id",
        "billing_quota_reservation",
        ["wallet_id"],
        unique=False,
    )

    wallet = sa.table(
        "billing_wallet",
        sa.column("id", sa.String()),
        sa.column("topup_expires_at", sa.BigInteger()),
    )
    ledger = sa.table(
        "billing_ledger_entry",
        sa.column("wallet_id", sa.String()),
        sa.column("type", sa.String()),
        sa.column("expires_at", sa.BigInteger()),
    )
    latest_topup_expiry = (
        sa.select(sa.func.max(ledger.c.expires_at))
        .where(
            ledger.c.wallet_id == wallet.c.id,
            ledger.c.type == "topup",
        )
        .scalar_subquery()
    )
    permanent_topup_exists = sa.exists(
        sa.select(sa.literal(1)).where(
            ledger.c.wallet_id == wallet.c.id,
            ledger.c.type == "topup",
            ledger.c.expires_at.is_(None),
        )
    )
    op.get_bind().execute(
        sa.update(wallet).values(
            topup_expires_at=sa.case(
                (permanent_topup_exists, None),
                else_=latest_topup_expiry,
            )
        )
    )

    usage_event = sa.table(
        "billing_usage_event",
        sa.column("request_id", sa.String()),
        sa.column("correlation_id", sa.String()),
    )
    op.get_bind().execute(sa.update(usage_event).values(correlation_id=usage_event.c.request_id))


def downgrade() -> None:
    op.drop_index(
        "ix_billing_quota_reservation_wallet_id",
        table_name="billing_quota_reservation",
    )
    op.drop_index(
        "ix_billing_quota_reservation_user_id",
        table_name="billing_quota_reservation",
    )
    op.drop_index(
        "idx_quota_reservation_expiry",
        table_name="billing_quota_reservation",
    )
    op.drop_table("billing_quota_reservation")

    with op.batch_alter_table("billing_payment") as batch_op:
        batch_op.drop_constraint(
            "uq_billing_payment_auto_topup_claim_key",
            type_="unique",
        )
        batch_op.drop_column("auto_topup_claim_key")

    with op.batch_alter_table("billing_ledger_entry") as batch_op:
        batch_op.drop_index("ix_billing_ledger_entry_correlation_id")
        batch_op.drop_constraint(
            "uq_ledger_wallet_idempotency",
            type_="unique",
        )
        batch_op.drop_constraint("uq_ledger_wallet_reference", type_="unique")
        batch_op.create_unique_constraint(
            "uq_ledger_idempotency_key",
            ["idempotency_key"],
        )
        batch_op.create_unique_constraint(
            "uq_ledger_reference",
            ["reference_type", "reference_id", "type"],
        )
        batch_op.drop_column("correlation_id")

    with op.batch_alter_table("billing_usage_event") as batch_op:
        batch_op.drop_index("ix_billing_usage_event_correlation_id")
        batch_op.drop_constraint(
            "uq_usage_wallet_request_modality",
            type_="unique",
        )
        batch_op.create_unique_constraint(
            "uq_usage_request_modality",
            ["request_id", "modality"],
        )
        batch_op.drop_column("correlation_id")

    with op.batch_alter_table("billing_wallet") as batch_op:
        batch_op.drop_column("daily_reserved_kopeks")
        batch_op.drop_column("topup_expires_at")
