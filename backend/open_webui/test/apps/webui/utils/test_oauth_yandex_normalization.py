from open_webui.utils.airis.oauth_yandex import normalize_yandex_userinfo


def test_normalize_yandex_userinfo_picks_email_from_default_email() -> None:
    payload: dict[str, object] = {
        "id": "1000034426",
        "default_email": "test@yandex.ru",
        "emails": ["other@yandex.ru"],
    }

    normalized = normalize_yandex_userinfo(payload)

    assert normalized["email"] == "test@yandex.ru"
    assert normalized["id"] == "1000034426"


def test_normalize_yandex_userinfo_picks_email_from_emails_fallback() -> None:
    payload: dict[str, object] = {
        "id": 123,
        "emails": ["first@yandex.ru", "second@yandex.ru"],
    }

    normalized = normalize_yandex_userinfo(payload)

    assert normalized["email"] == "first@yandex.ru"
    assert normalized["id"] == "123"


def test_normalize_yandex_userinfo_builds_name_and_picture() -> None:
    payload: dict[str, object] = {
        "id": "1000034426",
        "default_email": "test@yandex.ru",
        "real_name": "Ivan Ivanov",
        "display_name": "Ivan",
        "login": "ivan",
        "is_avatar_empty": False,
        "default_avatar_id": "131652443",
    }

    normalized = normalize_yandex_userinfo(payload)

    assert normalized["name"] == "Ivan Ivanov"
    assert normalized["picture"] == "https://avatars.yandex.net/get-yapic/131652443/islands-200"
