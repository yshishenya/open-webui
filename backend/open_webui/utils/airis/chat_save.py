"""Commit a chat editor patch and its normalized messages together."""

import time

from open_webui.models.chat_messages import ChatMessages
from open_webui.models.chats import ChatForm, ChatModel, Chats


async def save_chat_patch(chat_id: str, user_id: str, form: ChatForm) -> ChatModel | None:
    """Merge against the locked current row; failed dual writes roll back."""
    async with Chats._chat_transaction(chat_id) as (db, row):
        if row is None or row.user_id != user_id:
            return None

        current = row.chat or {}
        updated = {**current, **form.chat}
        if 'history' in form.chat:
            updated['history'] = Chats.merge_history(current.get('history'), form.chat.get('history'))
            for message_id, message in (current.get('history', {}).get('messages') or {}).items():
                if (message.get('user_id') or row.user_id) != row.user_id or (
                    message.get('role') == 'assistant'
                    and (
                        message.get('done') is False or updated['history']['messages'][message_id].get('done') is False
                    )
                ):
                    updated['history']['messages'][message_id] = message
            updated['history'] = Chats.merge_history(updated['history'], {})
            Chats._repair_chat_current_id(updated)
        row.chat = Chats._clean_null_bytes(updated)
        row.title = row.chat.get('title', 'New Chat')
        if any(key in form.chat for key in ('history', 'messages', 'currentId', 'branchPointMessageId')):
            row.current_message_id = Chats.get_current_message_id(row.chat)
        if 'history' in form.chat or 'messages' in form.chat:
            row.updated_at = int(time.time())
        if form.variables is not None:
            row.variables = form.variables

        # The lock stays held until both representations are committed.
        if 'history' in form.chat or 'messages' in form.chat:
            for message_id, message in (row.chat.get('history') or {}).get('messages', {}).items():
                if isinstance(message, dict) and message.get('role'):
                    await ChatMessages.upsert_message(
                        message_id, chat_id, message.get('user_id') or user_id, message, db=db, commit=False
                    )
        saved = ChatModel.model_validate(row)
        return saved
