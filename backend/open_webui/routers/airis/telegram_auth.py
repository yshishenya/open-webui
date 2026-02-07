import datetime
import logging
import secrets
import time
import uuid

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from open_webui.constants import ERROR_MESSAGES
from open_webui.env import WEBUI_AUTH_COOKIE_SAME_SITE, WEBUI_AUTH_COOKIE_SECURE
from open_webui.internal.db import get_session
from open_webui.models.auths import Auths, Token
from open_webui.models.users import UserProfileImageResponse, Users
from open_webui.utils.access_control import get_permissions
from open_webui.utils.airis.legal_acceptance import record_legal_acceptances
from open_webui.utils.auth import create_token, get_password_hash, get_verified_user
from open_webui.utils.groups import apply_default_group_assignment
from open_webui.utils.misc import parse_duration
from open_webui.utils.rate_limit import RateLimiter
from open_webui.utils.redis import get_redis_client
from open_webui.utils.telegram_auth import (
    TelegramAuthError,
    verify_and_extract_telegram_user,
)

router = APIRouter()

log = logging.getLogger(__name__)

telegram_state_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=60, window=60 * 10
)
telegram_action_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=5 * 3, window=60 * 3
)


def _get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _audit_telegram_auth_event(
    request: Request,
    *,
    action: str,
    outcome: str,
    user_id: str | None = None,
    telegram_id: int | None = None,
) -> None:
    ip = _get_client_ip(request)
    msg = f"telegram_auth action={action} outcome={outcome} ip={ip}"
    if user_id:
        msg += f" user_id={user_id}"
    if telegram_id is not None:
        msg += f" telegram_id={telegram_id}"
    log.info(msg)


def _enforce_telegram_rate_limit(request: Request, *, action: str) -> None:
    client_ip = _get_client_ip(request)
    key = f"telegram:{action}:{client_ip}"
    limiter = (
        telegram_state_rate_limiter if action == "state" else telegram_action_rate_limiter
    )
    if limiter.is_limited(key):
        _audit_telegram_auth_event(request, action=action, outcome="rate_limited")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        )


class TelegramWidgetPayload(BaseModel):
    id: int
    auth_date: int
    hash: str

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    query_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class TelegramAuthForm(BaseModel):
    state: str
    payload: TelegramWidgetPayload
    terms_accepted: bool = False
    privacy_accepted: bool = False


class TelegramUnlinkForm(BaseModel):
    state: str


class TelegramStateResponse(BaseModel):
    state: str


class SessionUserResponse(Token, UserProfileImageResponse):
    expires_at: Optional[int] = None
    permissions: Optional[dict] = None


TELEGRAM_SESSION_STATE_KEY = "telegram_auth_state"
TELEGRAM_SESSION_STATE_TTL_SECONDS = 10 * 60


def _consume_telegram_state(
    request: Request,
    expected_state: str,
    *,
    action: str,
    user_id: str | None = None,
) -> None:
    state_record = request.session.get(TELEGRAM_SESSION_STATE_KEY)
    request.session.pop(TELEGRAM_SESSION_STATE_KEY, None)

    if not isinstance(state_record, dict):
        _audit_telegram_auth_event(
            request, action=action, outcome="invalid_state", user_id=user_id
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS)

    if state_record.get("state") != expected_state:
        _audit_telegram_auth_event(
            request, action=action, outcome="invalid_state", user_id=user_id
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS)

    issued_at = state_record.get("issued_at")
    if not isinstance(issued_at, int):
        _audit_telegram_auth_event(
            request, action=action, outcome="invalid_state", user_id=user_id
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS)

    if int(time.time()) - issued_at > TELEGRAM_SESSION_STATE_TTL_SECONDS:
        _audit_telegram_auth_event(
            request, action=action, outcome="expired_state", user_id=user_id
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS)


@router.get("/telegram/state", response_model=TelegramStateResponse)
async def telegram_auth_state(request: Request):
    if not request.app.state.config.ENABLE_TELEGRAM_AUTH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )
    _enforce_telegram_rate_limit(request, action="state")

    state = secrets.token_urlsafe(32)

    request.session[TELEGRAM_SESSION_STATE_KEY] = {
        "state": state,
        "issued_at": int(time.time()),
    }

    return {"state": state}


