"""Shared read-only visibility rules for product usage reports."""

from collections import Counter

from open_webui.models.chat_messages import ChatMessage
from open_webui.models.chats import Chat
from open_webui.models.groups import GroupMember
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select


def visible_messages(statement: Select) -> Select:
    """Apply the same product chat scope as the administrator chat browser."""
    return statement.where(
        ChatMessage.chat_id.in_(select(Chat.id).where(Chat.meta['internal'].as_boolean().is_not(True))),
        ChatMessage.model_id.is_not(None),
    )


async def model_tag_counts(
    session: AsyncSession, model_id: str, start_date: int | None, end_date: int | None, group_id: str | None
) -> list[dict[str, str | int]]:
    """Stream all matching chat metadata; never sample the first 10,000 chats."""
    messages = select(ChatMessage.chat_id).where(ChatMessage.model_id == model_id, ChatMessage.role == 'assistant')
    if start_date is not None:
        messages = messages.where(ChatMessage.created_at >= start_date)
    if end_date is not None:
        messages = messages.where(ChatMessage.created_at < end_date)
    if group_id:
        messages = messages.where(
            ChatMessage.user_id.in_(select(GroupMember.user_id).where(GroupMember.group_id == group_id))
        )
    query = select(Chat.meta).where(Chat.id.in_(messages), Chat.meta['internal'].as_boolean().is_not(True))
    counts: Counter[str] = Counter()
    result = await session.stream(query)
    async for meta in result.scalars():
        for tag in (meta or {}).get('tags', []):
            if isinstance(tag, str):
                counts[tag] += 1
    return [
        {'tag': tag, 'count': count} for tag, count in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[:10]
    ]
