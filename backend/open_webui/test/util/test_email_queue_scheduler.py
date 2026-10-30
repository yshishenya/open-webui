"""Preserve scheduler clock alignment and independently polled email work."""

import asyncio
import datetime as dt
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from open_webui.models import email_preferences, task_success
from open_webui.utils import automations, timers
from open_webui.utils.airis import email_queue


@pytest.mark.parametrize('frequency,seconds', [('SECONDLY', 5), ('MINUTELY', 300), ('HOURLY', 18000)])
@pytest.mark.asyncio
async def test_subdaily_rule_alignment(frequency: str, seconds: int) -> None:
    now = dt.datetime.now(dt.UTC)
    assert await automations.next_run_ns(f'FREQ={frequency};INTERVAL=5', 'UTC') is not None
    runs = await automations.next_n_runs_ns(f'FREQ={frequency};INTERVAL=5', 3, 'UTC')
    assert len(runs) == 3 and runs == sorted(runs)
    epoch = dt.datetime(2000, 1, 1, tzinfo=dt.UTC)
    dates = [dt.datetime.fromtimestamp(run / 1_000_000_000, dt.UTC) for run in runs]
    assert dates[0] > now
    assert all(int((date - epoch).total_seconds()) % seconds == 0 for date in dates)
    assert all((later - earlier).total_seconds() == seconds for earlier, later in zip(dates, dates[1:]))
    assert await automations.rrule_interval_seconds(f'FREQ={frequency};INTERVAL=5') == seconds


@pytest.mark.asyncio
async def test_email_poll_runs_with_user_features_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    queue = AsyncMock(return_value=300.0)
    cleanup = AsyncMock(return_value=300.0)
    success = AsyncMock(return_value=300.0)
    timer = AsyncMock(return_value=[])
    monkeypatch.setattr(email_queue, 'process_email_queue_if_due', queue)
    monkeypatch.setattr(email_preferences, 'cleanup_product_email_if_due', cleanup)
    monkeypatch.setattr(task_success, 'reconcile_success_if_due', success)
    monkeypatch.setattr(timers, 'claim_due_timers', timer)
    monkeypatch.setattr(automations.Config, 'get', AsyncMock(return_value=False))
    monkeypatch.setattr(automations.asyncio, 'sleep', AsyncMock(side_effect=asyncio.CancelledError))
    with pytest.raises(asyncio.CancelledError):
        await automations.scheduler_worker_loop(FastAPI())
    queue.assert_awaited_once()
    cleanup.assert_awaited_once()
    success.assert_awaited_once()
    timer.assert_awaited_once()


@pytest.mark.asyncio
async def test_feature_poll_keeps_calendar_after_automation_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(automations.Config, 'get', AsyncMock(return_value=True))
    monkeypatch.setattr(automations.Automations, 'claim_due', AsyncMock(side_effect=RuntimeError('test failure')))
    calendar = AsyncMock()
    monkeypatch.setattr(automations, '_check_calendar_alerts', calendar)
    await automations._process_scheduled_features(FastAPI())
    calendar.assert_awaited_once()
