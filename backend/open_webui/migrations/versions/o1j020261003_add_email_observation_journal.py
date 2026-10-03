"""Declared mail observation populations, runs and decision history.

Revision ID: o1j020261003
Revises: q1c020261002
"""

import sqlalchemy as sa
from alembic import op

revision: str = 'o1j020261003'
down_revision: str | None = 'q1c020261002'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'airis_email_observation_scope',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('rule_version', sa.String, nullable=False),
        sa.Column('mode', sa.String, nullable=False),
        sa.Column('declared_at', sa.BigInteger, nullable=False),
        sa.Column('observed_from', sa.BigInteger, nullable=True),
        sa.Column('closed_at', sa.BigInteger, nullable=True),
        sa.Column('registrations_from', sa.BigInteger, nullable=False),
        sa.Column('registrations_until', sa.BigInteger, nullable=False),
        sa.Column('payments_from', sa.BigInteger, nullable=False),
        sa.Column('payments_until', sa.BigInteger, nullable=False),
        sa.Column('member_count', sa.Integer, nullable=False),
        sa.CheckConstraint("mode IN ('observe','dispatch')", name='ck_email_observation_mode'),
        sa.CheckConstraint('member_count >= 0', name='ck_email_observation_members'),
        sa.CheckConstraint('registrations_from < registrations_until', name='ck_email_observation_registrations'),
        sa.CheckConstraint('payments_from < payments_until', name='ck_email_observation_payments'),
        sa.CheckConstraint('observed_from IS NULL OR observed_from >= declared_at', name='ck_email_observation_start'),
    )
    op.create_table(
        'airis_email_observation_member',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column(
            'scope_id', sa.String, sa.ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('ordinal', sa.Integer, nullable=False),
        sa.Column('user_id', sa.String, sa.ForeignKey('user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('included_at', sa.BigInteger, nullable=False),
        sa.CheckConstraint('ordinal > 0', name='ck_email_observation_member_order'),
    )
    op.create_index(
        'uq_email_observation_member_order', 'airis_email_observation_member', ['scope_id', 'ordinal'], unique=True
    )
    op.create_index(
        'uq_email_observation_member_user', 'airis_email_observation_member', ['scope_id', 'user_id'], unique=True
    )
    op.create_table(
        'airis_email_observation_run',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column(
            'scope_id', sa.String, sa.ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('started_at', sa.BigInteger, nullable=False),
        sa.Column('finished_at', sa.BigInteger, nullable=True),
        sa.Column('upper_ordinal', sa.Integer, nullable=False),
        sa.Column('cursor', sa.Integer, nullable=False),
        sa.Column('scanned_members', sa.Integer, nullable=False),
        sa.Column('scanned_scenarios', sa.Integer, nullable=False),
        sa.Column('status', sa.String, nullable=False),
        sa.Column('failure_reason', sa.String, nullable=True),
        sa.Column('claim_id', sa.String, nullable=True),
        sa.Column('lease_until', sa.BigInteger, nullable=True),
        sa.CheckConstraint("status IN ('running','completed','failed')", name='ck_email_observation_run_status'),
        sa.CheckConstraint(
            'cursor >= 0 AND cursor <= upper_ordinal AND scanned_members = cursor',
            name='ck_email_observation_run_cursor',
        ),
        sa.CheckConstraint('scanned_scenarios >= 0', name='ck_email_observation_run_scenarios'),
        sa.CheckConstraint("status <> 'completed' OR cursor = upper_ordinal", name='ck_email_observation_run_complete'),
        sa.CheckConstraint('finished_at IS NULL OR finished_at >= started_at', name='ck_email_observation_run_finish'),
        sa.CheckConstraint(
            "(status = 'running' AND claim_id IS NOT NULL AND lease_until IS NOT NULL AND finished_at IS NULL) "
            "OR (status <> 'running' AND claim_id IS NULL AND lease_until IS NULL AND finished_at IS NOT NULL)",
            name='ck_email_observation_run_lease',
        ),
    )
    op.create_index(
        'uq_email_observation_live_run',
        'airis_email_observation_run',
        ['scope_id'],
        unique=True,
        sqlite_where=sa.column('status') == 'running',
        postgresql_where=sa.column('status') == 'running',
    )
    op.create_index('ix_email_observation_run_time', 'airis_email_observation_run', ['scope_id', 'started_at'])
    op.create_table(
        'airis_email_scenario_observation',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column(
            'member_id',
            sa.String,
            sa.ForeignKey('airis_email_observation_member.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('type', sa.String, nullable=False),
        sa.Column('category', sa.String, nullable=False),
        sa.Column('scenario_key', sa.String, nullable=False),
        sa.Column('rule_version', sa.String, nullable=False),
        sa.Column('due_at', sa.BigInteger, nullable=False),
        sa.Column('expires_at', sa.BigInteger, nullable=True),
        sa.Column('payment_id', sa.String, sa.ForeignKey('billing_payment.id', ondelete='SET NULL'), nullable=True),
        sa.Column(
            'delivery_id', sa.String, sa.ForeignKey('airis_email_delivery.id', ondelete='SET NULL'), nullable=True
        ),
        sa.Column('linked_at', sa.BigInteger, nullable=True),
        sa.Column('first_observed_at', sa.BigInteger, nullable=False),
        sa.Column('first_eligible_at', sa.BigInteger, nullable=True),
        sa.Column('last_observed_at', sa.BigInteger, nullable=False),
        sa.Column('reason', sa.String, nullable=False),
        sa.Column('defer_until', sa.BigInteger, nullable=True),
        sa.Column('revision', sa.Integer, nullable=False),
        sa.CheckConstraint("category IN ('product','service')", name='ck_email_scenario_observation_category'),
        sa.CheckConstraint(
            "type IN ('welcome','activation_24h','paid_value_72h','payment_help_72h','feedback_14d','topup_credited')",
            name='ck_email_scenario_observation_type',
        ),
        sa.CheckConstraint(
            'revision > 0 AND last_observed_at >= first_observed_at', name='ck_email_observation_revision'
        ),
        sa.CheckConstraint(
            'first_eligible_at IS NULL OR first_eligible_at >= first_observed_at',
            name='ck_email_observation_first_eligible',
        ),
        sa.CheckConstraint(
            'first_eligible_at IS NULL OR first_eligible_at <= last_observed_at',
            name='ck_email_observation_eligible_time',
        ),
        sa.CheckConstraint('expires_at IS NULL OR expires_at >= due_at', name='ck_email_observation_window'),
        sa.CheckConstraint('delivery_id IS NULL OR linked_at IS NOT NULL', name='ck_email_observation_delivery_link'),
    )
    op.create_index(
        'uq_email_scenario_observation',
        'airis_email_scenario_observation',
        ['member_id', 'type', 'scenario_key', 'rule_version'],
        unique=True,
    )
    op.create_index(
        'ix_email_scenario_eligible', 'airis_email_scenario_observation', ['member_id', 'type', 'first_eligible_at']
    )
    op.create_table(
        'airis_email_decision_event',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column(
            'observation_id',
            sa.String,
            sa.ForeignKey('airis_email_scenario_observation.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'run_id', sa.String, sa.ForeignKey('airis_email_observation_run.id', ondelete='SET NULL'), nullable=True
        ),
        sa.Column('revision', sa.Integer, nullable=False),
        sa.Column('observed_at', sa.BigInteger, nullable=False),
        sa.Column('reason', sa.String, nullable=False),
        sa.Column('defer_until', sa.BigInteger, nullable=True),
    )
    op.create_index(
        'uq_email_decision_event_revision', 'airis_email_decision_event', ['observation_id', 'revision'], unique=True
    )


def downgrade() -> None:
    op.drop_table('airis_email_decision_event')
    op.drop_table('airis_email_scenario_observation')
    op.drop_table('airis_email_observation_run')
    op.drop_table('airis_email_observation_member')
    op.drop_table('airis_email_observation_scope')
