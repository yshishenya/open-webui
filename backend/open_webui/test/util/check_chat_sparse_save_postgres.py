"""Run explicitly with PostgreSQL; coordinate real writers using a row lock."""

import asyncio
import json
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Literal
from uuid import uuid4

from fastapi.testclient import TestClient
from open_webui.internal.db import engine
from open_webui.main import app
from open_webui.models.chat_messages import ChatMessages
from open_webui.models.chats import Chat, Chats
from open_webui.test.apps.webui.routers.test_chat_sparse_save import _headers, _message
from sqlalchemy import select, text


def check_case(mode: Literal['edits', 'copy', 'stream']) -> dict[str, object]:
    assert engine.dialect.name == 'postgresql', 'This check requires real PostgreSQL'
    headers = _headers()
    client = TestClient(app)
    user = _message('user', None, 'Question')
    first = _message('assistant', str(user['id']), 'Old A')
    second = _message('assistant', str(user['id']), 'Old B')
    user['childrenIds'] = [first['id'], second['id']]
    response = client.post(
        '/api/v1/chats/new',
        headers=headers,
        json={
            'chat': {
                'history': {'messages': {str(m['id']): m for m in [user, first, second]}, 'currentId': first['id']}
            }
        },
    )
    assert response.status_code == 200, response.text
    chat_id = response.json()['id']
    targets = [{**first, 'content': 'New A'}, {**second, 'content': 'New B'}]
    if mode == 'copy':
        copied = {**first, 'id': str(uuid4()), 'content': 'Copied answer'}
        targets = [copied, copied]

    def save(index: int) -> int:
        target = targets[index]
        if mode == 'stream' and index == 1:
            saved = asyncio.run(
                Chats.upsert_message_to_chat_by_id_and_message_id(
                    chat_id, str(target['id']), {'content': target['content']}
                )
            )
            return 200 if saved else 500
        result = TestClient(app).post(
            f'/api/v1/chats/{chat_id}',
            headers=headers,
            json={'chat': {'history': {'messages': {str(target['id']): target}, 'currentId': target['id']}}},
        )
        return result.status_code

    with engine.connect() as held, ThreadPoolExecutor(max_workers=2) as workers:
        transaction = held.begin()
        held.execute(select(Chat.id).where(Chat.id == chat_id).with_for_update()).one()
        futures = [workers.submit(save, index) for index in range(2)]
        blocked = 0
        try:
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                with engine.connect() as observer:
                    blocked = observer.execute(
                        text(
                            "SELECT count(*) FROM pg_stat_activity "
                            "WHERE datname=current_database() AND wait_event_type='Lock' "
                            "AND pid<>pg_backend_pid()"
                        )
                    ).scalar_one()
                if blocked >= 2:
                    break
                time.sleep(0.05)
            assert blocked >= 2, 'Both writers must reach the held PostgreSQL lock'
        finally:
            transaction.rollback()
        statuses = [future.result(timeout=30) for future in futures]
    result = client.get(f'/api/v1/chats/{chat_id}', headers=headers)
    assert result.status_code == 200
    messages = result.json()['chat']['history']['messages']
    rows = asyncio.run(ChatMessages.get_messages_map_by_chat_id(chat_id))
    assert rows is not None
    expected = [target['content'] for target in targets]
    actual = [messages[target['id']]['content'] for target in targets]
    normalized = [rows[target['id']]['content'] for target in targets]
    facts = {
        'mode': mode,
        'dialect': engine.dialect.name,
        'blockedWriters': blocked,
        'statuses': statuses,
        'expected': expected,
        'history': actual,
        'rows': normalized,
        'messageCount': len(messages),
    }
    print(json.dumps(facts), flush=True)
    assert statuses == [200, 200]
    assert actual == normalized == expected, 'Concurrent edit lost a committed neighbour'
    assert len(messages) == len(rows) == (4 if mode == 'copy' else 3)
    return facts


if __name__ == '__main__':
    for case in ('edits', 'copy', 'stream'):
        check_case(case)
