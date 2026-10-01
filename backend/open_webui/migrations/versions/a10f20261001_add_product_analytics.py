"""Consent-bound product funnel analytics.

Revision ID: a10f20261001
Revises: b4c5d6e7f8a9
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'a10f20261001'
down_revision: str | None = 'b4c5d6e7f8a9'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_first_payment',
        sa.Column('user_id', sa.Text(), primary_key=True),
        sa.Column('payment_id', sa.Text(), nullable=False, unique=True),
        sa.Column('occurred_at', sa.BigInteger(), nullable=False),
    )
    op.create_table(
        'airis_verified_refund',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('payment_id', sa.Text(), nullable=False),
        sa.Column('user_id', sa.Text(), nullable=False),
        sa.Column('amount_kopeks', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.Text(), nullable=False),
        sa.Column('occurred_at', sa.BigInteger(), nullable=False),
    )
    op.create_index('ix_airis_verified_refund_payment_id', 'airis_verified_refund', ['payment_id'])
    op.create_index('ix_airis_verified_refund_user_id', 'airis_verified_refund', ['user_id'])
    op.create_index('ix_airis_verified_refund_occurred_at', 'airis_verified_refund', ['occurred_at'])
    op.create_table(
        'airis_analytics_identity',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('anonymous_id', sa.Text(), nullable=False, unique=True),
        sa.Column('user_id', sa.Text(), nullable=True, unique=True),
        sa.Column('consent', sa.Boolean(), nullable=False),
        sa.Column('granted_at', sa.BigInteger(), nullable=False),
        sa.Column('client_id', sa.Text(), nullable=True),
        sa.Column('first_touch', sa.Text(), nullable=False),
        sa.Column('last_touch', sa.Text(), nullable=False),
        sa.Column('lifetime', sa.Text(), nullable=False),
    )
    op.create_table(
        'airis_analytics_binding',
        sa.Column('anonymous_id', sa.Text(), primary_key=True),
        sa.Column('identity_id', sa.Text(), nullable=False),
    )
    op.create_index(
        'ix_airis_analytics_binding_identity_id',
        'airis_analytics_binding',
        ['identity_id'],
    )
    op.create_table(
        'airis_analytics_event',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('identity_id', sa.Text(), nullable=False),
        sa.Column('event_name', sa.Text(), nullable=False),
        sa.Column('occurred_at', sa.BigInteger(), nullable=False),
        sa.Column('properties', sa.Text(), nullable=False),
    )
    op.create_index('ix_airis_analytics_event_identity_id', 'airis_analytics_event', ['identity_id'])
    op.create_index('ix_airis_analytics_event_occurred_at', 'airis_analytics_event', ['occurred_at'])
    op.create_table(
        'airis_analytics_delivery',
        sa.Column('id', sa.Text(), primary_key=True),
        sa.Column('event_id', sa.Text(), nullable=False),
        sa.Column('destination', sa.Text(), nullable=False),
        sa.Column('state', sa.Text(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('available_at', sa.BigInteger(), nullable=False),
        sa.Column('upload_id', sa.Text(), nullable=True),
        sa.UniqueConstraint('event_id', 'destination', name='uq_analytics_delivery_event_destination'),
    )


def downgrade() -> None:
    op.drop_table('airis_first_payment')
    op.drop_table('airis_verified_refund')
    op.drop_table('airis_analytics_delivery')
    op.drop_index('ix_airis_analytics_event_occurred_at', table_name='airis_analytics_event')
    op.drop_index('ix_airis_analytics_event_identity_id', table_name='airis_analytics_event')
    op.drop_table('airis_analytics_event')
    op.drop_table('airis_analytics_binding')
    op.drop_table('airis_analytics_identity')
