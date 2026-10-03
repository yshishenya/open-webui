"""Bounded scheduler work; database permission ends before external SMTP I/O."""

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass

from open_webui.internal.db import get_async_db_context
from open_webui.models.email_delivery import (
    LEASE_SECONDS,
    DeliveryView,
    EmailDelivery,
    claim_email,
    defer_email_capacity,
    finish_email,
    reserve_transport,
)
from open_webui.models.users import User
from open_webui.utils.airis.email_delivery import EmailSendResult
from open_webui.utils.airis.email_eligibility import send_eligibility
from open_webui.utils.airis.email_onboarding import onboarding_context
from open_webui.utils.airis.email_scenarios import (
    EmailQueueConfig,
    ScenarioDecision,
    reconcile_email_candidates,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)
SEND_TIMEOUT_SECONDS = 90
POLL_SECONDS = 300


class TransportCapacityUnavailable(ConnectionError):
    """Safe pre-submission failure; contains no transport or recipient data."""


async def take_transport_capacity(host: str, port: int, username: str, product: bool) -> bool:
    key = hashlib.sha256(f'{host.lower()}:{port}:{username.lower()}'.encode()).hexdigest()
    total = int(os.getenv('AIRIS_EMAIL_SMTP_PER_MINUTE', '60'))
    product_limit = int(os.getenv('AIRIS_EMAIL_PRODUCT_PER_MINUTE', '40'))
    daily_total = int(os.getenv('AIRIS_EMAIL_SMTP_PER_DAY', '100'))
    daily_product = int(os.getenv('AIRIS_EMAIL_PRODUCT_PER_DAY', '50'))
    return await reserve_transport(key, product, total, product_limit, int(time.time()), daily_total, daily_product)


@dataclass(frozen=True)
class Recipient:
    email: str
    name: str
    context: dict[str, str]


async def permission_decision(
    session: AsyncSession,
    user: User | None,
    job: DeliveryView,
    config: EmailQueueConfig,
    expected_email: str | None,
    now: int,
) -> ScenarioDecision:
    """Enforce operator switches before the shared business eligibility reads."""
    from open_webui.utils.email import AIRIS_PRODUCT_EMAILS_ENABLED

    if not user:
        return ScenarioDecision('deleted_account')
    if not config.allows(user.id, job.type) or (job.category == 'product' and not AIRIS_PRODUCT_EMAILS_ENABLED):
        return ScenarioDecision('release_disabled', now + POLL_SECONDS)
    return await send_eligibility(session, user, job, expected_email, now)


async def prepare_email(
    job: DeliveryView,
    config: EmailQueueConfig,
    expected_email: str | None = None,
    expected_context: dict[str, str] | None = None,
) -> Recipient | None:
    """First call starts an attempt; post-AUTH call commits the submitting marker."""
    now = int(time.time())
    async with get_async_db_context() as session:
        user = await session.scalar(select(User).where(User.id == job.user_id).with_for_update())
        now = int(time.time())
        row = await session.scalar(
            select(EmailDelivery)
            .where(
                EmailDelivery.id == job.id,
                EmailDelivery.status == 'claimed',
                EmailDelivery.claim_id == job.claim_id,
                EmailDelivery.lease_until > now,
            )
            .with_for_update()
        )
        if not row:
            return None
        now = int(time.time())
        if row.lease_until <= now:
            return None
        decision = await permission_decision(session, user, job, config, expected_email, now)
        context = {}
        if decision.reason == 'ready':
            context = await onboarding_context(session, user, job, os.getenv('FRONTEND_URL', 'http://localhost:3000'))
            if expected_context is not None and context != expected_context:
                decision = ScenarioDecision('content_changed', now + POLL_SECONDS)
        now = int(time.time())
        if row.expires_at is not None and row.expires_at <= now:
            decision = ScenarioDecision('expired')
        elif row.lease_until <= now:
            return None
        row.reason, row.updated_at = decision.reason if decision.reason != 'ready' else None, now
        if decision.reason != 'ready':
            if decision.defer_until is not None and (row.expires_at is None or decision.defer_until < row.expires_at):
                row.status, row.due_at = 'pending', decision.defer_until
            else:
                row.status = (
                    'expired' if decision.reason == 'expired' or decision.defer_until is not None else 'suppressed'
                )
            row.claim_id, row.lease_until = None, None
            row.retryable = False
            await session.commit()
            return None
        if expected_email is None:
            row.attempts += 1
        else:
            row.submitted_at, row.lease_until = now, now + LEASE_SECONDS
        recipient = Recipient(user.email, user.name, context)
        await session.commit()
        return recipient


