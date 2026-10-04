"""Coverage boundaries and concurrent database snapshots with independent expected counts."""

import hashlib
import json
import time
from uuid import uuid4

import pytest
from open_webui.models import email_observation as store
from open_webui.models import email_preferences as preferences
from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import EmailDelivery
from open_webui.utils.airis import email_scope_report as report
from open_webui.utils.airis import email_scope_report_data as data
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_scope_report as cases

# Reuse the already disposable SQLite/PostgreSQL fixture, never the production database.
database = cases.database
journal_db = cases.journal_db
observed_db = cases.observed_db
report_db = cases.report_db


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['running', 'failed', 'ambiguous'])
async def test_latest_incomplete_or_ambiguous_pass_never_yields_a_fraction(
    report_db: async_sessionmaker[AsyncSession],
    status: str,
) -> None:
    scope, _ = await cases.ready(report_db, 'welcome', 0)
    now = int(time.time())
    async with report_db() as session:
        last = await session.scalar(
            select(store.EmailObservationRun).where(store.EmailObservationRun.scope_id == scope)
        )
        session.add(
            store.EmailObservationRun(
                id=str(uuid4()),
                scope_id=scope,
                started_at=now if status == 'ambiguous' else now + 1,
                finished_at=None if status == 'running' else now + 1,
                upper_ordinal=2,
                cursor=0 if status == 'running' else 2,
                scanned_members=0 if status == 'running' else 2,
                scanned_scenarios=0,
                status='completed' if status == 'ambiguous' else status,
                claim_id='private-lease' if status == 'running' else None,
                lease_until=now + 100 if status == 'running' else None,
            )
        )
        if status == 'ambiguous':
            last.finished_at = now + 1
        await session.commit()
    result = await report.scope_mail_report(scope)
    assert result.coverage.state == 'partial'
    assert cases.row(result).accepted_over_observed_accounts.denominator is None
    assert 'private-lease' not in result.model_dump_json()
    if status == 'ambiguous':
        assert result.coverage.last_run_status == 'ambiguous' and result.coverage.visited_members == 0
    else:
        assert 'no_complete_latest_run' in result.coverage.reasons


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['rule', 'future', 'window', 'missing_observation', 'members', 'payment_expiry'])
async def test_unsupported_future_changed_and_missing_facts_stay_explicit(
    report_db: async_sessionmaker[AsyncSession],
    change: str,
) -> None:
    scope, _ = await cases.ready(report_db, 'topup_credited', 3)
    async with report_db() as session:
        if change == 'rule':
            await session.execute(
                update(store.EmailObservationScope)
                .where(store.EmailObservationScope.id == scope)
                .values(rule_version='private-old-rule')
            )
        elif change == 'members':
            await session.execute(
                update(store.EmailObservationScope)
                .where(store.EmailObservationScope.id == scope)
                .values(member_count=3)
            )
        elif change == 'missing_observation':
            await session.execute(
                delete(store.EmailScenarioObservation).where(store.EmailScenarioObservation.type == 'feedback_14d')
            )
        else:
            observation = await session.scalar(
                select(store.EmailScenarioObservation).where(
                    store.EmailScenarioObservation.type
                    == ('payment_help_72h' if change == 'payment_expiry' else 'welcome')
                )
            )
            if change == 'payment_expiry':
                observation.expires_at += 1
            elif change == 'future':
                observation.last_observed_at = int(time.time()) + 1
            else:
                observation.due_at -= 1
        await session.commit()
    result = await report.scope_mail_report(scope)
    expected = {
        'rule': 'unsupported_rule',
        'future': 'future_observation',
        'window': 'changed_source_windows',
        'missing_observation': 'unobserved_sources',
        'members': 'membership_mismatch',
        'payment_expiry': 'changed_source_windows',
    }[change]
    assert expected in result.coverage.reasons
    assert cases.row(result).accepted_over_observed_accounts.fraction is None
    assert 'private-old-rule' not in result.model_dump_json()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'change', ['future_acceptance', 'before_link', 'missing_acceptance', 'wrong_category', 'wrong_key']
)
async def test_receipt_requires_exact_identity_and_noncontradictory_timestamps(
    report_db: async_sessionmaker[AsyncSession],
    change: str,
) -> None:
    scope, job = await cases.ready(report_db, 'welcome', 0)
    now = int(time.time())
    async with report_db() as session:
        delivery = await session.get(EmailDelivery, job)
        delivery.status, delivery.submitted_at, delivery.accepted_at = 'accepted', now, now
        if change == 'future_acceptance':
            delivery.accepted_at = now + 1
        elif change == 'before_link':
            delivery.accepted_at = now - 1
        elif change == 'missing_acceptance':
            delivery.accepted_at = None
        elif change == 'wrong_category':
            delivery.category = 'service'
        else:
            delivery.scenario_key = 'private-other-scenario'
        await session.commit()
    result = await report.scope_mail_report(scope)
    item = cases.row(result)
    assert item.accepted_over_observed_accounts.numerator == 0
    assert item.accepted_over_observed_accounts.unavailable_reason == 'invalid_queue_association'
    assert 'private-other-scenario' not in result.model_dump_json()


