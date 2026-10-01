import asyncio
from email.utils import parsedate_to_datetime
from unittest.mock import AsyncMock, Mock

import aiosmtplib
import pytest
from open_webui.utils.email import EmailService


@pytest.fixture
def service() -> EmailService:
    instance = EmailService()
    instance.smtp_host = 'mail.example.test'
    instance.smtp_port = 587
    instance.smtp_username = 'sender@example.test'
    instance.smtp_password = 'secret-password'
    instance.from_email = 'sender@example.test'
    instance.from_name = 'Airis'
    instance.reply_to = ''
    return instance


@pytest.fixture
def smtp(service: EmailService) -> AsyncMock:
    connection = AsyncMock()
    connection.send_message.return_value = ({}, 'queued')
    connection.close = Mock()
    service._create_connection = AsyncMock(return_value=connection)
    return connection


@pytest.mark.asyncio
async def test_standard_headers(service: EmailService, smtp: AsyncMock) -> None:
    assert await service.send_email('recipient@example.test', 'Тест', '<p>Тест</p>', 'Тест')
    message = smtp.send_message.await_args.args[0]
    assert parsedate_to_datetime(message['Date']).utcoffset().total_seconds() == 0
    assert message['Message-ID'].endswith('@example.test>')
    assert message['From'] == 'Airis <sender@example.test>'
    assert [part.get_content_type() for part in message.get_payload()] == [
        'text/plain',
        'text/html',
    ]


@pytest.mark.asyncio
async def test_quit_error_does_not_resend(service: EmailService, smtp: AsyncMock) -> None:
    smtp.quit.side_effect = RuntimeError('closed after acceptance')
    assert await service.send_email('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    smtp.send_message.assert_awaited_once()
    service._create_connection.assert_awaited_once()


@pytest.mark.asyncio
async def test_ambiguous_timeout_does_not_resend(service: EmailService, smtp: AsyncMock) -> None:
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPReadTimeoutError('recipient@example.test secret-password')
    assert not await service.send_email('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    smtp.send_message.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'error',
    [
        aiosmtplib.errors.SMTPReadTimeoutError('timeout'),
        ConnectionError('lost'),
        RuntimeError('unknown'),
    ],
)
async def test_unknown_outcome(service: EmailService, smtp: AsyncMock, error: Exception) -> None:
    smtp.send_message.side_effect = error
    result = await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    assert result.status == 'unknown'
    assert result.attempts == 1
    smtp.send_message.assert_awaited_once()
    smtp.quit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('code, expected_attempts', [(451, 3), (550, 1)])
async def test_explicit_refusal(service: EmailService, smtp: AsyncMock, code: int, expected_attempts: int) -> None:
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPDataError(code, 'refused')
    result = await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    assert result.status == 'failed'
    assert result.attempts == expected_attempts
    assert smtp.send_message.await_count == expected_attempts
    assert smtp.quit.await_count == expected_attempts


@pytest.mark.asyncio
@pytest.mark.parametrize('code, expected_attempts', [(450, 3), (550, 1)])
async def test_recipient_refusal(service: EmailService, smtp: AsyncMock, code: int, expected_attempts: int) -> None:
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPRecipientsRefused(
        [aiosmtplib.errors.SMTPRecipientRefused(code, 'refused', 'recipient@example.test')]
    )
    result = await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    assert result.status == 'failed'
    assert result.attempts == expected_attempts


@pytest.mark.asyncio
async def test_connect_failure_retries_before_sending(
    service: EmailService, smtp: AsyncMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    service._create_connection.side_effect = [ConnectionError('unavailable'), smtp]
    sleep = AsyncMock()
    monkeypatch.setattr('open_webui.utils.airis.email_delivery.asyncio.sleep', sleep)
    result = await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=2)
    assert result.status == 'accepted'
    assert result.attempts == 2
    sleep.assert_awaited_once_with(2)
    smtp.send_message.assert_awaited_once()


@pytest.mark.asyncio
async def test_retry_reuses_message_id(service: EmailService, smtp: AsyncMock) -> None:
    smtp.send_message.side_effect = [
        aiosmtplib.errors.SMTPDataError(451, 'try later'),
        ({}, 'queued'),
    ]
    result = await service.send_email_result(
        'recipient@example.test',
        'Test',
        '<p>Test</p>',
        retry_delay=0,
        message_id='<delivery-123@example.test>',
    )
    assert result.status == 'accepted'
    assert result.message_id == '<delivery-123@example.test>'
    assert [call.args[0]['Message-ID'] for call in smtp.send_message.await_args_list] == [result.message_id] * 2


@pytest.mark.asyncio
async def test_reply_to(service: EmailService, smtp: AsyncMock) -> None:
    service.reply_to = 'help@example.test'
    assert await service.send_email('recipient@example.test', 'Test', '<p>Test</p>')
    assert smtp.send_message.await_args.args[0]['Reply-To'] == 'help@example.test'


@pytest.mark.parametrize(
    'template',
    [
        'verification',
        'welcome',
        'password_reset',
        'password_changed',
        'payment_confirmation',
        'subscription_activated',
        'quota_alert',
    ],
)
def test_reply_guidance_requires_configured_address(service: EmailService, template: str) -> None:
    for reply_to in ['', 'help@example.test']:
        service.reply_to = reply_to
        for content in service.render_template(template, name='Тест', features=[]):
            assert ('Если нужна помощь, ответьте на это письмо.' in content) == bool(reply_to)
            assert 'не отвечайте' not in content


@pytest.mark.asyncio
@pytest.mark.parametrize('field', ['subject', 'to_email', 'reply_to', 'message_id'])
async def test_header_injection_rejected(service: EmailService, smtp: AsyncMock, field: str) -> None:
    arguments = {
        'to_email': 'recipient@example.test',
        'subject': 'Test',
        'html_content': '<p>Test</p>',
    }
    if field == 'reply_to':
        service.reply_to = 'help@example.test\r\nBcc: other@example.test'
    else:
        arguments[field] = 'value\r\nBcc: other@example.test'
    result = await service.send_email_result(**arguments)
    assert result.status == 'failed'
    assert result.attempts == 0
    service._create_connection.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_auth_closes_connection(service: EmailService, monkeypatch: pytest.MonkeyPatch) -> None:
    connection = AsyncMock()
    connection.close = Mock()
    connection.login.side_effect = aiosmtplib.errors.SMTPAuthenticationError(535, 'secret-password')
    monkeypatch.setattr('open_webui.utils.email.aiosmtplib.SMTP', Mock(return_value=connection))
    result = await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>', retry_delay=0)
    assert result.status == 'failed'
    assert result.attempts == 1
    connection.close.assert_called_once()
    connection.send_message.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancellation_closes_connection(service: EmailService, smtp: AsyncMock) -> None:
    smtp.send_message.side_effect = asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        await service.send_email_result('recipient@example.test', 'Test', '<p>Test</p>')
    smtp.quit.assert_awaited_once()
    smtp.send_message.assert_awaited_once()


@pytest.mark.asyncio
async def test_error_logs_do_not_expose_smtp_data(
    service: EmailService, smtp: AsyncMock, caplog: pytest.LogCaptureFixture
) -> None:
    smtp.send_message.side_effect = aiosmtplib.errors.SMTPReadTimeoutError('recipient@example.test secret-password')
    await service.send_email_result('recipient@example.test', 'Test', '<p>private body</p>')
    assert 'unknown' in caplog.text.lower()
    assert 'recipient@example.test' not in caplog.text
    assert 'secret-password' not in caplog.text
    assert 'private body' not in caplog.text