async def execute_email(job: DeliveryView, config: EmailQueueConfig) -> None:
    """One transport attempt; durable retry is owned solely by the queue."""
    from open_webui.utils.email import email_service

    recipient = await asyncio.wait_for(prepare_email(job, config), timeout=15)
    if recipient is None:
        return
    # Templates are shipped separately; an unavailable template is a proven-unsent failure.
    try:
        if job.template_version not in {'onboarding_v1', 'credited_v1'}:
            raise ValueError('Unsupported email template version')
        html, text = await asyncio.to_thread(
            email_service.render_template, f'{job.template_version}/{job.type}', **recipient.context
        )
    except Exception as error:
        log.error('Email rendering job=%s error_type=%s', job.id, type(error).__name__)
        await finish_email(job, 'failed', False, int(time.time()))
        return

    async def before_submit() -> bool:
        return (
            await asyncio.wait_for(prepare_email(job, config, recipient.email, recipient.context), timeout=15)
            is not None
        )

    subjects = {
        'welcome': 'Добро пожаловать в AIRIS',
        'activation_24h': 'Первая задача в AIRIS',
        'paid_value_72h': 'Возможности AIRIS для следующей задачи',
        'payment_help_72h': 'Помощь с пополнением AIRIS',
        'feedback_14d': 'Как прошли первые две недели в AIRIS?',
        'topup_credited': 'Баланс AIRIS пополнен',
    }
    try:
        async with asyncio.timeout(SEND_TIMEOUT_SECONDS):
            if job.category == 'product':
                result = await email_service.send_product_email(
                    job.user_id,
                    subjects[job.type],
                    html,
                    text,
                    message_id=job.provider_id,
                    retry_count=1,
                    before_submit=before_submit,
                    expected_email=recipient.email,
                )
            else:
                result = await email_service.send_email_result(
                    recipient.email,
                    subjects[job.type],
                    html,
                    text,
                    retry_count=1,
                    message_id=job.provider_id,
                    before_submit=before_submit,
                )
    except TimeoutError:
        # The persisted marker decides whether a timeout could have submitted DATA.
        async with get_async_db_context() as session:
            row = await session.get(EmailDelivery, job.id)
            submitting = bool(row and row.submitted_at is not None)
        result = EmailSendResult('unknown' if submitting else 'failed', job.provider_id, 1, not submitting)
    if result.status == 'failed' and result.reason == 'TransportCapacityUnavailable':
        await defer_email_capacity(job, int(time.time()))
    else:
        await finish_email(job, result.status, result.retryable, int(time.time()))


async def drain_email_queue(config: EmailQueueConfig) -> None:
    """Keep slow SMTP work out of the shared timer/calendar scheduler."""
    try:
        candidates = await asyncio.wait_for(reconcile_email_candidates(config), timeout=20)
        if config.dry_run:
            log.info('Email dry-run candidates=%s submitted=0', candidates)
            return
        for _ in range(10):
            job = await asyncio.wait_for(claim_email(int(time.time())), timeout=10)
            if job is None:
                break
            await execute_email(job, config)
    except Exception as error:
        log.error('Email queue unavailable error_type=%s', type(error).__name__)


_worker_task: asyncio.Task[None] | None = None


async def process_email_queue_if_due(next_run: float, now: float) -> float:
    global _worker_task
    if now < next_run:
        return next_run
    try:
        config = EmailQueueConfig.from_env()
    except ValueError:
        log.error('Invalid email queue configuration')
        return now + POLL_SECONDS
    if config.enabled and (_worker_task is None or _worker_task.done()):
        _worker_task = asyncio.create_task(drain_email_queue(config))
    return now + POLL_SECONDS
