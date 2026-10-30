"""Exercise editor save payloads through the real API, auth and database."""

import asyncio
from copy import deepcopy
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from open_webui.internal.db import engine
from open_webui.main import app
from open_webui.models.auths import Auths
from open_webui.models.chat_messages import ChatMessages
from open_webui.models.chats import ChatForm, Chats
from open_webui.test.apps.webui.routers.test_chat_dispatch_replay import (
    separate_test_loops as separate_test_loops,
)
from open_webui.utils.auth import create_token, decode_token


def _headers() -> dict[str, str]:
    user_id = str(uuid4())
    user = asyncio.run(
        Auths.insert_new_auth(
            password='unused-test-password-hash',
            name='Sparse save acceptance',
            email=f'{user_id}@example.invalid',
            profile_image_url='/user.png',
            role='user',
        )
    )
    assert user is not None
    auth = asyncio.run(Auths.get_auth_by_id(user.id))
    assert auth is not None
    return {'Authorization': f'Bearer {create_token({"id": user.id, "session_stamp": auth.session_stamp})}'}


def _message(role: str, parent: str | None, content: str) -> dict[str, object]:
    return {
        'id': str(uuid4()),
        'role': role,
        'parentId': parent,
        'childrenIds': [],
        'content': content,
        'timestamp': 1791550000,
    }


def test_sparse_save_readback_and_replay(monkeypatch: pytest.MonkeyPatch) -> None:
    """No overrides: exercise ownership, sparse merging and normalized rows."""
    assert not app.dependency_overrides
    client = TestClient(app)
    headers = _headers()
    user = _message('user', None, 'Original question')
    assistant = _message('assistant', str(user['id']), 'Original answer')
    sibling = _message('assistant', str(user['id']), 'Other branch')
    user['childrenIds'] = [assistant['id'], sibling['id']]
    messages = {str(message['id']): message for message in (user, assistant, sibling)}
    response = client.post(
        '/api/v1/chats/new',
        headers=headers,
        json={
            'chat': {
                'title': 'Sparse save',
                'history': {'messages': messages, 'currentId': assistant['id']},
                'messages': [user, assistant],
            }
        },
    )
    assert response.status_code == 200, response.text
    chat_id = response.json()['id']
    initial = response.json()['chat']['history']['messages']
    user, assistant, sibling = (initial[message['id']] for message in (user, assistant, sibling))

    def readback() -> dict:
        result = client.get(f'/api/v1/chats/{chat_id}', headers=headers)
        assert result.status_code == 200, result.text
        return result.json()['chat']

    def save(target: dict[str, object], projection: list[dict[str, object]]) -> dict:
        result = client.post(
            f'/api/v1/chats/{chat_id}',
            headers=headers,
            json={
                'chat': {
                    'history': {'messages': {str(target['id']): target}, 'currentId': target['id']},
                    'messages': projection,
                }
            },
        )
        assert result.status_code == 200, result.text
        committed = readback()
        assert committed == result.json()['chat']
        rows = asyncio.run(ChatMessages.get_messages_map_by_chat_id(chat_id))
        assert rows is not None
        assert set(rows) == set(committed['history']['messages'])
        for message_id, expected in committed['history']['messages'].items():
            assert rows[message_id]['content'] == expected['content']
            assert rows[message_id].get('parentId') == expected['parentId']
            assert set(rows[message_id].get('childrenIds', [])) == set(expected['childrenIds'])
            if 'files' in expected:
                assert rows[message_id]['files'] == expected['files']
            if 'output' in expected:
                assert rows[message_id]['output'] == expected['output']
        return committed

    # Sparse user edit and clearing content/files do not delete other branches.
    edited_user = {**user, 'content': '', 'files': []}
    committed = save(edited_user, [edited_user])
    assert committed['history']['messages'][assistant['id']] == assistant
    assert committed['history']['messages'][sibling['id']] == sibling
    assert committed['messages'] == [edited_user]

    # Neighbour changes between edits must survive a later sparse save.
    edited_sibling = {**sibling, 'content': 'Neighbour updated', 'favorite': True}
    save(edited_sibling, [edited_user, edited_sibling])
    output = [
        {'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': 'Structured answer'}]}
    ]
    edited_assistant = {
        **assistant,
        'content': 'Structured answer',
        'output': output,
        'files': [{'id': 'fixture-file', 'type': 'file', 'name': 'notes.txt'}],
    }
    committed = save(edited_assistant, [edited_user, edited_assistant])
    assert committed['history']['messages'][sibling['id']] == edited_sibling
    assert committed['messages'] == [edited_user, edited_assistant]

    # Commit succeeds but caller ignores response; replay identical copy ID.
    copied = {**edited_assistant, 'id': str(uuid4()), 'content': 'Copied answer'}
    committed = save(copied, [edited_user, copied])
    committed_again = save(copied, [edited_user, copied])
    assert committed_again == committed
    assert len(committed['history']['messages']) == 4
    assert set(committed['history']['messages'][user['id']]['childrenIds']) == {
        assistant['id'],
        sibling['id'],
        copied['id'],
    }

    # Empty output is a deliberate clear, not a fallback to the old value.
    cleared = {**edited_assistant, 'content': '', 'output': [], 'files': []}
    committed = save(cleared, [edited_user, cleared])
    snapshot = deepcopy(committed)

    # Real JWT for another user cannot overwrite or read the owner's chat.
    stranger = _headers()
    denied = client.post(
        f'/api/v1/chats/{chat_id}', headers=stranger, json={'chat': {'title': 'Unauthorized overwrite'}}
    )
    assert denied.status_code == 401
    assert client.get(f'/api/v1/chats/{chat_id}', headers=stranger).status_code == 401
    assert readback() == snapshot
    assert client.post(f'/api/v1/chats/{uuid4()}', headers=headers, json={'chat': {}}).status_code == 401
    assert client.post(f'/api/v1/chats/{chat_id}', headers=headers, json={'chat': []}).status_code == 422
    assert readback() == snapshot
    assert client.post(f'/api/v1/chats/{chat_id}', json={'chat': {'title': 'No token'}}).status_code == 401
    # A normalized-row failure must also roll back the embedded history.
    invalid = {**copied, 'id': str(uuid4())}
    with monkeypatch.context() as patch:

        async def fail_write(*args: object, **kwargs: object) -> None:
            raise RuntimeError('injected normalized message write failure')

        patch.setattr(ChatMessages, 'upsert_message', fail_write)
        rejected = client.post(
            f'/api/v1/chats/{chat_id}',
            headers=headers,
            json={'chat': {'history': {'messages': {invalid['id']: invalid}, 'currentId': invalid['id']}}},
        )
    assert rejected.status_code == 500
    assert readback() == snapshot
    rows = asyncio.run(ChatMessages.get_messages_map_by_chat_id(chat_id))
    assert rows is not None and invalid['id'] not in rows
    rejected_title = client.post(f'/api/v1/chats/{chat_id}', headers=headers, json={'chat': {'title': None}})
    assert rejected_title.status_code == 500
    assert readback() == snapshot
    assert engine.dialect.name in {'sqlite', 'postgresql'}


