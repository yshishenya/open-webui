import hashlib
import hmac
import time
from dataclasses import dataclass
from typing import Any, Mapping


class TelegramAuthError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class TelegramVerifiedUser:
    telegram_id: int
    sub: str
    display_name: str
    username: str | None
    photo_url: str | None
    auth_date: int


DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS = 600
MIN_TELEGRAM_AUTH_MAX_AGE_SECONDS = 60
MAX_TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60
TELEGRAM_AUTH_FUTURE_SKEW_SECONDS = 30


def build_telegram_data_check_string(payload: Mapping[str, Any]) -> str:
    """
    Build the canonical data-check-string per Telegram Login Widget docs.

    Telegram requires:
      - Take all fields received from the widget except "hash"
      - Sort them by key (alphabetically)
      - Join as "key=value" lines separated by "\\n"
    """

    items: list[tuple[str, str]] = []

    for key, value in payload.items():
        if key == "hash":
            continue
        if value is None:
            raise TelegramAuthError(f"Invalid telegram payload field '{key}': null")
        if isinstance(value, (dict, list, tuple, set)):
            raise TelegramAuthError(
                f"Invalid telegram payload field '{key}': non-scalar value"
            )
        items.append((str(key), str(value)))

    if not items:
        raise TelegramAuthError("Invalid telegram payload: no fields to verify")

    items.sort(key=lambda kv: kv[0])
    return "\n".join([f"{k}={v}" for k, v in items])


def compute_telegram_login_hash(data_check_string: str, bot_token: str) -> str:
    if not bot_token or not str(bot_token).strip():
        raise TelegramAuthError("Telegram bot token is not configured")

    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    return hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def verify_telegram_login_payload(
    payload: Mapping[str, Any],
    bot_token: str,
    *,
    max_age_seconds: Any = DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS,
) -> int:
    provided_hash = payload.get("hash")
    if not provided_hash or not str(provided_hash).strip():
        raise TelegramAuthError("Invalid telegram payload: missing hash")

    data_check_string = build_telegram_data_check_string(payload)
    expected_hash = compute_telegram_login_hash(data_check_string, bot_token)

    if not hmac.compare_digest(expected_hash, str(provided_hash).lower()):
        raise TelegramAuthError("Invalid telegram payload: hash mismatch")

    max_age_seconds = clamp_telegram_auth_max_age_seconds(max_age_seconds)
    return validate_telegram_auth_date(payload, max_age_seconds=max_age_seconds)


def verify_and_extract_telegram_user(
    payload: Mapping[str, Any],
    bot_token: str,
    *,
    max_age_seconds: Any = DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS,
) -> TelegramVerifiedUser:
    auth_date = verify_telegram_login_payload(
        payload, bot_token, max_age_seconds=max_age_seconds
    )

    telegram_id_raw = payload.get("id")
    if telegram_id_raw is None:
        raise TelegramAuthError("Invalid telegram payload: missing id")
    try:
        telegram_id = int(telegram_id_raw)
    except Exception:
        raise TelegramAuthError("Invalid telegram payload: invalid id")

    if telegram_id <= 0:
        raise TelegramAuthError("Invalid telegram payload: invalid id")

    username_raw = payload.get("username")
    username = str(username_raw).strip().lstrip("@") if username_raw else None
    if username == "":
        username = None

    first_name = str(payload.get("first_name") or "").strip()
    last_name = str(payload.get("last_name") or "").strip()
    if first_name and last_name:
        display_name = f"{first_name} {last_name}"
    else:
        display_name = first_name or last_name or username or f"telegram:{telegram_id}"

    photo_url_raw = payload.get("photo_url")
    photo_url = str(photo_url_raw).strip() if photo_url_raw else None
    if photo_url == "":
        photo_url = None

    return TelegramVerifiedUser(
        telegram_id=telegram_id,
        sub=str(telegram_id),
        display_name=display_name,
        username=username,
        photo_url=photo_url,
        auth_date=auth_date,
    )


def clamp_telegram_auth_max_age_seconds(max_age_seconds: Any) -> int:
    try:
        value = int(max_age_seconds)
    except Exception:
        value = DEFAULT_TELEGRAM_AUTH_MAX_AGE_SECONDS

    if value < MIN_TELEGRAM_AUTH_MAX_AGE_SECONDS:
        return MIN_TELEGRAM_AUTH_MAX_AGE_SECONDS
    if value > MAX_TELEGRAM_AUTH_MAX_AGE_SECONDS:
        return MAX_TELEGRAM_AUTH_MAX_AGE_SECONDS
    return value


def validate_telegram_auth_date(payload: Mapping[str, Any], *, max_age_seconds: int) -> int:
    auth_date_raw = payload.get("auth_date")
    if auth_date_raw is None:
        raise TelegramAuthError("Invalid telegram payload: missing auth_date")

    try:
        auth_date = int(auth_date_raw)
    except Exception:
        raise TelegramAuthError("Invalid telegram payload: invalid auth_date")

    now = int(time.time())
    if auth_date > now + TELEGRAM_AUTH_FUTURE_SKEW_SECONDS:
        raise TelegramAuthError("Invalid telegram payload: auth_date is in the future")

    if now - auth_date > max_age_seconds:
        raise TelegramAuthError("Invalid telegram payload: auth_date is too old")

    return auth_date
