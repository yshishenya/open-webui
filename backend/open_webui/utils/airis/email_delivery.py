"""SMTP outcomes distinguish acceptance from failure and uncertain submission."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from typing import Literal

import aiosmtplib
from aiosmtplib.errors import (
    SMTPNotSupported,
    SMTPRecipientsRefused,
    SMTPResponseException,
)

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailSendResult:
    status: Literal['accepted', 'failed', 'unknown']
    message_id: str
    attempts: int


def _refusal_codes(error: Exception) -> list[int]:
    if isinstance(error, SMTPRecipientsRefused):
        return [recipient.code for recipient in error.recipients]
    if isinstance(error, SMTPResponseException):
        return [error.code]
    return []


def _failure_status(error: Exception, submitting: bool) -> Literal['failed', 'unknown']:
    codes = _refusal_codes(error)
    if not submitting or (codes and all(400 <= code < 600 for code in codes)):
        return 'failed'
    if isinstance(error, (SMTPNotSupported, ValueError)):
        return 'failed'
    # send_message has no reliable DATA phase for a timeout/disconnect.
    return 'unknown'


def _can_retry(error: Exception, submitting: bool) -> bool:
    codes = _refusal_codes(error)
    if codes:
        return all(400 <= code < 500 for code in codes)
    return not submitting and isinstance(error, (ConnectionError, TimeoutError))


async def submit_smtp_message(
    create_connection: Callable[[], Awaitable[aiosmtplib.SMTP]],
    message: MIMEMultipart,
    retry_count: int,
    retry_delay: int,
    before_submit: Callable[[], Awaitable[bool]] | None = None,
) -> EmailSendResult:
    """Retry proven temporary failures, never cleanup or uncertain acceptance.

    A single message and Message-ID are reused across all attempts. Accepted
    means the SMTP server accepted submission, not delivery to the Inbox.
    """
    message_id = str(message['Message-ID'])
    for attempt in range(1, retry_count + 1):
        smtp: aiosmtplib.SMTP | None = None
        submitting = False
        retry = False
        result = EmailSendResult('failed', message_id, attempt)
        try:
            smtp = await create_connection()
            if before_submit is not None and not await before_submit():
                return result
            submitting = True
            await smtp.send_message(message)
            result = EmailSendResult('accepted', message_id, attempt)
        except Exception as error:
            status = _failure_status(error, submitting)
            result = EmailSendResult(status, message_id, attempt)
            retry = status == 'failed' and _can_retry(error, submitting)
            log.warning(
                'SMTP submission %s attempt=%d error_type=%s',
                status,
                attempt,
                type(error).__name__,
            )
        finally:
            if smtp is not None:
                try:
                    await smtp.quit()
                except Exception as error:
                    log.warning('SMTP cleanup failed error_type=%s', type(error).__name__)
                finally:
                    smtp.close()

        if not retry or attempt == retry_count:
            return result
        await asyncio.sleep(retry_delay * 2 ** (attempt - 1))

    return EmailSendResult('failed', message_id, 0)