@pytest.mark.asyncio
@pytest.mark.parametrize('status', report.MAIL_STATES)
async def test_all_eight_states_conserve_jobs_and_receipt_events_can_overlap(
    report_db: async_sessionmaker[AsyncSession],
    status: str,
) -> None:
    scope, job = await cases.ready(report_db, 'welcome', 0)
    now = int(time.time())
    async with report_db() as session:
        await session.execute(
            update(EmailDelivery)
            .where(EmailDelivery.id == job)
            .values(
                status=status,
                accepted_at=now if status == 'accepted' else None,
                delivered_at=now,
                bounced_at=now,
                complained_at=now + 1,
                claim_id='private-claim' if status == 'claimed' else None,
                lease_until=now + 100 if status == 'claimed' else None,
            )
        )
        await session.commit()
    item = cases.row(await report.scope_mail_report(scope))
    assert item.queue.states_now[status] == item.queue.queued_jobs == 1
    assert sum(item.queue.states_now.values()) == 1
    assert item.queue.delivery_receipts == item.queue.bounce_records == 1
    assert item.queue.complaint_records == 0 and item.queue.delivered_over_accepted_fraction is None


@pytest.mark.asyncio
async def test_closed_population_excludes_later_payments_without_losing_past_counts(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    scope, _ = await cases.ready(report_db, 'topup_credited', 3)
    now = int(time.time())
    async with report_db() as session:
        await session.execute(
            update(store.EmailObservationScope).where(store.EmailObservationScope.id == scope).values(closed_at=now)
        )
        await session.commit()
    await cases.queue_tests.payment_fact(report_db, 'after-closure', 'canceled', now + 1, credit=False)
    result = await report.scope_mail_report(scope)
    assert result.coverage.state == 'complete_traversal' and result.coverage.unobserved_payment_scenarios == 0
    assert cases.row(result, 'topup_credited').observed_eligible_scenarios == 1
    async with report_db() as session:
        await session.execute(delete(Payment).where(Payment.id == 'payment'))
        await session.commit()
    assert (await report.scope_mail_report(scope)).coverage.lost_payment_scenarios == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('limit', ['members', 'history', 'payments'])
async def test_capacity_limits_fail_closed_before_unbounded_export(
    report_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    limit: str,
) -> None:
    scope, _ = await cases.ready(report_db, 'topup_credited', 3)
    monkeypatch.setattr(
        data,
        {'members': 'MAX_REPORT_MEMBERS', 'history': 'MAX_MEMBER_HISTORY', 'payments': 'MAX_MEMBER_PAYMENTS'}[limit],
        0,
    )
    with pytest.raises(ValueError, match='capacity exceeded'):
        await report.scope_mail_report(scope)


@pytest.mark.asyncio
async def test_concurrent_queue_commit_cannot_mix_two_database_snapshots(
    report_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scope, job = await cases.ready(report_db, 'welcome', 0)
    async with report_db() as session:
        engine = session.bind
    if engine.dialect.name == 'sqlite':
        async with engine.connect() as connection:
            await connection.run_sync(lambda conn: conn.exec_driver_sql('PRAGMA journal_mode=WAL'))
    original = data._observations
    changed = False

    async def commit_between_reads(
        session: AsyncSession, group: store.EmailObservationScope
    ) -> list[store.EmailScenarioObservation]:
        nonlocal changed
        if not changed:
            changed = True
            async with report_db() as writer:
                await writer.execute(
                    update(EmailDelivery)
                    .where(EmailDelivery.id == job)
                    .values(
                        status='accepted',
                        accepted_at=int(time.time()),
                        submitted_at=int(time.time()),
                    )
                )
                await writer.commit()
        return await original(session, group)

    monkeypatch.setattr(data, '_observations', commit_between_reads)
    first = cases.row(await report.scope_mail_report(scope))
    second = cases.row(await report.scope_mail_report(scope))
    assert first.queue.states_now['pending'] == 1 and first.accepted_over_observed_accounts.fraction == 0
    assert second.queue.states_now['accepted'] == 1 and second.accepted_over_observed_accounts.fraction == 1


async def fingerprint(db: async_sessionmaker[AsyncSession]) -> str:
    values: dict[str, list[dict[str, object]]] = {}
    models = [preferences.EmailPreference, preferences.EmailPreferenceEvent, preferences.EmailUnsubscribeToken]
    async with db() as session:
        for table in [model.__table__ for model in models] + cases.observer_tests.storage_tests.TABLES:
            result = await session.execute(select(table).order_by(*table.primary_key.columns))
            values[table.name] = [dict(row) for row in result.mappings()]
    return hashlib.sha256(json.dumps(values, sort_keys=True, default=str).encode()).hexdigest()


@pytest.mark.asyncio
async def test_export_preserves_financial_and_consent_fingerprints(
    report_db: async_sessionmaker[AsyncSession],
) -> None:
    scope, _ = await cases.ready(report_db, 'topup_credited', 3)
    before = await cases.observer_tests.source_snapshot(report_db), await fingerprint(report_db)
    for _ in range(3):
        await report.scope_mail_report(scope)
    assert (await cases.observer_tests.source_snapshot(report_db), await fingerprint(report_db)) == before
