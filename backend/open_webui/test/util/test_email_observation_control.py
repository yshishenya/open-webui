"""Replay and closure transactions preserve the run, source facts and journal history."""

import asyncio
import time
from dataclasses import replace

import pytest
from open_webui.models import email_observation as store
from open_webui.models.email_observation_control import close_observation_scope
from open_webui.utils.airis import email_observer as observer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_observer as runner_tests

# Reuse the same real database fixtures and authoritative scenario sources.
database = runner_tests.database
journal_db = runner_tests.journal_db
observed_db = runner_tests.observed_db


async def claim_run(factory: async_sessionmaker[AsyncSession], scope_id: str, now: int) -> store.ObservationClaim:
    async with factory() as session:
        claim = await store.claim_observation_run(session, scope_id, now)
        assert claim
        await session.commit()
        return claim


async def counts(factory: async_sessionmaker[AsyncSession]) -> tuple[int, int]:
    async with factory() as session:
        observations = await session.scalar(select(func.count()).select_from(store.EmailScenarioObservation))
        events = await session.scalar(select(func.count()).select_from(store.EmailDecisionEvent))
        return observations or 0, events or 0


@pytest.mark.asyncio
async def test_lost_response_replay_cannot_advance_or_fail_a_running_page(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    first = await observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    assert first.scanned_members == 1 and not first.completed
    before = await counts(observed_db)
    with pytest.raises(observer.ObservationPageConflict, match='stale_cursor'):
        await observer.observe_scope_page(scope_id, claim=claim, now=now + 3, expected_cursor=0, limit=1)
    assert await counts(observed_db) == before == (6, 6)
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == 1 and run.status == 'running' and run.failure_reason is None
    final = await observer.observe_scope_page(scope_id, claim=claim, now=now + 4, expected_cursor=1, limit=1)
    assert final.completed and final.scanned_members == 2
    with pytest.raises(observer.ObservationPageConflict, match='lease_lost'):
        await observer.observe_scope_page(scope_id, claim=claim, now=now + 5, expected_cursor=1)
    assert await counts(observed_db) == (12, 12)


@pytest.mark.asyncio
async def test_same_owner_concurrent_requests_serialize_before_member_reads(
    observed_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    entered, release = asyncio.Event(), asyncio.Event()
    original = observer._member
    calls = 0

    async def paused_member(
        session: AsyncSession, scope: store.EmailObservationScope, member: store.EmailObservationMember, at: int
    ) -> tuple[store.ObservedMember, bool]:
        nonlocal calls
        calls += 1
        entered.set()
        await release.wait()
        return await original(session, scope, member, at)

    monkeypatch.setattr(observer, '_member', paused_member)
    first = asyncio.create_task(
        observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    )
    await asyncio.wait_for(entered.wait(), 5)
    second = asyncio.create_task(
        observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    )
    try:
        # The second transaction is blocked at the scope lock, before any source reads.
        await asyncio.sleep(0.1)
        assert calls == 1 and not second.done()
    finally:
        release.set()
    results = await asyncio.gather(first, second, return_exceptions=True)
    assert sum(isinstance(r, observer.ObservationPageResult) for r in results) == 1
    assert sum(isinstance(r, observer.ObservationPageConflict) for r in results) == 1
    assert calls == 1 and await counts(observed_db) == (6, 6)
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.status == 'running' and run.cursor == 1 and run.failure_reason is None


@pytest.mark.asyncio
@pytest.mark.parametrize('wrong', ['claim', 'run', 'cursor', 'expired'])
async def test_invalid_page_owner_or_cursor_preserves_run_and_sources(
    observed_db: async_sessionmaker[AsyncSession], wrong: str
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    before = await runner_tests.source_snapshot(observed_db)
    supplied = replace(claim, claim_id='other') if wrong == 'claim' else claim
    if wrong == 'run':
        supplied = replace(claim, run_id='missing')
    at = now + 1 + store.LEASE_SECONDS if wrong == 'expired' else now + 2
    with pytest.raises(observer.ObservationPageConflict):
        await observer.observe_scope_page(
            scope_id, claim=supplied, now=at, expected_cursor=1 if wrong == 'cursor' else 0
        )
    assert await runner_tests.source_snapshot(observed_db) == before
    assert await counts(observed_db) == (0, 0)
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.status == 'running' and run.cursor == 0 and run.claim_id == claim.claim_id


@pytest.mark.asyncio
async def test_timeout_failure_cannot_stop_a_later_saved_cursor(
    observed_db: async_sessionmaker[AsyncSession],
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    await observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    async with observed_db() as session:
        assert not await store.fail_observation_run(session, claim, now + 2, 'observer_error', expected_cursor=0)
        await session.commit()
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.status == 'running' and run.cursor == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('expired', [False, True])
async def test_close_is_repeatable_and_stops_partial_even_expired_run(
    observed_db: async_sessionmaker[AsyncSession], expired: bool
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    first = await observer.observe_scope_page(scope_id, now=now + 1, limit=1)
    assert first.claim
    before = await runner_tests.source_snapshot(observed_db)
    closed_at = now + 1 + store.LEASE_SECONDS if expired else now + 2
    async with observed_db() as session:
        assert await close_observation_scope(session, scope_id, closed_at)
        await session.commit()
    async with observed_db() as session:
        assert await close_observation_scope(session, scope_id, closed_at + 1)
        await session.commit()
    async with observed_db() as session:
        scope = await session.get(store.EmailObservationScope, scope_id)
        run = await session.get(store.EmailObservationRun, first.claim.run_id)
        assert scope and scope.closed_at == closed_at and scope.member_count == 2
        assert run and run.status == 'failed' and run.failure_reason == 'operator_stop' and run.cursor == 1
        assert run.claim_id is None and run.lease_until is None
        assert await store.claim_observation_run(session, scope_id, closed_at + 2) is None
    with pytest.raises(observer.ObservationPageConflict, match='scope_unavailable'):
        await observer.observe_scope_page(scope_id, claim=first.claim, now=closed_at + 3, expected_cursor=1)
    assert await counts(observed_db) == (6, 6)
    assert await runner_tests.source_snapshot(observed_db) == before


@pytest.mark.asyncio
async def test_close_after_completed_keeps_result_and_history(observed_db: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now)
    result = await observer.observe_scope_page(scope_id, now=now + 1)
    assert result.claim and result.completed
    async with observed_db() as session:
        assert await close_observation_scope(session, scope_id, now + 2)
        await session.commit()
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, result.claim.run_id)
        assert run and run.status == 'completed' and run.failure_reason is None
    assert await counts(observed_db) == (6, 6)


@pytest.mark.asyncio
async def test_closure_waits_for_started_page_and_preserves_saved_history(
    observed_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    entered, release = asyncio.Event(), asyncio.Event()
    original = observer._member

    async def paused_member(
        session: AsyncSession, scope: store.EmailObservationScope, member: store.EmailObservationMember, at: int
    ) -> tuple[store.ObservedMember, bool]:
        entered.set()
        await release.wait()
        return await original(session, scope, member, at)

    async def close() -> bool:
        async with observed_db() as session:
            result = await close_observation_scope(session, scope_id, now + 3)
            await session.commit()
            return result

    monkeypatch.setattr(observer, '_member', paused_member)
    page = asyncio.create_task(
        observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    )
    await asyncio.wait_for(entered.wait(), 5)
    closure = asyncio.create_task(close())
    try:
        await asyncio.sleep(0.1)
        assert not closure.done()
    finally:
        release.set()
    saved, closed = await asyncio.gather(page, closure)
    assert saved.scanned_members == 1 and closed
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.cursor == 1 and run.status == 'failed' and run.failure_reason == 'operator_stop'
    assert await counts(observed_db) == (6, 6)


@pytest.mark.asyncio
@pytest.mark.parametrize('target', ['missing', 'dispatch'])
async def test_closure_cannot_touch_other_populations(
    observed_db: async_sessionmaker[AsyncSession], target: str
) -> None:
    now = int(time.time())
    async with observed_db() as session:
        scope_id = 'missing'
        if target == 'dispatch':
            scope_id = await store.declare_scope(
                session,
                ('1',),
                now,
                registrations_from=0,
                registrations_until=now + 1,
                payments_from=0,
                payments_until=now + 1,
                mode='dispatch',
            )
        await session.commit()
    async with observed_db() as session:
        assert not await close_observation_scope(session, scope_id, now + 1)
        await session.commit()
    assert await counts(observed_db) == (0, 0)


@pytest.mark.asyncio
async def test_timed_out_waiter_cannot_fail_the_page_which_held_its_lock(
    observed_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    now = int(time.time())
    scope_id = await runner_tests.scope(observed_db, now, ('1', '2'))
    claim = await claim_run(observed_db, scope_id, now + 1)
    entered, release = asyncio.Event(), asyncio.Event()
    original = observer._member

    async def paused_member(
        session: AsyncSession, scope: store.EmailObservationScope, member: store.EmailObservationMember, at: int
    ) -> tuple[store.ObservedMember, bool]:
        entered.set()
        await release.wait()
        return await original(session, scope, member, at)

    monkeypatch.setattr(observer, '_member', paused_member)
    first = asyncio.create_task(
        observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    )
    await asyncio.wait_for(entered.wait(), 5)
    monkeypatch.setattr(observer, 'PAGE_TIMEOUT_SECONDS', 0.03)
    waiter = asyncio.create_task(
        observer.observe_scope_page(scope_id, claim=claim, now=now + 2, expected_cursor=0, limit=1)
    )
    try:
        await asyncio.sleep(0.1)
        assert not waiter.done()
    finally:
        release.set()
    result, failure = await asyncio.gather(first, waiter, return_exceptions=True)
    assert isinstance(result, observer.ObservationPageResult) and result.scanned_members == 1
    assert isinstance(failure, observer.ObservationPageError)
    async with observed_db() as session:
        run = await session.get(store.EmailObservationRun, claim.run_id)
        assert run and run.status == 'running' and run.cursor == 1 and run.failure_reason is None
    assert await counts(observed_db) == (6, 6)
