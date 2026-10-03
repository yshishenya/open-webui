"""Controlled populations verify observed units, coverage limits and read-only export."""

from typing import get_args
from unittest.mock import AsyncMock

import pytest
from open_webui.models.email_delivery import EmailDelivery, EmailType, enqueue_email
from open_webui.models.email_preferences import set_product_preference
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from open_webui.utils.airis import mail_outcome_report as mail
from sqlalchemy import event, update
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from test.util import test_onboarding_report as report_tests

queue_database = report_tests.queue_database
database = report_tests.database
NOW, REGISTERED = report_tests.NOW, report_tests.REGISTERED


async def job(
    session: AsyncSession,
    kind: EmailType,
    key: str,
    status: str,
    user_id: str = '1',
    *,
    created_at: int = REGISTERED,
    reason: str | None = None,
    delivered_at: int | None = None,
    bounced_at: int | None = None,
    complained_at: int | None = None,
) -> str:
    """Store a controlled existing fact; production dispatch is never involved."""
    result = await enqueue_email(session, user_id, kind, key, REGISTERED, NOW)
    assert result is not None
    await session.execute(
        update(EmailDelivery)
        .where(EmailDelivery.id == result)
        .values(
            created_at=created_at,
            status=status,
            reason=reason,
            accepted_at=NOW - 1 if status == 'accepted' else None,
            delivered_at=delivered_at,
            bounced_at=bounced_at,
            complained_at=complained_at,
        )
    )
    return result


@pytest.mark.asyncio
async def test_six_types_zero_observations_keep_unknown_denominators(
    database: async_sessionmaker[AsyncSession],
) -> None:
    result = await report_tests.snapshot()
    for rows in [result.mail_summary, *(cohort.mail_summary for cohort in result.cohorts)]:
        assert [row.type for row in rows] == list(get_args(EmailType))
        for row in rows:
            assert row.queued_jobs == row.queued_accounts == 0
            assert row.states_now == dict.fromkeys(mail.MAIL_STATES, 0)
            assert row.reasons_now == []
            assert row.eligible_accounts is None and row.eligibility_observed_from is None
            assert row.eligibility_coverage == row.receipt_coverage == 'unavailable'
            assert row.accepted_over_eligible_fraction is row.delivered_over_accepted_fraction is row.inbox is None
    empty = await report_tests.report.registration_report(
        NOW, NOW + 1, NOW, NOW, report_tests.ZoneInfo('UTC'), frozenset()
    )
    assert empty.cohorts == [] and len(empty.mail_summary) == 6
    assert all(row.queued_jobs == 0 for row in empty.mail_summary)


