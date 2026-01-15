"""Add email verification and password reset tokens

Revision ID: c7d4e8f9a2b1
Revises: b2f8a9c1d5e3
Create Date: 2024-12-17 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "c7d4e8f9a2b1"
down_revision = "b2f8a9c1d5e3"
branch_labels = None
depends_on = None


def upgrade():
    # Create email_verification_token table
    op.create_table(
        "email_verification_token",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("token"),
    )

    # Create indexes for email verification token lookups
    op.create_index(
        "idx_email_verification_token",
        "email_verification_token",
        ["token"]
    )
    op.create_index(
        "idx_email_verification_user_id",
        "email_verification_token",
        ["user_id"]
    )

    # Create password_reset_token table
    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("token"),
    )

    # Create indexes for password reset token lookups
    op.create_index(
        "idx_password_reset_token",
        "password_reset_token",
        ["token"]
    )
    op.create_index(
        "idx_password_reset_user_id",
        "password_reset_token",
        ["user_id"]
    )

    # Add email_verified column to user table
    op.add_column("user", sa.Column("email_verified", sa.Boolean(), nullable=True, server_default=sa.false()))

    # Add terms_accepted_at column to user table
    op.add_column("user", sa.Column("terms_accepted_at", sa.BigInteger(), nullable=True))


def downgrade():
    # Drop indexes first
    op.drop_index("idx_password_reset_user_id", table_name="password_reset_token")
    op.drop_index("idx_password_reset_token", table_name="password_reset_token")
    op.drop_index("idx_email_verification_user_id", table_name="email_verification_token")
    op.drop_index("idx_email_verification_token", table_name="email_verification_token")

    # Drop columns from user table
    op.drop_column("user", "terms_accepted_at")
    op.drop_column("user", "email_verified")

    # Drop tables
    op.drop_table("password_reset_token")
    op.drop_table("email_verification_token")