def test_owner_patch_preserves_coauthor_and_cumulative_usage() -> None:
    """A stale owner save cannot replace a coauthor or count streamed usage twice."""
    from open_webui.utils.airis.chat_save import save_chat_patch

    owner = decode_token(_headers()['Authorization'].split()[1])['id']
    coauthor = decode_token(_headers()['Authorization'].split()[1])['id']
    question = {**_message('user', None, 'Coauthor question'), 'user_id': coauthor}
    answer = {**_message('assistant', str(question['id']), 'Answer'), 'user_id': owner, 'done': True}
    question['childrenIds'] = [answer['id']]
    chat_id = str(uuid4())
    created = asyncio.run(
        Chats.insert_new_chat(
            chat_id,
            owner,
            ChatForm(
                chat={'history': {'messages': {str(m['id']): m for m in (question, answer)}, 'currentId': answer['id']}}
            ),
        )
    )
    assert created is not None
    for usage in ({'input_tokens': 10, 'output_tokens': 5}, {'input_tokens': 15, 'output_tokens': 9}):
        assert (
            asyncio.run(Chats.upsert_message_to_chat_by_id_and_message_id(chat_id, str(answer['id']), {'usage': usage}))
            is not None
        )
    saved = asyncio.run(
        save_chat_patch(
            chat_id,
            owner,
            ChatForm(
                chat={
                    'history': {
                        'messages': {str(question['id']): {**question, 'content': 'Tampered', 'user_id': owner}},
                        'currentId': answer['id'],
                    }
                }
            ),
        )
    )
    assert saved is not None
    messages = saved.chat['history']['messages']
    rows = asyncio.run(ChatMessages.get_messages_map_by_chat_id(chat_id))
    assert messages[question['id']]['content'] == rows[question['id']]['content'] == 'Coauthor question'
    assert messages[question['id']]['user_id'] == rows[question['id']]['user_id'] == coauthor
    for store in (messages, rows):
        assert store[answer['id']]['usage']['input_tokens'] == 15
        assert store[answer['id']]['usage']['output_tokens'] == 9
