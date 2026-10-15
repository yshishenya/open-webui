"""Content-free chat dispatch ownership and acknowledgement.

Revision ID: d1c020261009
Revises: o1a020261003
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'd1c020261009'
down_revision: str | None = 'o1a020261003'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_chat_dispatch',
        sa.Column('user_id', sa.String, sa.ForeignKey('user.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('operation_id', sa.String, primary_key=True),
        sa.Column('request_hash', sa.String, nullable=False),
        sa.Column('receipt', sa.JSON, nullable=True),
        sa.Column('created_at', sa.BigInteger, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('airis_chat_dispatch')
