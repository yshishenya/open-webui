"""PAYG mail and final-content decisions reuse the durable queue fixtures."""

import time

import pytest
from open_webui.models import email_delivery as journal
from open_webui.models.billing_wallet import LedgerEntry, Payment
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils.airis import email_queue as worker
from open_webui.utils.airis import email_scenarios as scenarios
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from test.util import test_email_delivery_queue as queue_tests
from test.util.test_email_delivery_queue import config, enqueue, payment_fact

database = queue_tests.database


@pytest.mark.asyncio
async def test_late_credit_from_earlier_attempt_cancels_help(database: async_sessionmaker[AsyncSession]) -> None:
    now = int(time.time())
    await payment_fact(database, 'failed-newer', 'canceled', now - 3 * scenarios.DAY)
    await payment_fact(database, 'initiated-earlier', 'succeeded', now - 5 * scenarios.DAY, credit=True)
    async with database() as db:
        await db.execute(
            update(LedgerEntry).where(LedgerEntry.id == 'credit-initiated-earlier').values(created_at=now - 60)
        )
        job_id = await journal.enqueue_email(
            db, '1', 'payment_help_72h', 'failed-newer', now, now + 60, payment_id='failed-newer'
        )
        await db.commit()
    job = await journal.claim_email(now)
    assert job.id == job_id
    assert await worker.prepare_email(job, config()) is None
    assert (await queue_tests.state(database, job_id)).reason == 'credited'


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'status,provider_status', [('failed', 'create_failed'), ('canceled', None), ('pending', 'creating')]
)
async def test_unverified_failure_is_not_help_and_blocks_generic_paid_mail(
    database: async_sessionmaker[AsyncSession], status: str, provider_status: str | None
) -> None:
    now = int(time.time())
    await payment_fact(database, 'unconfirmed', status, now - 3 * scenarios.DAY)
    async with database() as db:
        await db.execute(
            update(Payment)
            .where(Payment.id == 'unconfirmed')
            .values(status_details={'yookassa_status': provider_status})
        )
        db.add(
            TaskSuccess(
                user_id='1', operation_id='activated', kind='foreground_chat', source='saved_chat', completed_at=now
            )
        )
        await db.commit()
        assert await scenarios.latest_help_payment(db, '1', now) is None
    job_id = await enqueue(database, 'paid_value_72h')
    job = await journal.claim_email(now)
    assert job.id == job_id
    assert await worker.prepare_email(job, config()) is None
    assert (await queue_tests.state(database, job_id)).reason == 'payment_priority'


@pytest.mark.asyncio
async def test_service_notice_uses_exact_credit_and_mail_failure_cannot_change_money(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    from unittest.mock import AsyncMock, Mock

    import aiosmtplib
    from open_webui.models import email_preferences as prefs
    from open_webui.utils import email

    now = int(time.time())
    await payment_fact(database, 'exact-credit', 'succeeded', now - 10, credit=True)
    async with database() as db:
        for model in [Payment, LedgerEntry]:
            await db.execute(update(model).where(model.user_id == '1').values(amount_kopeks=50001))
        await db.commit()
    await prefs.set_product_preference('1', False, 'settings')
    await scenarios.reconcile_email_candidates(config())
    service = email.EmailService()
    service.reply_to = 'support@airis.you'
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    smtp = AsyncMock()
    smtp.close = Mock()
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPDataError(550, 'test rejection')
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'email_service', service)
    job = await journal.claim_email(now)
    assert job.type == 'topup_credited'
    await worker.execute_email(job, config())
    msg = smtp.send_message.call_args.args[0]
    text = msg.get_payload(0).get_payload(decode=True).decode()
    assert '500,01 RUB' in text and '/billing/history?filter=topups' in text
    assert 'не заменяет фискальный чек' in text and msg['Reply-To'] == 'support@airis.you'
    assert msg['List-Unsubscribe'] is None and 'Отписаться' not in text
    assert not any(word in text for word in ['тариф', 'подписк', 'следующее списание', 'Пополнить ещё'])
    async with database() as db:
        assert (await db.get(Payment, 'exact-credit')).amount_kopeks == 50001
        assert (await db.get(LedgerEntry, 'credit-exact-credit')).amount_kopeks == 50001
        assert (await db.get(journal.EmailDelivery, job.id)).status == 'failed'


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['success', 'credit'])
async def test_feedback_changed_during_auth_is_unsent_then_renders_current_facts(
    database: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, change: str
) -> None:
    from unittest.mock import AsyncMock, Mock

    from open_webui.utils import email

    now = int(time.time())
    async with database() as db:
        await db.execute(
            update(User).where(User.id == '1').values(created_at=now - 14 * scenarios.DAY, name='<script>')
        )
        await db.commit()
    job_id = await enqueue(database, 'feedback_14d')
    service = email.EmailService()
    service.reply_to = 'support@airis.you'
    service.smtp_host, service.smtp_username, service.smtp_password = 'smtp.invalid', 'test', 'unused'
    smtp = AsyncMock()
    smtp.close = Mock()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(email, 'email_service', service)

    async def changed_auth() -> AsyncMock:
        if change == 'credit':
            await payment_fact(database, 'during-auth', 'succeeded', now, credit=True)
        else:
            async with database() as db:
                db.add(
                    TaskSuccess(
                        user_id='1',
                        operation_id='during-auth',
                        kind='foreground_chat',
                        source='saved_chat',
                        completed_at=now,
                    )
                )
                await db.commit()
        return smtp

    service._create_connection = changed_auth
    await worker.execute_email(await journal.claim_email(now), config())
    row = await queue_tests.state(database, job_id)
    assert row.status == 'pending' and row.reason == 'content_changed' and row.submitted_at is None
    smtp.send_message.assert_not_awaited()
    service._create_connection = AsyncMock(return_value=smtp)
    monkeypatch.setattr(worker.time, 'time', lambda: row.due_at)
    await worker.execute_email(await journal.claim_email(row.due_at), config())
    smtp.send_message.assert_awaited_once()
    msg = smtp.send_message.call_args.args[0]
    text = msg.get_payload(0).get_payload(decode=True).decode()
    html = msg.get_payload(1).get_payload(decode=True).decode()
    assert '<script>' not in html and '&lt;script&gt;' in html
    assert msg['List-Unsubscribe-Post'] == 'List-Unsubscribe=One-Click'
    assert msg['Reply-To'] == 'support@airis.you'
    assert ('Что удалось сделать' in text) == (change == 'success')
    assert ('После пополнения' in text) == (change == 'credit')
    assert (await queue_tests.state(database, job_id)).status == 'accepted'


def test_b_templates_have_both_formats_and_do_not_reuse_checkout() -> None:
    from open_webui.utils import email

    service = email.EmailService()
    service.reply_to = 'support@airis.you'
    for kind in ['paid_value_72h', 'payment_help_72h']:
        context = dict(
            name='<script>',
            guide_url='https://chat.airis.you/guide',
            history_url='https://chat.airis.you/billing/history?filter=topups',
            pricing_url='https://chat.airis.you/pricing#calculation',
            paid_example_url='https://chat.airis.you/guide#costs',
        )
        html, text = service.render_template('onboarding_v1/' + kind, **context)
        assert '<script>' not in html and '&lt;script&gt;' in html and '<script>' in text
        assert 'support@airis.you' in text and 'checkout' not in text and 'confirmation_url' not in html
        if kind == 'payment_help_72h':
            assert 'Не платите повторно' in text and 'отмене этой попытки' in text
        else:
            assert 'не гарантирует' in text and 'не оплачивает' in text and '/pricing#calculation' in text
