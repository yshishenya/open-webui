from unittest.mock import AsyncMock

import pytest

from open_webui.utils.email import EmailService


@pytest.mark.asyncio
async def test_send_email_adds_standard_message_headers() -> None:
    service = EmailService()
    service.smtp_host = "mail.example.test"
    service.smtp_port = 587
    service.smtp_username = "sender@example.test"
    service.smtp_password = "password"
    service.from_email = "sender@example.test"
    service.from_name = "Airis"

    smtp = AsyncMock()
    service._create_connection = AsyncMock(return_value=smtp)

    assert await service.send_email(
        to_email="recipient@example.test",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
        retry_count=1,
    )

    message = smtp.send_message.await_args.args[0]
    assert message["Date"]
    assert message["Message-ID"].endswith("@example.test>")
    assert message["From"] == "Airis <sender@example.test>"