@router.post("/telegram/signin", response_model=SessionUserResponse)
async def telegram_signin(
    request: Request,
    response: Response,
    form_data: TelegramAuthForm,
    db: Session = Depends(get_session),
):
    if not request.app.state.config.ENABLE_TELEGRAM_AUTH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    bot_token = str(request.app.state.config.TELEGRAM_BOT_TOKEN or "").strip()
    if bot_token == "":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram authentication is not configured.",
        )

    _consume_telegram_state(request, form_data.state, action="signin")
    _enforce_telegram_rate_limit(request, action="signin")

    try:
        verified = verify_and_extract_telegram_user(
            form_data.payload.model_dump(exclude_none=True, exclude_unset=True),
            bot_token,
            max_age_seconds=request.app.state.config.TELEGRAM_AUTH_MAX_AGE_SECONDS,
        )
    except TelegramAuthError:
        _audit_telegram_auth_event(request, action="signin", outcome="invalid_payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS
        )

    user = Users.get_user_by_oauth_sub("telegram", verified.sub, db=db)
    if not user:
        _audit_telegram_auth_event(
            request,
            action="signin",
            outcome="not_linked",
            telegram_id=verified.telegram_id,
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="NOT_LINKED")

    expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
    expires_at = None
    if expires_delta:
        expires_at = int(time.time()) + int(expires_delta.total_seconds())

    token = create_token(data={"id": user.id}, expires_delta=expires_delta)

    datetime_expires_at = (
        datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
        if expires_at
        else None
    )

    response.set_cookie(
        key="token",
        value=token,
        expires=datetime_expires_at,
        httponly=True,
        samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
        secure=WEBUI_AUTH_COOKIE_SECURE,
    )

    user_permissions = get_permissions(
        user.id, request.app.state.config.USER_PERMISSIONS, db=db
    )

    _audit_telegram_auth_event(
        request,
        action="signin",
        outcome="success",
        user_id=user.id,
        telegram_id=verified.telegram_id,
    )

    return {
        "token": token,
        "token_type": "Bearer",
        "expires_at": expires_at,
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "profile_image_url": user.profile_image_url,
        "permissions": user_permissions,
    }


@router.post("/telegram/signup", response_model=SessionUserResponse)
async def telegram_signup(
    request: Request,
    response: Response,
    form_data: TelegramAuthForm,
    db: Session = Depends(get_session),
):
    if not request.app.state.config.ENABLE_TELEGRAM_AUTH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    if not request.app.state.config.ENABLE_TELEGRAM_SIGNUP:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SIGNUP_DISABLED",
        )

    bot_token = str(request.app.state.config.TELEGRAM_BOT_TOKEN or "").strip()
    if bot_token == "":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram authentication is not configured.",
        )

    if not form_data.terms_accepted or not form_data.privacy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the terms and privacy policy",
        )

    _consume_telegram_state(request, form_data.state, action="signup")
    _enforce_telegram_rate_limit(request, action="signup")

    try:
        verified = verify_and_extract_telegram_user(
            form_data.payload.model_dump(exclude_none=True, exclude_unset=True),
            bot_token,
            max_age_seconds=request.app.state.config.TELEGRAM_AUTH_MAX_AGE_SECONDS,
        )
    except TelegramAuthError:
        _audit_telegram_auth_event(request, action="signup", outcome="invalid_payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS
        )

    existing_user = Users.get_user_by_oauth_sub("telegram", verified.sub, db=db)
    created_user = False
    if existing_user:
        user = existing_user
    else:
        email = f"telegram@{verified.telegram_id}.local"
        if Users.get_user_by_email(email, db=db):
            _audit_telegram_auth_event(
                request,
                action="signup",
                outcome="email_taken",
                telegram_id=verified.telegram_id,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=ERROR_MESSAGES.EMAIL_TAKEN
            )

        has_users = Users.has_users(db=db)
        role = "admin" if not has_users else request.app.state.config.DEFAULT_USER_ROLE

        profile_image_url = verified.photo_url or "/user.png"
        random_password = str(uuid.uuid4())
        hashed = get_password_hash(random_password)

        user = Auths.insert_new_auth(
            email=email,
            password=hashed,
            name=verified.display_name,
            profile_image_url=profile_image_url,
            role=role,
            db=db,
        )

        if not user:
            _audit_telegram_auth_event(
                request,
                action="signup",
                outcome="create_failed",
                telegram_id=verified.telegram_id,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=ERROR_MESSAGES.CREATE_USER_ERROR,
            )

        Users.update_user_oauth_by_id(user.id, "telegram", verified.sub, db=db)
        apply_default_group_assignment(
            request.app.state.config.DEFAULT_GROUP_ID,
            user.id,
            db=db,
        )
        record_legal_acceptances(
            user_id=user.id,
            keys=["terms_offer", "privacy_policy"],
            request=request,
            method="telegram_signup",
        )
        created_user = True

    expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
    expires_at = None
    if expires_delta:
        expires_at = int(time.time()) + int(expires_delta.total_seconds())

    token = create_token(data={"id": user.id}, expires_delta=expires_delta)

    datetime_expires_at = (
        datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
        if expires_at
        else None
    )

    response.set_cookie(
        key="token",
        value=token,
        expires=datetime_expires_at,
        httponly=True,
        samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
        secure=WEBUI_AUTH_COOKIE_SECURE,
    )

    user_permissions = get_permissions(
        user.id, request.app.state.config.USER_PERMISSIONS, db=db
    )

    _audit_telegram_auth_event(
        request,
        action="signup",
        outcome="success_created" if created_user else "success_existing",
        user_id=user.id,
        telegram_id=verified.telegram_id,
    )

    return {
        "token": token,
        "token_type": "Bearer",
        "expires_at": expires_at,
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "profile_image_url": user.profile_image_url,
        "permissions": user_permissions,
    }