@pytest.mark.asyncio
async def test_every_state_is_conserved_and_distinct_accounts_are_not_jobs(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as session:
        for kind in get_args(EmailType):
            for status in mail.MAIL_STATES:
                await job(session, kind, status, status, reason='controlled' if status in mail.REASON_STATES else None)
            # Replay must not create a ninth job, including for credited payments.
            assert await enqueue_email(session, '1', kind, 'accepted', REGISTERED, NOW) is None
            await job(session, kind, 'second-account', 'accepted', user_id='2')
        await session.commit()
    result = await report_tests.snapshot()
    assert sum(row.queued_jobs for row in result.mail_summary) == 54
    for row in result.mail_summary:
        assert row.queued_jobs == 9 and row.queued_accounts == 2
        assert sum(row.states_now.values()) == row.queued_jobs
        assert row.states_now == {state: 2 if state == 'accepted' else 1 for state in mail.MAIL_STATES}
        assert {(reason.status, reason.reason, reason.jobs) for reason in row.reasons_now} == {
            (state, 'controlled', 1) for state in mail.REASON_STATES
        }
        assert row.eligible_accounts is None and row.accepted_over_eligible_fraction is None
    assert all(row.queued_jobs == 8 and row.queued_accounts == 1 for row in result.cohorts[0].mail_summary)
    assert all(row.queued_jobs == row.queued_accounts == 1 for row in result.cohorts[1].mail_summary)


@pytest.mark.asyncio
async def test_receipt_boundaries_overlap_and_future_jobs_are_excluded(
    database: async_sessionmaker[AsyncSession],
) -> None:
    async with database() as session:
        await job(
            session,
            'welcome',
            'overlap',
            'accepted',
            created_at=NOW,
            delivered_at=NOW,
            bounced_at=NOW - 1,
            complained_at=NOW,
        )
        await job(
            session,
            'welcome',
            'future-receipts',
            'unknown',
            delivered_at=NOW + 1,
            bounced_at=NOW + 1,
            complained_at=NOW + 1,
        )
        await job(session, 'welcome', 'future-job', 'accepted', created_at=NOW + 1, delivered_at=NOW)
        await session.commit()
    row = (await report_tests.snapshot()).mail_summary[0]
    assert row.queued_jobs == 2 and row.queued_accounts == 1
    assert row.states_now['accepted'] == row.states_now['unknown'] == 1
    assert row.delivery_receipts == row.bounce_records == row.complaint_records == 1
    assert row.receipt_coverage == 'unavailable' and row.delivered_over_accepted_fraction is None
    assert row.inbox is None


@pytest.mark.asyncio
async def test_opt_out_preserves_recorded_outcomes_and_report_never_writes_or_sends(
    database: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with database() as session:
        await job(session, 'topup_credited', 'payment-a', 'accepted')
        await job(session, 'topup_credited', 'payment-b', 'unknown')
        await session.commit()
    before = (await report_tests.snapshot()).mail_summary
    await set_product_preference('1', False, 'settings')
    scan = AsyncMock(side_effect=AssertionError('Report must not reconcile'))
    send = AsyncMock(side_effect=AssertionError('Report must not dispatch'))
    monkeypatch.setattr(scenarios, 'reconcile_email_candidates', scan)
    monkeypatch.setattr(worker, 'execute_email', send)
    writes: list[str] = []

    def record_statement(
        connection: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: ExecutionContext,
        executemany: bool,
    ) -> None:
        if statement.lstrip().split(' ', 1)[0].upper() in {'INSERT', 'UPDATE', 'DELETE', 'REPLACE'}:
            writes.append(statement)

    engine = database.kw['bind']
    assert isinstance(engine, AsyncEngine)
    event.listen(engine.sync_engine, 'before_cursor_execute', record_statement)
    try:
        first, second = await report_tests.snapshot(), await report_tests.snapshot()
    finally:
        event.remove(engine.sync_engine, 'before_cursor_execute', record_statement)
    assert first == second
    assert first.mail_summary == before
    assert first.cohorts[0].consent_segment == 'no_current_opt_in'
    credited = next(row for row in first.mail_summary if row.type == 'topup_credited')
    assert credited.queued_jobs == 2 and credited.queued_accounts == 1
    assert credited.eligible_accounts is None
    assert not writes
    scan.assert_not_awaited()
    send.assert_not_awaited()
    serialized = first.model_dump_json()
    for sensitive in [
        'person1@airis.you',
        'person2@airis.you',
        'payment-a',
        'payment-b',
        'provider_id',
        'scenario_key',
    ]:
        assert sensitive not in serialized


def test_legacy_type_and_absent_reason_never_disappear_from_conservation() -> None:
    rows = [
        mail.MailOutcome(
            type='retired_scenario',
            template_version='old',
            status='failed',
            reason=None,
            jobs=2,
            delivery_receipts=0,
            bounce_records=0,
            complaint_records=0,
        ),
        mail.MailOutcome(
            type='retired_scenario',
            template_version='old2',
            status='failed',
            reason=None,
            jobs=1,
            delivery_receipts=0,
            bounce_records=0,
            complaint_records=0,
        ),
    ]
    result = mail.summarize_mail_outcomes(rows, {'retired_scenario': 1}, NOW)
    assert len(result) == 7 and result[-1].type == 'retired_scenario'
    assert result[-1].queued_jobs == 3 and result[-1].queued_accounts == 1
    assert result[-1].states_now['failed'] == 3
    assert result[-1].reasons_now == [mail.MailReasonCount(status='failed', reason=None, jobs=3)]
