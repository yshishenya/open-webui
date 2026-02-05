from __future__ import annotations

from typing import Mapping
from urllib.parse import quote


def _non_empty_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _first_email(user_data: Mapping[str, object]) -> str | None:
    default_email = _non_empty_str(user_data.get("default_email"))
    if default_email:
        return default_email

    emails = user_data.get("emails")
    if isinstance(emails, list) and emails:
        first = _non_empty_str(emails[0])
        if first:
            return first

    return None


def _first_name(user_data: Mapping[str, object], *, fallback_email: str | None) -> str | None:
    for key in ("real_name", "display_name", "login"):
        value = _non_empty_str(user_data.get(key))
        if value:
            return value

    if fallback_email:
        return fallback_email

    sub = user_data.get("id")
    if sub is None:
        return None

    return str(sub)


def _yandex_avatar_url(avatar_id: str, *, size: str = "islands-200") -> str:
    safe_avatar_id = quote(avatar_id, safe="")
    safe_size = quote(size, safe="")
    return f"https://avatars.yandex.net/get-yapic/{safe_avatar_id}/{safe_size}"


def normalize_yandex_userinfo(user_data: Mapping[str, object]) -> dict[str, object]:
    """Normalize Yandex userinfo payload for shared OAuth flow.

    The shared OAuth callback expects provider userinfo to contain:
    - `id` (sub-claim for Yandex)
    - `email` (from default_email or emails[0])
    - `name` (best-effort display name)
    - `picture` (best-effort avatar URL)
    """

    normalized: dict[str, object] = dict(user_data)

    # Ensure `id` is always a string when present.
    raw_id = normalized.get("id")
    if raw_id is not None and not isinstance(raw_id, str):
        normalized["id"] = str(raw_id)

    email = _first_email(normalized)
    if email:
        normalized["email"] = email

    name = _first_name(normalized, fallback_email=email)
    if name:
        normalized["name"] = name

    is_avatar_empty = normalized.get("is_avatar_empty")
    avatar_id = normalized.get("default_avatar_id")
    if is_avatar_empty is False and avatar_id is not None:
        avatar_id_str = str(avatar_id).strip()
        if avatar_id_str:
            normalized["picture"] = _yandex_avatar_url(avatar_id_str)

    return normalized
