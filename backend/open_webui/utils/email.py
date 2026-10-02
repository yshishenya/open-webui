"""
Email Service - SMTP integration for transactional emails

This module provides email sending capabilities using configured SMTP service with:
- HTML and plain text email templates
- Retry logic with exponential backoff
- Explicit accepted, failed and unknown submission results
- Template rendering for Russian language
- Async operations using aiosmtplib
"""

import logging
import os
from collections.abc import Awaitable, Callable
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from html import escape
from urllib.parse import urlsplit

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape
from open_webui.env import OPEN_WEBUI_DIR
from open_webui.utils.airis.email_delivery import EmailSendResult, guard_smtp_submission, submit_smtp_message

log = logging.getLogger(__name__)

####################################
# Email Configuration
####################################

# SMTP configuration (Mailu in the current production deployment)
SMTP_HOST = os.getenv('SMTP_HOST', '')
SMTP_PORT = int(os.getenv('SMTP_PORT', '25'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'noreply@example.com')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Airis')
SMTP_REPLY_TO = os.getenv('SMTP_REPLY_TO', '')
AIRIS_PRODUCT_EMAILS_ENABLED = os.getenv('AIRIS_PRODUCT_EMAILS_ENABLED', 'false').lower() == 'true'

EMAIL_VERIFICATION_EXPIRY_HOURS = int(os.getenv('EMAIL_VERIFICATION_EXPIRY_HOURS', '24'))
PASSWORD_RESET_EXPIRY_HOURS = int(os.getenv('PASSWORD_RESET_EXPIRY_HOURS', '2'))
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

####################################
# Template Engine Setup
####################################

# Setup Jinja2 environment for email templates
template_dir = OPEN_WEBUI_DIR / 'templates' / 'email'
template_dir.mkdir(parents=True, exist_ok=True)

jinja_env = Environment(
    loader=FileSystemLoader(str(template_dir)),
    autoescape=select_autoescape(['html', 'xml']),
    trim_blocks=True,
    lstrip_blocks=True,
)

####################################
# Email Sending Functions
####################################


class EmailService:
    """Email service for sending transactional emails via SMTP"""

    def __init__(self) -> None:
        self.smtp_host = SMTP_HOST
        self.smtp_port = SMTP_PORT
        self.smtp_username = SMTP_USERNAME
        self.smtp_password = SMTP_PASSWORD
        self.smtp_use_tls = SMTP_USE_TLS
        self.from_email = SMTP_FROM_EMAIL
        self.from_name = SMTP_FROM_NAME
        self.reply_to = SMTP_REPLY_TO

    def is_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return bool(self.smtp_host and self.smtp_port and self.smtp_username and self.smtp_password)

    async def _create_connection(self) -> aiosmtplib.SMTP:
        """Create async SMTP connection with error handling"""
        smtp = aiosmtplib.SMTP(
            hostname=self.smtp_host,
            port=self.smtp_port,
            timeout=10,
            start_tls=self.smtp_use_tls,
        )
        try:
            await smtp.connect()

            if self.smtp_username and self.smtp_password:
                await smtp.login(self.smtp_username, self.smtp_password)

            return smtp
        except BaseException:
            # Includes cancellation during connect/AUTH; no message was submitted.
            smtp.close()
            raise

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        retry_count: int = 3,
        retry_delay: int = 2,
    ) -> bool:
        """Return True for SMTP acceptance. False includes unknown submission.

        Durable callers must use send_email_result to distinguish unknown from
        proven failure and must not retry False blindly.
        """
        result = await self.send_email_result(to_email, subject, html_content, text_content, retry_count, retry_delay)
        return result.status == 'accepted'

    async def send_email_result(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        retry_count: int = 3,
        retry_delay: int = 2,
        *,
        message_id: str | None = None,
        unsubscribe_url: str | None = None,
        before_submit: Callable[[], Awaitable[bool]] | None = None,
        product: bool = False,
    ) -> EmailSendResult:
        """
        Submit email, returning accepted, failed or unknown (async).

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content (optional)
            retry_count: Maximum total attempts, including the first
            retry_delay: Initial delay between retries in seconds
            message_id: Stable identity supplied by a durable queue (optional)

        Returns:
            SMTP submission result. Acceptance does not prove recipient delivery.
        """
        if not self.is_configured():
            log.error('SMTP is not configured. Cannot send email.')
            return EmailSendResult('failed', message_id or '', 0)

        headers = (
            to_email,
            subject,
            self.from_email,
            self.from_name,
            self.reply_to,
            message_id or '',
            unsubscribe_url or '',
        )
        if any('\r' in value or '\n' in value for value in headers) or retry_count < 1 or retry_delay < 0:
            log.warning('SMTP submission failed: invalid headers or retry settings')
            return EmailSendResult('failed', '', 0)
        if message_id is not None and (
            not message_id.startswith('<') or not message_id.endswith('>') or any(c.isspace() for c in message_id)
        ):
            log.warning('SMTP submission failed: invalid Message-ID')
            return EmailSendResult('failed', '', 0)

        if unsubscribe_url is not None:
            parsed = urlsplit(unsubscribe_url)
            if (
                parsed.scheme != 'https'
                or not parsed.netloc
                or parsed.username
                or any(c.isspace() for c in unsubscribe_url)
            ):
                return EmailSendResult('failed', '', 0)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = formataddr((self.from_name, self.from_email))
        msg['To'] = to_email
        msg['Date'] = formatdate(usegmt=True)
        msg['Message-ID'] = message_id or make_msgid(domain=self.from_email.rsplit('@', 1)[-1])
        if self.reply_to:
            msg['Reply-To'] = self.reply_to

        if unsubscribe_url:
            msg['List-Unsubscribe'] = f'<{unsubscribe_url}>'
            msg['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'

        # Add plain text version if provided
        if text_content:
            part1 = MIMEText(text_content, 'plain', 'utf-8')
            msg.attach(part1)

        # Add HTML version
        part2 = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part2)

        async def submission_gate() -> bool:
            return await guard_smtp_submission(
                self.smtp_host, self.smtp_port, self.smtp_username, product, before_submit
            )

        return await submit_smtp_message(self._create_connection, msg, retry_count, retry_delay, submission_gate)

    def render_template(self, template_name: str, **context: object) -> tuple[str, str]:
        """
        Render email template (both HTML and text versions)

        Args:
            template_name: Name of template file (without extension)
            **context: Template context variables

        Returns:
            Tuple of (html_content, text_content)
        """
        context['support_reply_to'] = self.reply_to
        try:
            # Render HTML template
            html_template = jinja_env.get_template(f'{template_name}.html')
            html_content = html_template.render(**context)

            # Try to render text template, fallback to basic text version
            try:
                text_template = jinja_env.get_template(f'{template_name}.txt')
                text_content = text_template.render(**context)
            except Exception:
                # Fallback: basic text version from HTML (strip tags)
                import re

                text_content = re.sub(r'<[^>]+>', '', html_content)

            return html_content, text_content
        except Exception as e:
            log.error(f'Failed to render template {template_name}: {e}')
            raise

    async def send_verification_email(self, to_email: str, name: str, verification_token: str) -> bool:
        """
        Send email verification email (async)

        Args:
            to_email: User email address
            name: User name
            verification_token: Verification token

        Returns:
            True if sent successfully
        """
        verification_url = f'{FRONTEND_URL}/verify-email?token={verification_token}'

        html_content, text_content = self.render_template(
            'verification',
            name=name,
            verification_url=verification_url,
            expiry_hours=EMAIL_VERIFICATION_EXPIRY_HOURS,
        )

        return await self.send_email(
            to_email=to_email,
            subject='Подтвердите ваш email',
            html_content=html_content,
            text_content=text_content,
        )

    async def send_product_email(
        self,
        user_id: str,
        subject: str,
        html_content: str,
        text_content: str,
        *,
        message_id: str | None = None,
        retry_count: int = 3,
        before_submit: Callable[[], Awaitable[bool]] | None = None,
        expected_email: str | None = None,
    ) -> EmailSendResult:
        """Every optional product message checks server-owned consent before each SMTP attempt."""
        from open_webui.models.email_preferences import create_product_unsubscribe_token, product_email_allowed
        from open_webui.models.users import Users

        if not AIRIS_PRODUCT_EMAILS_ENABLED:
            return EmailSendResult('failed', message_id or '', 0)
        user = await Users.get_user_by_id(user_id)
        if not user:
            return EmailSendResult('failed', message_id or '', 0)
        if expected_email is not None and user.email != expected_email:
            return EmailSendResult('failed', message_id or '', 0)
        token = await create_product_unsubscribe_token(user_id)
        if not token:
            return EmailSendResult('failed', message_id or '', 0)
        base = FRONTEND_URL.rstrip('/')
        footer_url = f'{base}/unsubscribe#token={token}'
        one_click_url = f'{base}/api/v1/email-preferences/one-click/{token}'
        html_content += (
            '<p>Вы получили это письмо по вашему согласию на продуктовые письма AIRIS. '
            f'<a href="{escape(footer_url, quote=True)}">Отписаться</a>.</p>'
        )
        text_content += (
            f'\n\nВы получили это письмо по вашему согласию на продуктовые письма AIRIS. Отписаться: {footer_url}\n'
        )

        async def still_allowed() -> bool:
            return await product_email_allowed(user_id, user.email) and (before_submit is None or await before_submit())

        return await self.send_email_result(
            user.email,
            subject,
            html_content,
            text_content,
            message_id=message_id,
            retry_count=retry_count,
            unsubscribe_url=one_click_url,
            before_submit=still_allowed,
            product=True,
        )

    async def send_welcome_email(self, user_id: str) -> bool:
        """Queue a welcome; True means queued, never transport acceptance."""
        from open_webui.utils.airis.email_scenarios import queue_welcome

        return await queue_welcome(user_id)

    async def send_password_reset_email(self, to_email: str, name: str, reset_token: str) -> bool:
        """
        Send password reset email (async)

        Args:
            to_email: User email address
            name: User name
            reset_token: Password reset token

        Returns:
            True if sent successfully
        """
        reset_url = f'{FRONTEND_URL}/reset-password?token={reset_token}'

        html_content, text_content = self.render_template(
            'password_reset',
            name=name,
            reset_url=reset_url,
            expiry_hours=PASSWORD_RESET_EXPIRY_HOURS,
        )

        return await self.send_email(
            to_email=to_email,
            subject='Сброс пароля',
            html_content=html_content,
            text_content=text_content,
        )

    async def send_password_changed_email(self, to_email: str, name: str) -> bool:
        """
        Send password changed confirmation email (async)

        Args:
            to_email: User email address
            name: User name

        Returns:
            True if sent successfully
        """
        html_content, text_content = self.render_template(
            'password_changed',
            name=name,
            support_url=f'{FRONTEND_URL}/support',
        )

        return await self.send_email(
            to_email=to_email,
            subject='Ваш пароль был изменен',
            html_content=html_content,
            text_content=text_content,
        )

    async def send_payment_confirmation_email(
        self,
        to_email: str,
        name: str,
        plan_name: str,
        transaction_id: str,
        payment_date: str,
        next_payment_date: str,
        amount: str,
        currency: str = 'RUB',
    ) -> bool:
        """
        Send payment confirmation email (async)

        Args:
            to_email: User email address
            name: User name
            plan_name: Name of the billing plan
            transaction_id: Payment transaction ID
            payment_date: Date of payment
            next_payment_date: Date of next scheduled payment
            amount: Payment amount
            currency: Currency code (default RUB)

        Returns:
            True if sent successfully
        """
        html_content, text_content = self.render_template(
            'payment_confirmation',
            name=name,
            plan_name=plan_name,
            transaction_id=transaction_id,
            payment_date=payment_date,
            next_payment_date=next_payment_date,
            amount=amount,
            currency=currency,
            dashboard_url=f'{FRONTEND_URL}/',
        )

        return await self.send_email(
            to_email=to_email,
            subject='Подтверждение оплаты',
            html_content=html_content,
            text_content=text_content,
        )

    async def send_subscription_activated_email(
        self,
        to_email: str,
        name: str,
        plan_name: str,
        features: list[str],
        expires_at: str,
    ) -> bool:
        """
        Send subscription activated email (async)

        Args:
            to_email: User email address
            name: User name
            plan_name: Name of the billing plan
            features: List of plan features
            expires_at: Subscription expiration date

        Returns:
            True if sent successfully
        """
        html_content, text_content = self.render_template(
            'subscription_activated',
            name=name,
            plan_name=plan_name,
            features=features,
            expires_at=expires_at,
            dashboard_url=f'{FRONTEND_URL}/',
        )

        return await self.send_email(
            to_email=to_email,
            subject=f'Подписка {plan_name} активирована',
            html_content=html_content,
            text_content=text_content,
        )

    async def send_quota_alert_email(
        self,
        to_email: str,
        name: str,
        quota_type: str,
        used: int,
        limit: int,
        quota_unit: str = 'запросов',
        reset_period: str = 'ежемесячно',
    ) -> bool:
        """
        Send quota usage alert email (async)

        Args:
            to_email: User email address
            name: User name
            quota_type: Type of quota (e.g., "API запросы", "Токены")
            used: Current usage amount
            limit: Maximum quota limit
            quota_unit: Unit of measurement
            reset_period: When quotas reset

        Returns:
            True if sent successfully
        """
        usage_percent = min(int((used / limit) * 100), 100) if limit and limit > 0 else 100

        html_content, text_content = self.render_template(
            'quota_alert',
            name=name,
            quota_type=quota_type,
            used=used,
            limit=limit,
            quota_unit=quota_unit,
            usage_percent=usage_percent,
            reset_period=reset_period,
            upgrade_url=f'{FRONTEND_URL}/pricing',
        )

        return await self.send_email(
            to_email=to_email,
            subject=f'Внимание: {quota_type} израсходовано на {usage_percent}%',
            html_content=html_content,
            text_content=text_content,
        )


# Singleton instance
email_service = EmailService()
