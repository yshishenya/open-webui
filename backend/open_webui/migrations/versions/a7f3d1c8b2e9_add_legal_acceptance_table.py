"""Add legal acceptance log + privacy acceptance timestamp.

Revision ID: a7f3d1c8b2e9
Revises: f4d2c9e8a1b0
Create Date: 2026-02-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a7f3d1c8b2e9"
down_revision = "f4d2c9e8a1b0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "legal_document_acceptance",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("doc_key", sa.String(), nullable=False),
        sa.Column("doc_version", sa.String(), nullable=False),
        sa.Column("accepted_at", sa.BigInteger(), nullable=False),
        sa.Column("ip", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("method", sa.String(), nullable=True),
    )

    op.create_index(
        "ix_legal_document_acceptance_user_id",
        "legal_document_acceptance",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_legal_document_acceptance_doc_key",
        "legal_document_acceptance",
        ["doc_key"],
        unique=False,
    )
    op.create_index(
        "ix_legal_document_acceptance_accepted_at",
        "legal_document_acceptance",
        ["accepted_at"],
        unique=False,
    )
    op.create_index(
        "ix_legal_document_acceptance_user_doc_time",
        "legal_document_acceptance",
        ["user_id", "doc_key", "accepted_at"],
        unique=False,
    )

    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.add_column(sa.Column("privacy_accepted_at", sa.BigInteger(), nullable=True))


def downgrade():
    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.drop_column("privacy_accepted_at")

    op.drop_index("ix_legal_document_acceptance_user_doc_time", table_name="legal_document_acceptance")
    op.drop_index("ix_legal_document_acceptance_accepted_at", table_name="legal_document_acceptance")
    op.drop_index("ix_legal_document_acceptance_doc_key", table_name="legal_document_acceptance")
    op.drop_index("ix_legal_document_acceptance_user_id", table_name="legal_document_acceptance")
    op.drop_table("legal_document_acceptance")

