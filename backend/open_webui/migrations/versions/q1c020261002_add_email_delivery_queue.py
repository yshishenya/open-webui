"""Durable email jobs and shared transport capacity.

Revision ID: q1c020261002
Revises: s1c020261002
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'q1c020261002'
down_revision: str | None = 's1c020261002'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_email_delivery',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('template_version', sa.String(), nullable=False),
        sa.Column('scenario_key', sa.String(), nullable=False),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('due_at', sa.BigInteger(), nullable=False),
        sa.Column('expires_at', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('retryable', sa.Boolean(), nullable=False),
        sa.Column('claim_id', sa.String(), nullable=True),
        sa.Column('lease_until', sa.BigInteger(), nullable=True),
        sa.Column('submitted_at', sa.BigInteger(), nullable=True),
        sa.Column('accepted_at', sa.BigInteger(), nullable=True),
        sa.Column('provider_id', sa.String(), nullable=False),
        sa.Column('delivered_at', sa.BigInteger(), nullable=True),
        sa.Column('bounced_at', sa.BigInteger(), nullable=True),
        sa.Column('complained_at', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('updated_at', sa.BigInteger(), nullable=False),
        sa.UniqueConstraint('user_id', 'type', 'scenario_key', name='uq_email_delivery_scenario'),
        sa.CheckConstraint("category IN ('product', 'service')", name='ck_email_delivery_category'),
        sa.CheckConstraint(
            "status IN ('pending','claimed','retry','accepted','unknown','suppressed','expired','failed')",
            name='ck_email_delivery_status',
        ),
    )
    op.create_index('ix_email_delivery_due', 'airis_email_delivery', ['status', 'category', 'due_at'])
    op.create_index('ix_email_delivery_user_time', 'airis_email_delivery', ['user_id', 'category', 'submitted_at'])
    op.create_index('ix_email_delivery_lease', 'airis_email_delivery', ['status', 'lease_until'])
    op.create_table(
        'airis_email_transport_window',
        sa.Column('transport_key', sa.String(), primary_key=True),
        sa.Column('minute', sa.BigInteger(), primary_key=True),
        sa.Column('total', sa.Integer(), nullable=False),
        sa.Column('product', sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('airis_email_transport_window')
    op.drop_table('airis_email_delivery')
