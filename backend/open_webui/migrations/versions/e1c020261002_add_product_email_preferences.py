"""Explicit product email consent and unsubscribe links.

Revision ID: e1c020261002
Revises: a10f20261001
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'e1c020261002'
down_revision: str | None = 'a10f20261001'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_email_preference',
        sa.Column('user_id', sa.String(), primary_key=True),
        sa.Column('email_hash', sa.String(), nullable=False),
        sa.Column('subscribed', sa.Boolean(), nullable=False),
        sa.Column('consent_version', sa.String(), nullable=False),
        sa.Column('accepted_at', sa.BigInteger(), nullable=True),
        sa.Column('withdrawn_at', sa.BigInteger(), nullable=True),
        sa.Column('updated_at', sa.BigInteger(), nullable=False),
    )
    op.create_table(
        'airis_email_preference_event',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('email_hash', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('consent_version', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
    )
    op.create_index('ix_email_preference_event_user_time', 'airis_email_preference_event', ['user_id', 'created_at'])
    op.create_index(
        'ix_email_preference_event_address_time', 'airis_email_preference_event', ['email_hash', 'created_at']
    )
    op.create_table(
        'airis_email_unsubscribe_token',
        sa.Column('token_hash', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('email_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('expires_at', sa.BigInteger(), nullable=False),
    )
    op.create_index('ix_airis_email_unsubscribe_token_user_id', 'airis_email_unsubscribe_token', ['user_id'])
    op.create_index('ix_airis_email_unsubscribe_token_expires_at', 'airis_email_unsubscribe_token', ['expires_at'])


def downgrade() -> None:
    op.drop_table('airis_email_unsubscribe_token')
    op.drop_table('airis_email_preference_event')
    op.drop_table('airis_email_preference')
