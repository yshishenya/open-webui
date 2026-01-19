"""Helpers for mocking authenticated users in tests."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Optional

from open_webui.main import app
from open_webui.models.users import UserModel, Users
from open_webui.utils.auth import create_token, get_admin_user, get_current_user, get_verified_user


def _default_name(user_id: str) -> str:
    if user_id == "1":
        return "John Doe"
    return f"user {user_id}"


def _default_email(user_id: str) -> str:
    if user_id == "1":
        return "john.doe@openwebui.com"
    return f"user{user_id}@openwebui.com"


@contextmanager
def mock_webui_user(
    id: str = "1",
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: str = "user",
    profile_image_url: str = "/user.png",
) -> Generator[str, None, None]:
    """Override auth dependencies and yield a JWT for the mocked user."""
    user = Users.get_user_by_id(id)
    if not user:
        user = Users.insert_new_user(
            id=id,
            name=name or _default_name(id),
            email=email or _default_email(id),
            profile_image_url=profile_image_url,
            role=role,
        )

    if user is None:
        raise RuntimeError("Failed to create mock user")

    token = create_token({"id": user.id})

    async def _override_current_user() -> UserModel:
        return user

    async def _override_verified_user() -> UserModel:
        return user

    async def _override_admin_user() -> UserModel:
        return user

    overrides = app.dependency_overrides
    previous_overrides = {
        get_current_user: overrides.get(get_current_user),
        get_verified_user: overrides.get(get_verified_user),
        get_admin_user: overrides.get(get_admin_user),
    }

    overrides[get_current_user] = _override_current_user
    overrides[get_verified_user] = _override_verified_user
    overrides[get_admin_user] = _override_admin_user

    try:
        yield token
    finally:
        for dependency, previous in previous_overrides.items():
            if previous is None:
                overrides.pop(dependency, None)
            else:
                overrides[dependency] = previous
