"""
Email Service - SMTP integration with Postal for transactional emails

This module provides email sending capabilities using Postal SMTP service with:
- HTML and plain text email templates
- Retry logic with exponential backoff
- Rate limiting integration
- Template rendering for Russian language
- Async operations using aiosmtplib
"""

import asyncio
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from typing import Optional, List, Tuple
import logging

from jinja2 import Environment, FileSystemLoader, select_autoescape
from open_webui.env import OPEN_WEBUI_DIR
import os

log = logging.getLogger(__name__)

####################################
# Email Configuration
####################################

# Postal SMTP configuration
SMTP_HOST = os.getenv('SMTP_HOST', '')
SMTP_PORT = int(os.getenv('SMTP_PORT', '25'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'noreply@example.com')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Airis')

EMAIL_VERIFICATION_EXPIRY_HOURS = int(os.getenv('EMAIL_VERIFICATION_EXPIRY_HOURS', '24'))
PASSWORD_RESET_EXPIRY_HOURS = int(os.getenv('PASSWORD_RESET_EXPIRY_HOURS', '2'))
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

####################################
# Template Engine Setup
####################################

# Setup Jinja2 environment for email templates
template_dir = OPEN_WEBUI_DIR / "templates" / "email"
template_dir.mkdir(parents=True, exist_ok=True)

jinja_env = Environment(
    loader=FileSystemLoader(str(template_dir)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

####################################
# Email Sending Functions
####################################


class EmailService:
    """Email service for sending transactional emails via SMTP"""

    def __init__(self):
        self.smtp_host = SMTP_HOST
        self.smtp_port = SMTP_PORT
        self.smtp_username = SMTP_USERNAME
        self.smtp_password = SMTP_PASSWORD
        self.smtp_use_tls = SMTP_USE_TLS
        self.from_email = SMTP_FROM_EMAIL
        self.from_name = SMTP_FROM_NAME

    def is_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return bool(self.smtp_host and self.smtp_port and self.smtp_username and self.smtp_password)

    async def _create_connection(self) -> aiosmtplib.SMTP:
        """Create async SMTP connection with error handling"""
        try:
            smtp = aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                timeout=10,
                start_tls=self.smtp_use_tls,
            )
            await smtp.connect()

            if self.smtp_username and self.smtp_password:
                await smtp.login(self.smtp_username, self.smtp_password)

            return smtp
        except Exception as e:
            log.error(f"Failed to create SMTP connection: {e}")
            raise

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        retry_count: int = 3,
        retry_delay: int = 2,
    ) -> bool:
        """
        Send email with retry logic (async)

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content (optional)
            retry_count: Number of retry attempts
            retry_delay: Initial delay between retries in seconds

        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.is_configured():
            log.error("SMTP is not configured. Cannot send email.")
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((self.from_name, self.from_email))
        msg["To"] = to_email
        msg["Date"] = formatdate(usegmt=True)
        msg["Message-ID"] = make_msgid(domain=self.from_email.rsplit("@", 1)[-1])

        # Add plain text version if provided
        if text_content:
            part1 = MIMEText(text_content, "plain", "utf-8")
            msg.attach(part1)

        # Add HTML version
        part2 = MIMEText(html_content, "html", "utf-8")
        msg.attach(part2)

        # Retry loop with exponential backoff
        for attempt in range(retry_count):
            try:
                smtp = await self._create_connection()
                await smtp.send_message(msg)
                await smtp.quit()
                log.info(f"Email sent successfully to {to_email}")
                return True
            except Exception as e:
                log.error(f"Failed to send email (attempt {attempt + 1}/{retry_count}): {e}")
                if attempt < retry_count - 1:
                    # Exponential backoff
                    delay = retry_delay * (2**attempt)
                    log.info(f"Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                else:
                    log.error(f"Failed to send email to {to_email} after {retry_count} attempts")
                    return False

        return False

    def render_template(self, template_name: str, **context) -> Tuple[str, str]:
        """
        Render email template (both HTML and text versions)

        Args:
            template_name: Name of template file (without extension)
            **context: Template context variables

        Returns:
            Tuple of (html_content, text_content)
        """
        try:
            # Render HTML template
            html_template = jinja_env.get_template(f"{template_name}.html")
            html_content = html_template.render(**context)

            # Try to render text template, fallback to basic text version
            try:
                text_template = jinja_env.get_template(f"{template_name}.txt")
                text_content = text_template.render(**context)
            except Exception:
                # Fallback: basic text version from HTML (strip tags)
                import re

                text_content = re.sub(r"<[^>]+>", "", html_content)

            return html_content, text_content
        except Exception as e:
            log.error(f"Failed to render template {template_name}: {e}")
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
        verification_url = f"{FRONTEND_URL}/verify-email?token={verification_token}"

        html_content, text_content = self.render_template(
            "verification",
            name=name,
            verification_url=verification_url,
            expiry_hours=EMAIL_VERIFICATION_EXPIRY_HOURS,
        )

        return await self.send_email(
            to_email=to_email,
            subject="Подтвердите ваш email",
            html_content=html_content,
            text_content=text_content,
        )

    async def send_welcome_email(self, to_email: str, name: str) -> bool:
        """
        Send welcome email after successful verification (async)

        Args:
            to_email: User email address
            name: User name

        Returns:
            True if sent successfully
        """
        html_content, text_content = self.render_template(
            "welcome",
            name=name,
            dashboard_url=f"{FRONTEND_URL}/",
        )

        return await self.send_email(
            to_email=to_email,
            subject="Добро пожаловать в Airis!",
            html_content=html_content,
            text_content=text_content,
        )

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
        reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

        html_content, text_content = self.render_template(
            "password_reset",
            name=name,
            reset_url=reset_url,
            expiry_hours=PASSWORD_RESET_EXPIRY_HOURS,
        )

        return await self.send_email(
            to_email=to_email,
            subject="Сброс пароля",
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
            "password_changed",
            name=name,
            support_url=f"{FRONTEND_URL}/support",
        )

        return await self.send_email(
            to_email=to_email,
            subject="Ваш пароль был изменен",
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
        currency: str = "RUB",
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
            "payment_confirmation",
            name=name,
            plan_name=plan_name,
            transaction_id=transaction_id,
            payment_date=payment_date,
            next_payment_date=next_payment_date,
            amount=amount,
            currency=currency,
            dashboard_url=f"{FRONTEND_URL}/",
        )

        return await self.send_email(
            to_email=to_email,
            subject="Подтверждение оплаты",
            html_content=html_content,
            text_content=text_content,
        )

    async def send_subscription_activated_email(
        self,
        to_email: str,
        name: str,
        plan_name: str,
        features: List[str],
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
            "subscription_activated",
            name=name,
            plan_name=plan_name,
            features=features,
            expires_at=expires_at,
            dashboard_url=f"{FRONTEND_URL}/",
        )

        return await self.send_email(
            to_email=to_email,
            subject=f"Подписка {plan_name} активирована",
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
        quota_unit: str = "запросов",
        reset_period: str = "ежемесячно",
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
            "quota_alert",
            name=name,
            quota_type=quota_type,
            used=used,
            limit=limit,
            quota_unit=quota_unit,
            usage_percent=usage_percent,
            reset_period=reset_period,
            upgrade_url=f"{FRONTEND_URL}/pricing",
        )

        return await self.send_email(
            to_email=to_email,
            subject=f"Внимание: {quota_type} израсходовано на {usage_percent}%",
            html_content=html_content,
            text_content=text_content,
        )


# Singleton instance
email_service = EmailService()
