"""Content-free journal schema, independent of observation and mail transport."""

from open_webui.internal.db import Base
from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Index, Integer, String


class EmailObservationScope(Base):
    __tablename__ = 'airis_email_observation_scope'
    id = Column(String, primary_key=True)
    rule_version = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    declared_at = Column(BigInteger, nullable=False)
    observed_from = Column(BigInteger, nullable=True)
    closed_at = Column(BigInteger, nullable=True)
    registrations_from = Column(BigInteger, nullable=False)
    registrations_until = Column(BigInteger, nullable=False)
    payments_from = Column(BigInteger, nullable=False)
    payments_until = Column(BigInteger, nullable=False)
    member_count = Column(Integer, nullable=False)
    __table_args__ = (
        CheckConstraint("mode IN ('observe','dispatch')", name='ck_email_observation_mode'),
        CheckConstraint('member_count >= 0', name='ck_email_observation_members'),
        CheckConstraint('registrations_from < registrations_until', name='ck_email_observation_registrations'),
        CheckConstraint('payments_from < payments_until', name='ck_email_observation_payments'),
        CheckConstraint('observed_from IS NULL OR observed_from >= declared_at', name='ck_email_observation_start'),
    )


class EmailObservationMember(Base):
    __tablename__ = 'airis_email_observation_member'
    id = Column(String, primary_key=True)
    scope_id = Column(String, ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE'), nullable=False)
    ordinal = Column(Integer, nullable=False)
    user_id = Column(String, ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    included_at = Column(BigInteger, nullable=False)
    __table_args__ = (
        Index('uq_email_observation_member_order', 'scope_id', 'ordinal', unique=True),
        Index('uq_email_observation_member_user', 'scope_id', 'user_id', unique=True),
        CheckConstraint('ordinal > 0', name='ck_email_observation_member_order'),
    )


class EmailObservationRun(Base):
    __tablename__ = 'airis_email_observation_run'
    id = Column(String, primary_key=True)
    scope_id = Column(String, ForeignKey('airis_email_observation_scope.id', ondelete='CASCADE'), nullable=False)
    started_at = Column(BigInteger, nullable=False)
    finished_at = Column(BigInteger, nullable=True)
    upper_ordinal = Column(Integer, nullable=False)
    cursor = Column(Integer, nullable=False)
    scanned_members = Column(Integer, nullable=False)
    scanned_scenarios = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    failure_reason = Column(String, nullable=True)
    claim_id = Column(String, nullable=True)
    lease_until = Column(BigInteger, nullable=True)
    __table_args__ = (
        Index(
            'uq_email_observation_live_run',
            scope_id,
            unique=True,
            sqlite_where=status == 'running',
            postgresql_where=status == 'running',
        ),
        Index('ix_email_observation_run_time', 'scope_id', 'started_at'),
        CheckConstraint("status IN ('running','completed','failed')", name='ck_email_observation_run_status'),
        CheckConstraint(
            'cursor >= 0 AND cursor <= upper_ordinal AND scanned_members = cursor',
            name='ck_email_observation_run_cursor',
        ),
        CheckConstraint('scanned_scenarios >= 0', name='ck_email_observation_run_scenarios'),
        CheckConstraint("status <> 'completed' OR cursor = upper_ordinal", name='ck_email_observation_run_complete'),
        CheckConstraint('finished_at IS NULL OR finished_at >= started_at', name='ck_email_observation_run_finish'),
        CheckConstraint(
            "(status = 'running' AND claim_id IS NOT NULL AND lease_until IS NOT NULL AND finished_at IS NULL) "
            "OR (status <> 'running' AND claim_id IS NULL AND lease_until IS NULL AND finished_at IS NOT NULL)",
            name='ck_email_observation_run_lease',
        ),
    )


class EmailScenarioObservation(Base):
    __tablename__ = 'airis_email_scenario_observation'
    id = Column(String, primary_key=True)
    member_id = Column(String, ForeignKey('airis_email_observation_member.id', ondelete='CASCADE'), nullable=False)
    type = Column(String, nullable=False)
    category = Column(String, nullable=False)
    scenario_key = Column(String, nullable=False)
    rule_version = Column(String, nullable=False)
    due_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=True)
    payment_id = Column(String, ForeignKey('billing_payment.id', ondelete='SET NULL'), nullable=True)
    delivery_id = Column(String, ForeignKey('airis_email_delivery.id', ondelete='SET NULL'), nullable=True)
    linked_at = Column(BigInteger, nullable=True)
    first_observed_at = Column(BigInteger, nullable=False)
    first_eligible_at = Column(BigInteger, nullable=True)
    last_observed_at = Column(BigInteger, nullable=False)
    reason = Column(String, nullable=False)
    defer_until = Column(BigInteger, nullable=True)
    revision = Column(Integer, nullable=False)
    __table_args__ = (
        Index('uq_email_scenario_observation', 'member_id', 'type', 'scenario_key', 'rule_version', unique=True),
        Index('ix_email_scenario_eligible', 'member_id', 'type', 'first_eligible_at'),
        CheckConstraint("category IN ('product','service')", name='ck_email_scenario_observation_category'),
        CheckConstraint(
            "type IN ('welcome','activation_24h','paid_value_72h','payment_help_72h','feedback_14d','topup_credited')",
            name='ck_email_scenario_observation_type',
        ),
        CheckConstraint('revision > 0 AND last_observed_at >= first_observed_at', name='ck_email_observation_revision'),
        CheckConstraint(
            'first_eligible_at IS NULL OR first_eligible_at >= first_observed_at',
            name='ck_email_observation_first_eligible',
        ),
        CheckConstraint(
            'first_eligible_at IS NULL OR first_eligible_at <= last_observed_at',
            name='ck_email_observation_eligible_time',
        ),
        CheckConstraint('expires_at IS NULL OR expires_at >= due_at', name='ck_email_observation_window'),
        CheckConstraint('delivery_id IS NULL OR linked_at IS NOT NULL', name='ck_email_observation_delivery_link'),
    )


class EmailDecisionEvent(Base):
    __tablename__ = 'airis_email_decision_event'
    id = Column(String, primary_key=True)
    observation_id = Column(
        String, ForeignKey('airis_email_scenario_observation.id', ondelete='CASCADE'), nullable=False
    )
    run_id = Column(String, ForeignKey('airis_email_observation_run.id', ondelete='SET NULL'), nullable=True)
    revision = Column(Integer, nullable=False)
    observed_at = Column(BigInteger, nullable=False)
    reason = Column(String, nullable=False)
    defer_until = Column(BigInteger, nullable=True)
    __table_args__ = (Index('uq_email_decision_event_revision', 'observation_id', 'revision', unique=True),)