@router.post("/telegram/link")
async def telegram_link(
    request: Request,
    form_data: TelegramAuthForm,
    session_user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if not request.app.state.config.ENABLE_TELEGRAM_AUTH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    bot_token = str(request.app.state.config.TELEGRAM_BOT_TOKEN or "").strip()
    if bot_token == "":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram authentication is not configured.",
        )

    _consume_telegram_state(
        request,
        form_data.state,
        action="link",
        user_id=session_user.id,
    )
    _enforce_telegram_rate_limit(request, action="link")

    try:
        verified = verify_and_extract_telegram_user(
            form_data.payload.model_dump(exclude_none=True, exclude_unset=True),
            bot_token,
            max_age_seconds=request.app.state.config.TELEGRAM_AUTH_MAX_AGE_SECONDS,
        )
    except TelegramAuthError:
        _audit_telegram_auth_event(
            request,
            action="link",
            outcome="invalid_payload",
            user_id=session_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.MALICIOUS
        )

    existing = Users.get_user_by_oauth_sub("telegram", verified.sub, db=db)
    if existing and existing.id != session_user.id:
        _audit_telegram_auth_event(
            request,
            action="link",
            outcome="already_linked",
            user_id=session_user.id,
            telegram_id=verified.telegram_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="TELEGRAM_ALREADY_LINKED"
        )

    updated_user = Users.update_user_oauth_by_id(
        session_user.id, "telegram", verified.sub, db=db
    )
    if not updated_user:
        _audit_telegram_auth_event(
            request,
            action="link",
            outcome="update_failed",
            user_id=session_user.id,
            telegram_id=verified.telegram_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_MESSAGES.DEFAULT(),
        )

    _audit_telegram_auth_event(
        request,
        action="link",
        outcome="success",
        user_id=session_user.id,
        telegram_id=verified.telegram_id,
    )

    return {"status": True}


@router.delete("/telegram/link")
async def telegram_unlink(
    request: Request,
    form_data: TelegramUnlinkForm,
    session_user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if not request.app.state.config.ENABLE_TELEGRAM_AUTH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )
    _consume_telegram_state(
        request,
        form_data.state,
        action="unlink",
        user_id=session_user.id,
    )
    _enforce_telegram_rate_limit(request, action="unlink")

    updated_user = Users.remove_user_oauth_provider_by_id(
        session_user.id, "telegram", db=db
    )
    if not updated_user:
        _audit_telegram_auth_event(
            request,
            action="unlink",
            outcome="update_failed",
            user_id=session_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_MESSAGES.DEFAULT(),
        )

    _audit_telegram_auth_event(
        request,
        action="unlink",
        outcome="success",
        user_id=session_user.id,
    )

    return {"status": True}
