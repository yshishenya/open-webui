"""Use the existing chat primary key to replay note-chat creation safely."""

import json
import logging
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import HTTPException
from open_webui.models.chats import Chat, ChatForm, ChatModel, Chats
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


def note_chat_id(user_id: str, note_id: str, operation_id: UUID) -> str:
    """The same intent in another account or note has a separate primary key."""
    return str(uuid5(NAMESPACE_URL, json.dumps(['airis-note-chat', user_id, note_id, str(operation_id)])))


async def create_or_replay_note_chat(
    chat_id: str, user_id: str, note_id: str, form: ChatForm, db: AsyncSession
) -> ChatModel | None:
    """A concurrent insert may win; replay only its matching owner/note row."""
    try:
        row = await db.get(Chat, chat_id)
        if row is None:
            try:
                return await Chats.insert_new_chat(
                    chat_id,
                    user_id,
                    form,
                    db=db,
                    internal_meta={'internal': True, 'type': 'note', 'note_id': note_id},
                )
            except IntegrityError:
                await db.rollback()
                row = await db.get(Chat, chat_id)
                if row is None:
                    raise
        meta = row.meta if isinstance(row.meta, dict) else {}
        if (
            row.user_id != user_id
            or meta.get('internal') is not True
            or meta.get('type') != 'note'
            or meta.get('note_id') != note_id
        ):
            raise HTTPException(409, detail={'error': 'note_chat_operation_conflict'})
        return ChatModel.model_validate(row)
    except SQLAlchemyError as error:
        log.error(
            'Note chat creation unavailable user_id=%s note_id=%s error_type=%s', user_id, note_id, type(error).__name__
        )
        raise HTTPException(503, detail={'error': 'note_chat_creation_unavailable'}) from error
