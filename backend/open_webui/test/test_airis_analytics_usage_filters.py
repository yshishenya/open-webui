"""Analytics page and model details share period, group and visible chat scope."""

import pytest
from open_webui.models.chat_messages import ChatMessage, ChatMessages
from open_webui.models.chats import Chat, Chats
from open_webui.models.feedbacks import Feedback, Feedbacks
from open_webui.models.groups import Group, GroupMember
from open_webui.models.users import User
from open_webui.utils.airis.analytics_usage_reporting import model_tag_counts
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


@pytest.mark.asyncio
async def test_usage_reports_and_details_preserve_group_period_and_visible_chats(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import open_webui.internal.db as db_module

    monkeypatch.setattr(db_module, 'DATABASE_ENABLE_SESSION_SHARING', True)
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            for model in (User, Group, GroupMember, Chat, ChatMessage, Feedback):
                await connection.run_sync(model.__table__.create)
        async with AsyncSession(engine) as session:
            session.add(User(id='a', name='Anna'))
            session.add(User(id='b', name='Boris'))
            session.add(Group(id='g', user_id='a', name='Team'))
            session.add(GroupMember(id='member', group_id='g', user_id='a'))
            for identifier, user, stamp, internal, role in [
                ('visible', 'a', 150, False, 'assistant'),
                ('other', 'b', 150, False, 'assistant'),
                ('old', 'a', 50, False, 'assistant'),
                ('end-boundary', 'a', 200, False, 'assistant'),
                ('internal', 'a', 150, True, 'assistant'),
                ('prompt', 'a', 150, False, 'user'),
                ('missing-model', 'a', 150, False, 'assistant'),
            ]:
                session.add(
                    Chat(
                        id=identifier,
                        user_id=user,
                        title=identifier,
                        chat={},
                        meta={'internal': internal, 'tags': [identifier]},
                        created_at=stamp,
                        updated_at=stamp,
                    )
                )
                session.add(
                    ChatMessage(
                        id='m-' + identifier,
                        chat_id=identifier,
                        user_id=user,
                        role=role,
                        model_id=None if identifier == 'missing-model' else 'model',
                        created_at=stamp,
                        updated_at=stamp,
                        usage={'prompt_tokens': 1, 'completion_tokens': 2},
                    )
                )
            session.add(Feedback(id='in', user_id='a', data={'model_id': 'model', 'rating': 1}, created_at=150))
            session.add(Feedback(id='out', user_id='b', data={'model_id': 'model', 'rating': 1}, created_at=150))
            session.add(Feedback(id='later', user_id='a', data={'model_id': 'model', 'rating': 1}, created_at=250))
            await session.commit()
            filters = {'start_date': 100, 'end_date': 200, 'group_id': 'g', 'db': session}
            counts = await ChatMessages.get_message_count_by_model(**filters)
            assert counts == {'model': 1}
            assert await ChatMessages.get_message_count_by_user(**filters) == {'a': 1}
            assert await ChatMessages.get_message_count_by_chat(**filters) == {'visible': 1}
            usage_by_user = await ChatMessages.get_token_usage_by_user(**filters)
            assert usage_by_user['a']['message_count'] == 1
            assert usage_by_user['a']['total_tokens'] == 3
            daily = await ChatMessages.get_daily_message_counts_by_model(**filters)
            hourly = await ChatMessages.get_hourly_message_counts_by_model(**filters)
            assert sum(bucket.get('model', 0) for bucket in daily.values()) == 1
            assert sum(bucket.get('model', 0) for bucket in hourly.values()) == 1
            chats = await Chats.get_chats_by_model_id(
                'model', filter={key: value for key, value in filters.items() if key != 'db'}, db=session
            )
            assert chats['total'] == 1
            assert chats['items'][0]['chat_id'] == 'visible'
            assert await model_tag_counts(session, 'model', 100, 200, 'g') == [{'tag': 'visible', 'count': 1}]
            history = await Feedbacks.get_model_feedback_counts_by_day('model', **filters)
            assert sum(row.won for row in history) == 1
    finally:
        await engine.dispose()
