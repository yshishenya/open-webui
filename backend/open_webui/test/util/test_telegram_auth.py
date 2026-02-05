import hashlib
import hmac
import time

import pytest

from open_webui.utils.telegram_auth import (
    TelegramAuthError,
    build_telegram_data_check_string,
    clamp_telegram_auth_max_age_seconds,
    verify_and_extract_telegram_user,
    verify_telegram_login_payload,
)


def _sign(payload: dict, bot_token: str) -> dict:
    data_check_string = build_telegram_data_check_string(payload)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    payload["hash"] = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return payload


def test_build_telegram_data_check_string_sorts_and_excludes_hash():
    payload = {
        "id": 42,
        "username": "alice",
        "last_name": "Liddell",
        "first_name": "Alice",
        "auth_date": 1700000000,
        "hash": "ignored",
    }

    assert build_telegram_data_check_string(payload) == "\n".join(
        [
            "auth_date=1700000000",
            "first_name=Alice",
            "id=42",
            "last_name=Liddell",
            "username=alice",
        ]
    )


def test_verify_telegram_login_payload_success_returns_auth_date():
    bot_token = "123:TEST_BOT_TOKEN"
    payload = _sign(
        {
            "id": 1,
            "first_name": "John",
            "auth_date": int(time.time()),
        },
        bot_token,
    )

    assert (
        verify_telegram_login_payload(payload, bot_token, max_age_seconds=600)
        == payload["auth_date"]
    )


def test_verify_telegram_login_payload_hash_mismatch_raises():
    bot_token = "123:TEST_BOT_TOKEN"
    payload = {
        "id": 1,
        "first_name": "John",
        "auth_date": int(time.time()),
        "hash": "deadbeef",
    }

    with pytest.raises(TelegramAuthError, match="hash mismatch"):
        verify_telegram_login_payload(payload, bot_token, max_age_seconds=600)


def test_verify_telegram_login_payload_ttl_too_old_raises():
    bot_token = "123:TEST_BOT_TOKEN"
    payload = _sign(
        {
            "id": 1,
            "first_name": "John",
            "auth_date": 0,
        },
        bot_token,
    )

    with pytest.raises(TelegramAuthError, match="too old"):
        verify_telegram_login_payload(payload, bot_token, max_age_seconds=60)


def test_verify_telegram_login_payload_future_skew_raises():
    bot_token = "123:TEST_BOT_TOKEN"
    payload = _sign(
        {
            "id": 1,
            "first_name": "John",
            "auth_date": int(time.time()) + 10_000,
        },
        bot_token,
    )

    with pytest.raises(TelegramAuthError, match="in the future"):
        verify_telegram_login_payload(payload, bot_token, max_age_seconds=60)


def test_clamp_telegram_auth_max_age_seconds():
    assert clamp_telegram_auth_max_age_seconds(None) == 600
    assert clamp_telegram_auth_max_age_seconds("not-an-int") == 600
    assert clamp_telegram_auth_max_age_seconds(1) == 60
    assert clamp_telegram_auth_max_age_seconds(3600) == 3600
    assert clamp_telegram_auth_max_age_seconds(10**9) == 24 * 60 * 60


def test_verify_and_extract_telegram_user_normalizes_fields():
    bot_token = "123:TEST_BOT_TOKEN"
    payload = _sign(
        {
            "id": 777,
            "first_name": "Jane",
            "last_name": "Doe",
            "username": "@janedoe",
            "photo_url": "https://example.com/u.png",
            "auth_date": int(time.time()),
        },
        bot_token,
    )

    verified = verify_and_extract_telegram_user(payload, bot_token, max_age_seconds=600)

    assert verified.telegram_id == 777
    assert verified.sub == "777"
    assert verified.display_name == "Jane Doe"
    assert verified.username == "janedoe"
    assert verified.photo_url == "https://example.com/u.png"
