"""Administrative command replay receipts; observation history is unchanged.

Revision ID: o1a020261003
Revises: o1j020261003
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'o1a020261003'
down_revision: str | None = 'o1j020261003'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_email_observation_command',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('actor_id', sa.String, nullable=False),
        sa.Column('request_key', sa.String, nullable=False),
        sa.Column('request_hash', sa.String, nullable=False),
        sa.Column('action', sa.String, nullable=False),
        sa.Column('scope_id', sa.String, sa.ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE')),
        sa.Column('run_id', sa.String, sa.ForeignKey('airis_email_observation_run.id', ondelete='CASCADE')),
        sa.Column('claim_id', sa.String),
        sa.Column('created_at', sa.BigInteger, nullable=False),
        sa.CheckConstraint("action IN ('declare','start')", name='ck_email_observation_command_action'),
    )
    op.create_index(
        'uq_email_observation_command_replay',
        'airis_email_observation_command',
        ['actor_id', 'request_key'],
        unique=True,
    )
    op.create_index('ix_email_observation_command_scope', 'airis_email_observation_command', ['scope_id', 'action'])


def downgrade() -> None:
    op.drop_table('airis_email_observation_command')
