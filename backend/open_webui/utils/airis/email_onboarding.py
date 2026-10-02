"""First-cycle mail uses the existing public guide and its prepared task."""

from urllib.parse import urlsplit

from open_webui.models.billing_wallet import Payment
from open_webui.models.email_delivery import DeliveryView
from open_webui.models.task_success import TaskSuccess
from open_webui.models.users import User
from open_webui.utils.airis.email_scenarios import credited_condition
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def first_email_context(base: str, name: str) -> dict[str, str]:
    """Allow only the AIRIS chat origin; no client redirect or duplicate prompts."""
    parsed = urlsplit(base)
    if (
        parsed.scheme != 'https'
        or parsed.hostname != 'chat.airis.you'
        or parsed.port not in {None, 443}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {'', '/'}
        or parsed.query
        or parsed.fragment
        or any(c.isspace() for c in base)
    ):
        raise ValueError('Invalid AIRIS onboarding origin')
    origin = 'https://chat.airis.you'
    return {
        'name': name,
        'first_task_url': origin + '/guide#example-letter',
        'guide_url': origin + '/guide',
        'dashboard_url': origin + '/',
    }


async def onboarding_context(session: AsyncSession, user: User, job: DeliveryView, base: str) -> dict[str, str]:
    """Build content from current server facts; never from a return URL or client state."""
    context = first_email_context(base, user.name)
    context.update(
        history_url='https://chat.airis.you/billing/history?filter=topups',
        pricing_url='https://chat.airis.you/pricing#calculation',
        paid_example_url='https://chat.airis.you/guide#costs',
    )
    if job.type == 'topup_credited':
        payment = await session.scalar(
            select(Payment).where(Payment.id == job.payment_id, Payment.user_id == user.id, credited_condition())
        )
        if not payment:
            raise ValueError('Unconfirmed credit context')
        # Integer minor units avoid floating-point rounding of the credited amount.
        context['amount'] = f'{payment.amount_kopeks // 100},{payment.amount_kopeks % 100:02}'
        context['currency'] = payment.currency
    elif job.type == 'feedback_14d':
        started = await session.scalar(
            select(TaskSuccess.operation_id)
            .where(TaskSuccess.user_id == user.id, TaskSuccess.kind == 'foreground_chat')
            .limit(1)
        )
        credited = await session.scalar(
            select(Payment.id).where(Payment.user_id == user.id, credited_condition()).limit(1)
        )
        context['activity'] = 'started' if started else 'not_started'
        context['payment'] = 'credited' if credited else 'no_credit'
    return context
