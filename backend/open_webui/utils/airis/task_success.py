"""Success requires a completed visible foreground result, not a done flag."""

import asyncio
import codecs
import hashlib
import json
import logging
import re
import time
import uuid
from collections.abc import Callable
from pathlib import Path

from open_webui.models.files import Files
from open_webui.models.task_success import SuccessCheckpoint
from open_webui.utils.chat_id import is_saved_chat_id, is_temporary_chat_id
from open_webui.utils.misc import get_output_text
from sqlalchemy.exc import SQLAlchemyError

log = logging.getLogger(__name__)

REASONING = re.compile(r'<(think|thinking|reason|reasoning|thought|details)\b[^>]*>.*?(?:</\1\s*>|$)', re.I | re.S)
FILE_URL = re.compile(r'^/api/v1/files/([^/?#]+)/content(?:\?[^#]*)?$')


def operation_id(client_id: object, message_ids: list[dict[str, object]]) -> str:
    try:
        value = str(uuid.UUID(str(client_id)))
    except (ValueError, AttributeError):
        ids = sorted({str(entry['message_id']) for entry in message_ids if entry.get('message_id')})
        value = json.dumps(ids) if ids else str(uuid.uuid4())
    return hashlib.sha256(value.encode()).hexdigest()


def visible_text(content: object, output: object = None) -> str:
    text = get_output_text(output) if isinstance(output, list) else content
    return REASONING.sub('', text).strip() if isinstance(text, str) else ''


def foreground(metadata: dict[str, object]) -> bool:
    session = str(metadata.get('session_id') or '')
    user_message = metadata.get('user_message')
    message_meta = user_message.get('meta') if isinstance(user_message, dict) else None
    return bool(
        metadata.get('airis_operation_id')
        and metadata.get('internal') is not True
        and not (isinstance(message_meta, dict) and message_meta.get('internal'))
        and not session.startswith(('automation:', 'timer:', 'subagent:', 'subagent-result:', 'timer-result:'))
    )


def displayed_files(output: object, files: object = None) -> list[dict[str, object]]:
    result = [item for item in files if isinstance(item, dict)] if isinstance(files, list) else []
    if isinstance(output, list):
        for item in output:
            if (
                isinstance(item, dict)
                and item.get('type') == 'function_call_output'
                and item.get('status') == 'completed'
            ):
                files = item.get('files')
                if isinstance(files, list):
                    result.extend(file for file in files if isinstance(file, dict))
    return result


async def completion_checkpoint(
    user_id: str,
    metadata: dict[str, object],
    content: object,
    output: object = None,
    *,
    failed: bool = False,
    completed: bool = True,
    files: object = None,
    initial_text: str = '',
    initial_files: set[str] | None = None,
) -> SuccessCheckpoint | None:
    if failed or not completed or not foreground(metadata):
        return None
    text = visible_text(content, output)
    useful = bool(text and text != initial_text)
    if not useful:
        for item in displayed_files(output, files):
            url = str(item.get('url') or '')
            match = FILE_URL.fullmatch(url)
            if not match or url in (initial_files or set()):
                continue
            try:
                file = await asyncio.wait_for(Files.get_file_by_id_and_user_id(match[1], user_id), timeout=5)
                if file and file.path and '://' not in file.path:
                    path = Path(file.path)
                    if await asyncio.to_thread(lambda: path.is_file() and path.stat().st_size > 0):
                        useful = True
                        break
            except (SQLAlchemyError, TimeoutError, OSError) as error:
                log.warning('Foreground artifact unavailable error_type=%s', type(error).__name__)
    if not useful:
        return None
    chat_id = str(metadata.get('chat_id') or '')
    source = 'temporary_chat' if is_temporary_chat_id(chat_id) else 'saved_chat' if is_saved_chat_id(chat_id) else 'api'
    return SuccessCheckpoint(
        operation_id=str(metadata['airis_operation_id']),
        kind='foreground_chat',
        completed_at=int(time.time()),
        source=source,
    )


def message_row_id(metadata: dict[str, object]) -> str | None:
    chat_id = str(metadata.get('chat_id') or '')
    message_id = metadata.get('message_id')
    return f'{chat_id}-{message_id}' if is_saved_chat_id(chat_id) and message_id else None


def response_failed(data: dict[str, object]) -> bool:
    response = data.get('response')
    choices = data.get('choices')
    return bool(
        'error' in data
        or data.get('type') in {'response.failed', 'response.incomplete', 'error'}
        or data.get('status') in {'failed', 'incomplete', 'cancelled'}
        or (isinstance(response, dict) and response.get('status') in {'failed', 'incomplete', 'cancelled'})
        or (
            isinstance(choices, list)
            and any(isinstance(choice, dict) and choice.get('finish_reason') == 'content_filter' for choice in choices)
        )
    )


class CompletionStreamState:
    """Observe terminal/error signals across UTF-8 and SSE chunk boundaries."""

    def __init__(self) -> None:
        self.failed = False
        self.completed = False
        self._decoder = codecs.getincrementaldecoder('utf-8')('replace')
        self._buffer = ''

    def feed(self, chunk: str | bytes, *, final: bool = False) -> list[str]:
        self._buffer += self._decoder.decode(chunk, final=final) if isinstance(chunk, bytes) else chunk
        parts = self._buffer.split('\n')
        self._buffer = parts.pop()
        if final and self._buffer:
            parts.append(self._buffer)
            self._buffer = ''
        # ponytail: cap unfinished event buffering at 1 MiB; use incremental JSON if real fragmented events exceed it.
        if len(self._buffer) > 1024 * 1024:
            self.failed = True
            self._buffer = ''
        for line in parts:
            self.observe(line)
        return parts

    def capture(
        self,
        chunk: str | bytes,
        message: dict[str, object],
        update: Callable[[dict[str, object], str], None],
        *,
        final: bool = False,
    ) -> None:
        for line in self.feed(chunk, final=final):
            update(message, line)

    def observe(self, line: str) -> None:
        raw = line.removeprefix('data:').strip()
        if raw == '[DONE]':
            self.completed = True
            return
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            return
        if not isinstance(data, dict):
            return
        if response_failed(data):
            self.failed = True
        if data.get('type') == 'response.completed' or data.get('done') is True:
            self.completed = True
        for choice in data.get('choices') or []:
            if isinstance(choice, dict) and choice.get('finish_reason') in {
                'stop',
                'length',
                'tool_calls',
                'function_call',
            }:
                self.completed = True
