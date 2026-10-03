"""Read-only business eligibility, separate from release controls and SMTP capacity."""

from open_webui.models.auths import Auth
from open_webui.models.email_delivery import DeliveryView
from open_webui.models.email_preferences import (
    SUPPRESSION_DAYS,
    EmailPreferenceEvent,
    email_fingerprint,
    preference_for_user,
    valid_product_address,
)
from open_webui.models.users import User
from open_webui.utils.airis.email_scenarios import ScenarioDecision, recent_submission, scenario_decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def account_email_reason(
    session: AsyncSession, user: User, job: DeliveryView, expected_email: str | None, now: int
) -> str:
    """Require an active account, verified suitable address and applicable permission."""
    auth = await session.get(Auth, user.id)
    if not auth or not auth.active or user.role not in {'user', 'admin'}:
        return 'inactive_account'
    if (
        not valid_product_address(user.email)
        or not user.email_verified
        or (expected_email is not None and user.email != expected_email)
    ):
        return 'invalid_address'
    if job.category == 'product':
        preference = await preference_for_user(session, user, now)
        if user.role != 'user':
            return 'inactive_account'
        if not preference.can_receive:
            return 'consent' if preference.reason == 'no_consent' else preference.reason
    if await session.scalar(
        select(EmailPreferenceEvent.id)
        .where(
            EmailPreferenceEvent.email_hash == email_fingerprint(user.email),
            EmailPreferenceEvent.action.in_(['hard_bounce', 'complaint']),
            EmailPreferenceEvent.created_at >= now - SUPPRESSION_DAYS * 86400,
        )
        .limit(1)
    ):
        return 'invalid_address'
    return 'ready'


async def send_eligibility(
    session: AsyncSession,
    user: User | None,
    job: DeliveryView,
    expected_email: str | None,
    now: int,
) -> ScenarioDecision:
    """Read current account/scenario/frequency facts; this never authorizes transport.

    Callers must separately enforce release, dry-run, pilot and global product switches.
    No queue, consent, payment or observation state is written here.
    """
    if not user:
        return ScenarioDecision('deleted_account')
    reason = await account_email_reason(session, user, job, expected_email, now)
    if reason != 'ready':
        return ScenarioDecision(reason)
    decision = await scenario_decision(session, user, job, now)
    if decision.reason != 'ready' or job.category != 'product':
        return decision
    previous = await recent_submission(session, user.id, job.id)
    if previous is not None and previous + 86400 > now:
        return ScenarioDecision('frequency', previous + 86400)
    return decision
