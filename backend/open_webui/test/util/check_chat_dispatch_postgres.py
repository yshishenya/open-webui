"""Standalone PostgreSQL migration and independent-process dispatch ownership check."""

import asyncio
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from open_webui.internal.db import engine, get_async_db
from open_webui.models.chat_dispatch import ChatDispatch, accept_dispatch
from open_webui.models.users import User, Users
from sqlalchemy import delete, func, inspect, select

CHILD = """
import asyncio,json,sys
from open_webui.models.chat_dispatch import reserve_dispatch
async def run():
    row,owned = await reserve_dispatch(*sys.argv[1:])
    print(json.dumps({'owned': owned, 'hash': row.request_hash, 'receipt': row.receipt}))
asyncio.run(run())
"""


def reserve_in_process(arguments: list[str]) -> dict[str, object]:
    result = subprocess.run(
        [sys.executable, '-c', CHILD, *arguments], capture_output=True, text=True, check=True, timeout=60
    )
    return json.loads(result.stdout.splitlines()[-1])


async def prove_records(user_id: str, key: str) -> None:
    async with get_async_db() as db:
        count = await db.scalar(
            select(func.count()).select_from(ChatDispatch).filter_by(user_id=user_id, operation_id=key)
        )
        assert count == 1
    receipt = {'status': True, 'task_ids': ['fixture-task'], 'chat_id': 'fixture-chat'}
    await accept_dispatch(user_id, key, receipt)


async def prove_deletion(user_id: str) -> None:
    async with get_async_db() as db:
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()
        count = await db.scalar(select(func.count()).select_from(ChatDispatch).filter_by(user_id=user_id))
        assert count == 0


def main() -> None:
    assert engine.dialect.name == 'postgresql', 'This check requires actual PostgreSQL'
    config = Config('open_webui/alembic.ini')
    config.set_main_option('script_location', 'open_webui/migrations')
    expected = ScriptDirectory.from_config(config).get_heads()
    with engine.connect() as db:
        actual = list(MigrationContext.configure(db).get_current_heads())
        schema = inspect(db)
        columns = [column['name'] for column in schema.get_columns('airis_chat_dispatch')]
        primary = schema.get_pk_constraint('airis_chat_dispatch')['constrained_columns']
    assert actual == expected == ['d1c020261009']
    assert primary == ['user_id', 'operation_id']
    assert set(columns) == {'user_id', 'operation_id', 'request_hash', 'receipt', 'created_at'}
    user_id, key = str(uuid4()), str(uuid4())
    user = asyncio.run(Users.insert_new_user(user_id, 'Process ownership', f'{user_id}@example.invalid', '/user.png'))
    assert user is not None
    arguments = [user_id, key, 'content-free-fixture-hash']
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(reserve_in_process, [arguments, arguments]))
    assert sum(result['owned'] is True for result in results) == 1
    assert all(result['receipt'] is None for result in results)
    asyncio.run(prove_records(user_id, key))
    replay = reserve_in_process(arguments)
    assert replay['owned'] is False and replay['receipt'] == {
        'status': True,
        'task_ids': ['fixture-task'],
        'chat_id': 'fixture-chat',
    }
    asyncio.run(prove_deletion(user_id))
    print(
        json.dumps(
            {'dialect': 'postgresql', 'head': actual, 'processes': 2, 'owners': 1, 'replayed': True, 'deleted': True}
        )
    )


if __name__ == '__main__':
    main()
