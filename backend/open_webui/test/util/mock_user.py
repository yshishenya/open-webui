from contextlib import contextmanager

from fastapi import FastAPI


@contextmanager
def mock_webui_user(**kwargs):
    try:
        from main import app
    except ImportError:
        from open_webui.main import app

    with mock_user(app, **kwargs):
        yield


@contextmanager
def mock_user(app: FastAPI, **kwargs):
    from open_webui.utils.auth import (
        create_token,
        get_current_user,
        get_verified_user,
        get_admin_user,
        get_current_user_by_api_key,
    )
    from open_webui.models.users import User

    user_parameters = {
        "id": "1",
        "name": "John Doe",
        "email": "john.doe@openwebui.com",
        "role": "user",
        "profile_image_url": "/user.png",
        "last_active_at": 1627351200,
        "updated_at": 1627351200,
        "created_at": 162735120,
        **kwargs,
    }
    user = User(**user_parameters)
    token = create_token({"id": user.id})

    def create_user():
        return user

    app.dependency_overrides = {
        get_current_user: create_user,
        get_verified_user: create_user,
        get_admin_user: create_user,
        get_current_user_by_api_key: create_user,
    }
    yield token
    app.dependency_overrides = {}
