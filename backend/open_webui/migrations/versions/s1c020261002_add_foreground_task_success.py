"""Content-free foreground success and trusted completion checkpoints.

Revision ID: s1c020261002
Revises: e1c020261002
"""

import sqlalchemy as sa
from alembic import op

revision: str = 's1c020261002'
down_revision: str | None = 'e1c020261002'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_task_success',
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('operation_id', sa.String(), primary_key=True),
        sa.Column('kind', sa.String(), primary_key=True),
        sa.Column('completed_at', sa.BigInteger(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
    )
    op.create_index('ix_airis_task_success_user_time', 'airis_task_success', ['user_id', 'completed_at'])
    op.add_column('chat_message', sa.Column('success_checkpoints', sa.JSON(none_as_null=True), nullable=True))
    op.create_index(
        'ix_chat_message_success_checkpoint',
        'chat_message',
        ['id'],
        postgresql_where=sa.text('success_checkpoints IS NOT NULL'),
        sqlite_where=sa.text('success_checkpoints IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_chat_message_success_checkpoint', table_name='chat_message')
    op.drop_column('chat_message', 'success_checkpoints')
    op.drop_table('airis_task_success')
