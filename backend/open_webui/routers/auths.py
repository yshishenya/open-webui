import re
import secrets
import uuid
import time
import datetime
import logging
from aiohttp import ClientSession
import urllib


from open_webui.models.auths import (
    AddUserForm,
    ApiKey,
    Auths,
    Token,
    LdapForm,
    SigninForm,
    SigninResponse,
    SignupForm,
    UpdatePasswordForm,
)
from open_webui.models.users import (
    UserProfileImageResponse,
    Users,
    UpdateProfileForm,
    UserStatus,
)
from open_webui.models.groups import Groups
from open_webui.models.oauth_sessions import OAuthSessions
from open_webui.models.email_verification import EmailVerificationTokens
from open_webui.models.password_reset import PasswordResetTokens
from open_webui.utils.email import email_service

from open_webui.constants import ERROR_MESSAGES, WEBHOOK_MESSAGES
from open_webui.env import (
    WEBUI_AUTH,
    WEBUI_AUTH_TRUSTED_EMAIL_HEADER,
    WEBUI_AUTH_TRUSTED_NAME_HEADER,
    WEBUI_AUTH_TRUSTED_GROUPS_HEADER,
    WEBUI_AUTH_COOKIE_SAME_SITE,
    WEBUI_AUTH_COOKIE_SECURE,
    WEBUI_AUTH_SIGNOUT_REDIRECT_URL,
    ENABLE_INITIAL_ADMIN_SIGNUP,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response, JSONResponse
from open_webui.config import (
    OPENID_PROVIDER_URL,
    ENABLE_OAUTH_SIGNUP,
    ENABLE_LDAP,
    ENABLE_PASSWORD_AUTH,
)
from pydantic import BaseModel, ConfigDict

from open_webui.utils.misc import parse_duration, validate_email_format
from open_webui.utils.airis.legal_acceptance import record_legal_acceptances
from open_webui.utils.auth import (
    validate_password,
    verify_password,
    decode_token,
    invalidate_token,
    create_api_key,
    create_token,
    get_admin_user,
    get_verified_user,
    get_current_user,
    get_password_hash,
    get_http_authorization_cred,
)
from open_webui.internal.db import get_session
from sqlalchemy.orm import Session
from open_webui.utils.webhook import post_webhook
from open_webui.utils.access_control import get_permissions, has_permission
from open_webui.utils.groups import apply_default_group_assignment

from open_webui.utils.redis import get_redis_client
from open_webui.utils.rate_limit import RateLimiter
from open_webui.utils.telegram_auth import TelegramAuthError, verify_and_extract_telegram_user


from typing import Optional, List

from ssl import CERT_NONE, CERT_REQUIRED, PROTOCOL_TLS

from ldap3 import Server, Connection, NONE, Tls
from ldap3.utils.conv import escape_filter_chars

router = APIRouter()

log = logging.getLogger(__name__)

signin_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=5 * 3, window=60 * 3
)

email_verification_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=3, window=60 * 60  # 3 emails per hour
)

password_reset_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=3, window=60 * 60  # 3 reset requests per hour
)

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

############################
# GetSessionUser
############################


class SessionUserResponse(Token, UserProfileImageResponse):
    expires_at: Optional[int] = None
    permissions: Optional[dict] = None


class SessionUserInfoResponse(SessionUserResponse, UserStatus):
    bio: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime.date] = None


############################
# Telegram Auth (Login Widget)
############################


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


class TelegramUnlinkForm(BaseModel):
    state: str


class TelegramStateResponse(BaseModel):
    state: str


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
    _enforce_telegram_rate_limit(request, action="state")

    state = secrets.token_urlsafe(32)

    request.session[TELEGRAM_SESSION_STATE_KEY] = {
        "state": state,
        "issued_at": int(time.time()),
    }

    return {"state": state}


@router.get("/", response_model=SessionUserInfoResponse)
async def get_session_user(
    request: Request,
    response: Response,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):

    auth_header = request.headers.get("Authorization")
    auth_token = get_http_authorization_cred(auth_header)
    token = auth_token.credentials
    data = decode_token(token)

    expires_at = None

    if data:
        expires_at = data.get("exp")

        if (expires_at is not None) and int(time.time()) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.INVALID_TOKEN,
            )

        # Set the cookie token
        response.set_cookie(
            key="token",
            value=token,
            expires=(
                datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
                if expires_at
                else None
            ),
            httponly=True,  # Ensures the cookie is not accessible via JavaScript
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

    user_permissions = get_permissions(
        user.id, request.app.state.config.USER_PERMISSIONS, db=db
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
        "bio": user.bio,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "status_emoji": user.status_emoji,
        "status_message": user.status_message,
        "status_expires_at": user.status_expires_at,
        "permissions": user_permissions,
    }


############################
# Update Profile
############################


@router.post("/update/profile", response_model=UserProfileImageResponse)
async def update_profile(
    form_data: UpdateProfileForm,
    session_user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if session_user:
        user = Users.update_user_by_id(
            session_user.id,
            form_data.model_dump(),
            db=db,
        )
        if user:
            return user
        else:
            raise HTTPException(400, detail=ERROR_MESSAGES.DEFAULT())
    else:
        raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_CRED)


############################
# Update Timezone
############################


class UpdateTimezoneForm(BaseModel):
    timezone: str


@router.post("/update/timezone")
async def update_timezone(
    form_data: UpdateTimezoneForm,
    session_user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if session_user:
        Users.update_user_by_id(
            session_user.id,
            {"timezone": form_data.timezone},
            db=db,
        )
        return {"status": True}
    else:
        raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_CRED)


############################
# Update Password
############################


@router.post("/update/password", response_model=bool)
async def update_password(
    form_data: UpdatePasswordForm,
    session_user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if WEBUI_AUTH_TRUSTED_EMAIL_HEADER:
        raise HTTPException(400, detail=ERROR_MESSAGES.ACTION_PROHIBITED)
    if session_user:
        user = Auths.authenticate_user(
            session_user.email,
            lambda pw: verify_password(form_data.password, pw),
            db=db,
        )

        if user:
            try:
                validate_password(form_data.password)
            except Exception as e:
                raise HTTPException(400, detail=str(e))
            hashed = get_password_hash(form_data.new_password)
            return Auths.update_user_password_by_id(user.id, hashed, db=db)
        else:
            raise HTTPException(400, detail=ERROR_MESSAGES.INCORRECT_PASSWORD)
    else:
        raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_CRED)


############################
# LDAP Authentication
############################
@router.post("/ldap", response_model=SessionUserResponse)
async def ldap_auth(
    request: Request,
    response: Response,
    form_data: LdapForm,
    db: Session = Depends(get_session),
):
    # Security checks FIRST - before loading any config
    if not request.app.state.config.ENABLE_LDAP:
        raise HTTPException(400, detail="LDAP authentication is not enabled")

    if not ENABLE_PASSWORD_AUTH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ERROR_MESSAGES.ACTION_PROHIBITED,
        )

    # NOW load LDAP config variables
    LDAP_SERVER_LABEL = request.app.state.config.LDAP_SERVER_LABEL
    LDAP_SERVER_HOST = request.app.state.config.LDAP_SERVER_HOST
    LDAP_SERVER_PORT = request.app.state.config.LDAP_SERVER_PORT
    LDAP_ATTRIBUTE_FOR_MAIL = request.app.state.config.LDAP_ATTRIBUTE_FOR_MAIL
    LDAP_ATTRIBUTE_FOR_USERNAME = request.app.state.config.LDAP_ATTRIBUTE_FOR_USERNAME
    LDAP_SEARCH_BASE = request.app.state.config.LDAP_SEARCH_BASE
    LDAP_SEARCH_FILTERS = request.app.state.config.LDAP_SEARCH_FILTERS
    LDAP_APP_DN = request.app.state.config.LDAP_APP_DN
    LDAP_APP_PASSWORD = request.app.state.config.LDAP_APP_PASSWORD
    LDAP_USE_TLS = request.app.state.config.LDAP_USE_TLS
    LDAP_CA_CERT_FILE = request.app.state.config.LDAP_CA_CERT_FILE
    LDAP_VALIDATE_CERT = (
        CERT_REQUIRED if request.app.state.config.LDAP_VALIDATE_CERT else CERT_NONE
    )
    LDAP_CIPHERS = (
        request.app.state.config.LDAP_CIPHERS
        if request.app.state.config.LDAP_CIPHERS
        else "ALL"
    )

    try:
        tls = Tls(
            validate=LDAP_VALIDATE_CERT,
            version=PROTOCOL_TLS,
            ca_certs_file=LDAP_CA_CERT_FILE,
            ciphers=LDAP_CIPHERS,
        )
    except Exception as e:
        log.error(f"TLS configuration error: {str(e)}")
        raise HTTPException(400, detail="Failed to configure TLS for LDAP connection.")

    try:
        server = Server(
            host=LDAP_SERVER_HOST,
            port=LDAP_SERVER_PORT,
            get_info=NONE,
            use_ssl=LDAP_USE_TLS,
            tls=tls,
        )
        connection_app = Connection(
            server,
            LDAP_APP_DN,
            LDAP_APP_PASSWORD,
            auto_bind="NONE",
            authentication="SIMPLE" if LDAP_APP_DN else "ANONYMOUS",
        )
        if not connection_app.bind():
            raise HTTPException(400, detail="Application account bind failed")

        ENABLE_LDAP_GROUP_MANAGEMENT = (
            request.app.state.config.ENABLE_LDAP_GROUP_MANAGEMENT
        )
        ENABLE_LDAP_GROUP_CREATION = request.app.state.config.ENABLE_LDAP_GROUP_CREATION
        LDAP_ATTRIBUTE_FOR_GROUPS = request.app.state.config.LDAP_ATTRIBUTE_FOR_GROUPS

        search_attributes = [
            f"{LDAP_ATTRIBUTE_FOR_USERNAME}",
            f"{LDAP_ATTRIBUTE_FOR_MAIL}",
            "cn",
        ]
        if ENABLE_LDAP_GROUP_MANAGEMENT:
            search_attributes.append(f"{LDAP_ATTRIBUTE_FOR_GROUPS}")
            log.info(
                f"LDAP Group Management enabled. Adding {LDAP_ATTRIBUTE_FOR_GROUPS} to search attributes"
            )
        log.info(f"LDAP search attributes: {search_attributes}")

        search_success = connection_app.search(
            search_base=LDAP_SEARCH_BASE,
            search_filter=f"(&({LDAP_ATTRIBUTE_FOR_USERNAME}={escape_filter_chars(form_data.user.lower())}){LDAP_SEARCH_FILTERS})",
            attributes=search_attributes,
        )
        if not search_success or not connection_app.entries:
            raise HTTPException(400, detail="User not found in the LDAP server")

        entry = connection_app.entries[0]
        entry_username = entry[f"{LDAP_ATTRIBUTE_FOR_USERNAME}"].value
        email = entry[
            f"{LDAP_ATTRIBUTE_FOR_MAIL}"
        ].value  # retrieve the Attribute value

        username_list = []  # list of usernames from LDAP attribute
        if isinstance(entry_username, list):
            username_list = [str(name).lower() for name in entry_username]
        else:
            username_list = [str(entry_username).lower()]

        # TODO: support multiple emails if LDAP returns a list
        if not email:
            raise HTTPException(400, "User does not have a valid email address.")
        elif isinstance(email, str):
            email = email.lower()
        elif isinstance(email, list):
            email = email[0].lower()
        else:
            email = str(email).lower()

        cn = str(entry["cn"])  # common name
        user_dn = entry.entry_dn  # user distinguished name

        user_groups = []
        if ENABLE_LDAP_GROUP_MANAGEMENT and LDAP_ATTRIBUTE_FOR_GROUPS in entry:
            group_dns = entry[LDAP_ATTRIBUTE_FOR_GROUPS]
            log.info(f"LDAP raw group DNs for user {username_list}: {group_dns}")

            if group_dns:
                log.info(f"LDAP group_dns original: {group_dns}")
                log.info(f"LDAP group_dns type: {type(group_dns)}")
                log.info(f"LDAP group_dns length: {len(group_dns)}")

                if hasattr(group_dns, "value"):
                    group_dns = group_dns.value
                    log.info(f"Extracted .value property: {group_dns}")
                elif hasattr(group_dns, "__iter__") and not isinstance(
                    group_dns, (str, bytes)
                ):
                    group_dns = list(group_dns)
                    log.info(f"Converted to list: {group_dns}")

                if isinstance(group_dns, list):
                    group_dns = [str(item) for item in group_dns]
                else:
                    group_dns = [str(group_dns)]

                log.info(
                    f"LDAP group_dns after processing - type: {type(group_dns)}, length: {len(group_dns)}"
                )

                for group_idx, group_dn in enumerate(group_dns):
                    group_dn = str(group_dn)
                    log.info(f"Processing group DN #{group_idx + 1}: {group_dn}")

                    try:
                        group_cn = None

                        for item in group_dn.split(","):
                            item = item.strip()
                            if item.upper().startswith("CN="):
                                group_cn = item[3:]
                                break

                        if group_cn:
                            user_groups.append(group_cn)

                        else:
                            log.warning(
                                f"Could not extract CN from group DN: {group_dn}"
                            )
                    except Exception as e:
                        log.warning(
                            f"Failed to extract group name from DN {group_dn}: {e}"
                        )

                log.info(
                    f"LDAP groups for user {username_list}: {user_groups} (total: {len(user_groups)})"
                )
            else:
                log.info(f"No groups found for user {username_list}")
        elif ENABLE_LDAP_GROUP_MANAGEMENT:
            log.warning(
                f"LDAP Group Management enabled but {LDAP_ATTRIBUTE_FOR_GROUPS} attribute not found in user entry"
            )

        if username_list and form_data.user.lower() in username_list:
            connection_user = Connection(
                server,
                user_dn,
                form_data.password,
                auto_bind="NONE",
                authentication="SIMPLE",
            )
            if not connection_user.bind():
                raise HTTPException(400, "Authentication failed.")

            user = Users.get_user_by_email(email, db=db)
            if not user:
                try:
                    role = (
                        "admin"
                        if not Users.has_users(db=db)
                        else request.app.state.config.DEFAULT_USER_ROLE
                    )

                    user = Auths.insert_new_auth(
                        email=email,
                        password=str(uuid.uuid4()),
                        name=cn,
                        role=role,
                        db=db,
                    )

                    if not user:
                        raise HTTPException(
                            500, detail=ERROR_MESSAGES.CREATE_USER_ERROR
                        )

                    apply_default_group_assignment(
                        request.app.state.config.DEFAULT_GROUP_ID,
                        user.id,
                        db=db,
                    )

                except HTTPException:
                    raise
                except Exception as err:
                    log.error(f"LDAP user creation error: {str(err)}")
                    raise HTTPException(
                        500, detail="Internal error occurred during LDAP user creation."
                    )

            user = Auths.authenticate_user_by_email(email, db=db)

            if user:
                expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
                expires_at = None
                if expires_delta:
                    expires_at = int(time.time()) + int(expires_delta.total_seconds())

                token = create_token(
                    data={"id": user.id},
                    expires_delta=expires_delta,
                )

                # Set the cookie token
                response.set_cookie(
                    key="token",
                    value=token,
                    expires=(
                        datetime.datetime.fromtimestamp(
                            expires_at, datetime.timezone.utc
                        )
                        if expires_at
                        else None
                    ),
                    httponly=True,  # Ensures the cookie is not accessible via JavaScript
                    samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
                    secure=WEBUI_AUTH_COOKIE_SECURE,
                )

                user_permissions = get_permissions(
                    user.id, request.app.state.config.USER_PERMISSIONS, db=db
                )

                if (
                    user.role != "admin"
                    and ENABLE_LDAP_GROUP_MANAGEMENT
                    and user_groups
                ):
                    if ENABLE_LDAP_GROUP_CREATION:
                        Groups.create_groups_by_group_names(user.id, user_groups, db=db)
                    try:
                        Groups.sync_groups_by_group_names(user.id, user_groups, db=db)
                        log.info(
                            f"Successfully synced groups for user {user.id}: {user_groups}"
                        )
                    except Exception as e:
                        log.error(f"Failed to sync groups for user {user.id}: {e}")

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
            else:
                raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_CRED)
        else:
            raise HTTPException(400, "User record mismatch.")
    except Exception as e:
        log.error(f"LDAP authentication error: {str(e)}")
        raise HTTPException(400, detail="LDAP authentication failed.")


############################
# SignIn
############################


@router.post("/signin", response_model=SessionUserResponse)
async def signin(
    request: Request,
    response: Response,
    form_data: SigninForm,
    db: Session = Depends(get_session),
):
    if not ENABLE_PASSWORD_AUTH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ERROR_MESSAGES.ACTION_PROHIBITED,
        )

    if WEBUI_AUTH_TRUSTED_EMAIL_HEADER:
        if WEBUI_AUTH_TRUSTED_EMAIL_HEADER not in request.headers:
            raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_TRUSTED_HEADER)

        email = request.headers[WEBUI_AUTH_TRUSTED_EMAIL_HEADER].lower()
        name = email

        if WEBUI_AUTH_TRUSTED_NAME_HEADER:
            name = request.headers.get(WEBUI_AUTH_TRUSTED_NAME_HEADER, email)
            try:
                name = urllib.parse.unquote(name, encoding="utf-8")
            except Exception as e:
                pass

        if not Users.get_user_by_email(email.lower(), db=db):
            await signup(
                request,
                response,
                SignupForm(
                    email=email,
                    password=str(uuid.uuid4()),
                    name=name,
                    terms_accepted=True,
                    privacy_accepted=True,
                ),
                db=db,
            )

        user = Auths.authenticate_user_by_email(email, db=db)
        if WEBUI_AUTH_TRUSTED_GROUPS_HEADER and user and user.role != "admin":
            group_names = request.headers.get(
                WEBUI_AUTH_TRUSTED_GROUPS_HEADER, ""
            ).split(",")
            group_names = [name.strip() for name in group_names if name.strip()]

            if group_names:
                Groups.sync_groups_by_group_names(user.id, group_names, db=db)

    elif WEBUI_AUTH == False:
        admin_email = "admin@localhost"
        admin_password = "admin"

        if Users.get_user_by_email(admin_email.lower(), db=db):
            user = Auths.authenticate_user(
                admin_email.lower(),
                lambda pw: verify_password(admin_password, pw),
                db=db,
            )
        else:
            if Users.has_users(db=db):
                raise HTTPException(400, detail=ERROR_MESSAGES.EXISTING_USERS)

            await signup(
                request,
                response,
                SignupForm(
                    email=admin_email,
                    password=admin_password,
                    name="User",
                    terms_accepted=True,
                    privacy_accepted=True,
                ),
                db=db,
            )

            user = Auths.authenticate_user(
                admin_email.lower(),
                lambda pw: verify_password(admin_password, pw),
                db=db,
            )
    else:
        if signin_rate_limiter.is_limited(form_data.email.lower()):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
            )

        password_bytes = form_data.password.encode("utf-8")
        if len(password_bytes) > 72:
            # TODO: Implement other hashing algorithms that support longer passwords
            log.info("Password too long, truncating to 72 bytes for bcrypt")
            password_bytes = password_bytes[:72]

            # decode safely — ignore incomplete UTF-8 sequences
            form_data.password = password_bytes.decode("utf-8", errors="ignore")

        user = Auths.authenticate_user(
            form_data.email.lower(),
            lambda pw: verify_password(form_data.password, pw),
            db=db,
        )

    if user:

        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        datetime_expires_at = (
            datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
            if expires_at
            else None
        )

        # Set the cookie token
        response.set_cookie(
            key="token",
            value=token,
            expires=datetime_expires_at,
            httponly=True,  # Ensures the cookie is not accessible via JavaScript
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        user_permissions = get_permissions(
            user.id, request.app.state.config.USER_PERMISSIONS, db=db
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
    else:
        raise HTTPException(400, detail=ERROR_MESSAGES.INVALID_CRED)


############################
# SignUp
############################


@router.post("/signup", response_model=SessionUserResponse)
async def signup(
    request: Request,
    response: Response,
    form_data: SignupForm,
    db: Session = Depends(get_session),
):
    has_users = Users.has_users(db=db)

    if WEBUI_AUTH:
        if (
            not request.app.state.config.ENABLE_SIGNUP
            or not request.app.state.config.ENABLE_LOGIN_FORM
        ):
            if has_users or not ENABLE_INITIAL_ADMIN_SIGNUP:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.ACCESS_PROHIBITED
                )
    else:
        if has_users:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail=ERROR_MESSAGES.ACCESS_PROHIBITED
            )

    if not validate_email_format(form_data.email.lower()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.INVALID_EMAIL_FORMAT
        )

    if Users.get_user_by_email(form_data.email.lower(), db=db):
        raise HTTPException(400, detail=ERROR_MESSAGES.EMAIL_TAKEN)

    if not form_data.terms_accepted or not form_data.privacy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the terms and privacy policy",
        )

    try:
        try:
            validate_password(form_data.password)
        except Exception as e:
            raise HTTPException(400, detail=str(e))

        hashed = get_password_hash(form_data.password)

        role = "admin" if not has_users else request.app.state.config.DEFAULT_USER_ROLE
        user = Auths.insert_new_auth(
            form_data.email.lower(),
            hashed,
            form_data.name,
            form_data.profile_image_url,
            role,
            db=db,
        )

        if user:
            record_legal_acceptances(
                user_id=user.id,
                keys=["terms_offer", "privacy_policy"],
                request=request,
                method="signup",
            )
            
            # Create and send email verification token
            if email_service.is_configured():
                try:
                    # Create verification token
                    token_record = EmailVerificationTokens.create_verification_token(
                        user_id=user.id,
                        email=user.email
                    )
                    
                    if token_record:
                        # Send verification email
                        await email_service.send_verification_email(
                            to_email=user.email,
                            name=user.name,
                            verification_token=token_record.token
                        )
                        log.info(f"Verification email sent to new user {user.email}")
                except Exception as e:
                    log.error(f"Failed to send verification email to {user.email}: {e}")
            
            expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
            expires_at = None
            if expires_delta:
                expires_at = int(time.time()) + int(expires_delta.total_seconds())

            token = create_token(
                data={"id": user.id},
                expires_delta=expires_delta,
            )

            datetime_expires_at = (
                datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
                if expires_at
                else None
            )

            # Set the cookie token
            response.set_cookie(
                key="token",
                value=token,
                expires=datetime_expires_at,
                httponly=True,  # Ensures the cookie is not accessible via JavaScript
                samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
                secure=WEBUI_AUTH_COOKIE_SECURE,
            )

            if request.app.state.config.WEBHOOK_URL:
                await post_webhook(
                    request.app.state.WEBUI_NAME,
                    request.app.state.config.WEBHOOK_URL,
                    WEBHOOK_MESSAGES.USER_SIGNUP(user.name),
                    {
                        "action": "signup",
                        "message": WEBHOOK_MESSAGES.USER_SIGNUP(user.name),
                        "user": user.model_dump_json(exclude_none=True),
                    },
                )

            user_permissions = get_permissions(
                user.id, request.app.state.config.USER_PERMISSIONS, db=db
            )

            if not has_users:
                # Disable signup after the first user is created
                request.app.state.config.ENABLE_SIGNUP = False

            apply_default_group_assignment(
                request.app.state.config.DEFAULT_GROUP_ID,
                user.id,
                db=db,
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
        else:
            raise HTTPException(500, detail=ERROR_MESSAGES.CREATE_USER_ERROR)
    except Exception as err:
        log.error(f"Signup error: {str(err)}")
        raise HTTPException(500, detail="An internal error occurred during signup.")


############################
# Telegram SignIn
############################


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

    token = create_token(
        data={"id": user.id},
        expires_delta=expires_delta,
    )

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


############################
# Telegram SignUp
############################


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
        created_user = True

    expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
    expires_at = None
    if expires_delta:
        expires_at = int(time.time()) + int(expires_delta.total_seconds())

    token = create_token(
        data={"id": user.id},
        expires_delta=expires_delta,
    )

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


############################
# Telegram Link / Unlink
############################


@router.post("/telegram/link", response_model=dict)
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


@router.delete("/telegram/link", response_model=dict)
async def telegram_unlink(
    request: Request,
    form_data: TelegramUnlinkForm,
    session_user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
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


@router.get("/signout")
async def signout(
    request: Request, response: Response, db: Session = Depends(get_session)
):

    # get auth token from headers or cookies
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header:
        auth_cred = get_http_authorization_cred(auth_header)
        token = auth_cred.credentials
    else:
        token = request.cookies.get("token")

    if token:
        await invalidate_token(request, token)

    response.delete_cookie("token")
    response.delete_cookie("oui-session")
    response.delete_cookie("oauth_id_token")

    oauth_session_id = request.cookies.get("oauth_session_id")
    if oauth_session_id:
        response.delete_cookie("oauth_session_id")

        session = OAuthSessions.get_session_by_id(oauth_session_id, db=db)
        oauth_server_metadata_url = (
            request.app.state.oauth_manager.get_server_metadata_url(session.provider)
            if session
            else None
        ) or OPENID_PROVIDER_URL.value

        if session and oauth_server_metadata_url:
            oauth_id_token = session.token.get("id_token")
            try:
                async with ClientSession(trust_env=True) as session:
                    async with session.get(oauth_server_metadata_url) as r:
                        if r.status == 200:
                            openid_data = await r.json()
                            logout_url = openid_data.get("end_session_endpoint")

                            if logout_url:
                                return JSONResponse(
                                    status_code=200,
                                    content={
                                        "status": True,
                                        "redirect_url": f"{logout_url}?id_token_hint={oauth_id_token}"
                                        + (
                                            f"&post_logout_redirect_uri={WEBUI_AUTH_SIGNOUT_REDIRECT_URL}"
                                            if WEBUI_AUTH_SIGNOUT_REDIRECT_URL
                                            else ""
                                        ),
                                    },
                                    headers=response.headers,
                                )
                        else:
                            raise Exception("Failed to fetch OpenID configuration")

            except Exception as e:
                log.error(f"OpenID signout error: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to sign out from the OpenID provider.",
                    headers=response.headers,
                )

    if WEBUI_AUTH_SIGNOUT_REDIRECT_URL:
        return JSONResponse(
            status_code=200,
            content={
                "status": True,
                "redirect_url": WEBUI_AUTH_SIGNOUT_REDIRECT_URL,
            },
            headers=response.headers,
        )

    return JSONResponse(
        status_code=200, content={"status": True}, headers=response.headers
    )


############################
# AddUser
############################


@router.post("/add", response_model=SigninResponse)
async def add_user(
    request: Request,
    form_data: AddUserForm,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    if not validate_email_format(form_data.email.lower()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.INVALID_EMAIL_FORMAT
        )

    if Users.get_user_by_email(form_data.email.lower(), db=db):
        raise HTTPException(400, detail=ERROR_MESSAGES.EMAIL_TAKEN)

    try:
        try:
            validate_password(form_data.password)
        except Exception as e:
            raise HTTPException(400, detail=str(e))

        hashed = get_password_hash(form_data.password)
        user = Auths.insert_new_auth(
            form_data.email.lower(),
            hashed,
            form_data.name,
            form_data.profile_image_url,
            form_data.role,
            db=db,
        )

        if user:
            apply_default_group_assignment(
                request.app.state.config.DEFAULT_GROUP_ID,
                user.id,
                db=db,
            )

            token = create_token(data={"id": user.id})
            return {
                "token": token,
                "token_type": "Bearer",
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "profile_image_url": user.profile_image_url,
            }
        else:
            raise HTTPException(500, detail=ERROR_MESSAGES.CREATE_USER_ERROR)
    except Exception as err:
        log.error(f"Add user error: {str(err)}")
        raise HTTPException(
            500, detail="An internal error occurred while adding the user."
        )


############################
# GetAdminDetails
############################


@router.get("/admin/details")
async def get_admin_details(
    request: Request, user=Depends(get_current_user), db: Session = Depends(get_session)
):
    if request.app.state.config.SHOW_ADMIN_DETAILS:
        admin_email = request.app.state.config.ADMIN_EMAIL
        admin_name = None

        log.info(f"Admin details - Email: {admin_email}, Name: {admin_name}")

        if admin_email:
            admin = Users.get_user_by_email(admin_email, db=db)
            if admin:
                admin_name = admin.name
        else:
            admin = Users.get_first_user(db=db)
            if admin:
                admin_email = admin.email
                admin_name = admin.name

        return {
            "name": admin_name,
            "email": admin_email,
        }
    else:
        raise HTTPException(400, detail=ERROR_MESSAGES.ACTION_PROHIBITED)


############################
# ToggleSignUp
############################


@router.get("/admin/config")
async def get_admin_config(request: Request, user=Depends(get_admin_user)):
    return {
        "SHOW_ADMIN_DETAILS": request.app.state.config.SHOW_ADMIN_DETAILS,
        "ADMIN_EMAIL": request.app.state.config.ADMIN_EMAIL,
        "WEBUI_URL": request.app.state.config.WEBUI_URL,
        "ENABLE_SIGNUP": request.app.state.config.ENABLE_SIGNUP,
        "ENABLE_API_KEYS": request.app.state.config.ENABLE_API_KEYS,
        "ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS": request.app.state.config.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS,
        "API_KEYS_ALLOWED_ENDPOINTS": request.app.state.config.API_KEYS_ALLOWED_ENDPOINTS,
        "DEFAULT_USER_ROLE": request.app.state.config.DEFAULT_USER_ROLE,
        "DEFAULT_GROUP_ID": request.app.state.config.DEFAULT_GROUP_ID,
        "JWT_EXPIRES_IN": request.app.state.config.JWT_EXPIRES_IN,
        "ENABLE_COMMUNITY_SHARING": request.app.state.config.ENABLE_COMMUNITY_SHARING,
        "ENABLE_MESSAGE_RATING": request.app.state.config.ENABLE_MESSAGE_RATING,
        "ENABLE_FOLDERS": request.app.state.config.ENABLE_FOLDERS,
        "FOLDER_MAX_FILE_COUNT": request.app.state.config.FOLDER_MAX_FILE_COUNT,
        "ENABLE_CHANNELS": request.app.state.config.ENABLE_CHANNELS,
        "ENABLE_MEMORIES": request.app.state.config.ENABLE_MEMORIES,
        "ENABLE_NOTES": request.app.state.config.ENABLE_NOTES,
        "ENABLE_USER_WEBHOOKS": request.app.state.config.ENABLE_USER_WEBHOOKS,
        "ENABLE_USER_STATUS": request.app.state.config.ENABLE_USER_STATUS,
        "PENDING_USER_OVERLAY_TITLE": request.app.state.config.PENDING_USER_OVERLAY_TITLE,
        "PENDING_USER_OVERLAY_CONTENT": request.app.state.config.PENDING_USER_OVERLAY_CONTENT,
        "RESPONSE_WATERMARK": request.app.state.config.RESPONSE_WATERMARK,
    }


class AdminConfig(BaseModel):
    SHOW_ADMIN_DETAILS: bool
    ADMIN_EMAIL: Optional[str] = None
    WEBUI_URL: str
    ENABLE_SIGNUP: bool
    ENABLE_API_KEYS: bool
    ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS: bool
    API_KEYS_ALLOWED_ENDPOINTS: str
    DEFAULT_USER_ROLE: str
    DEFAULT_GROUP_ID: str
    JWT_EXPIRES_IN: str
    ENABLE_COMMUNITY_SHARING: bool
    ENABLE_MESSAGE_RATING: bool
    ENABLE_FOLDERS: bool
    FOLDER_MAX_FILE_COUNT: Optional[int | str] = None
    ENABLE_CHANNELS: bool
    ENABLE_MEMORIES: bool
    ENABLE_NOTES: bool
    ENABLE_USER_WEBHOOKS: bool
    ENABLE_USER_STATUS: bool
    PENDING_USER_OVERLAY_TITLE: Optional[str] = None
    PENDING_USER_OVERLAY_CONTENT: Optional[str] = None
    RESPONSE_WATERMARK: Optional[str] = None


@router.post("/admin/config")
async def update_admin_config(
    request: Request, form_data: AdminConfig, user=Depends(get_admin_user)
):
    request.app.state.config.SHOW_ADMIN_DETAILS = form_data.SHOW_ADMIN_DETAILS
    request.app.state.config.ADMIN_EMAIL = form_data.ADMIN_EMAIL
    request.app.state.config.WEBUI_URL = form_data.WEBUI_URL
    request.app.state.config.ENABLE_SIGNUP = form_data.ENABLE_SIGNUP

    request.app.state.config.ENABLE_API_KEYS = form_data.ENABLE_API_KEYS
    request.app.state.config.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS = (
        form_data.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS
    )
    request.app.state.config.API_KEYS_ALLOWED_ENDPOINTS = (
        form_data.API_KEYS_ALLOWED_ENDPOINTS
    )

    request.app.state.config.ENABLE_FOLDERS = form_data.ENABLE_FOLDERS
    request.app.state.config.FOLDER_MAX_FILE_COUNT = (
        int(form_data.FOLDER_MAX_FILE_COUNT) if form_data.FOLDER_MAX_FILE_COUNT else ""
    )
    request.app.state.config.ENABLE_CHANNELS = form_data.ENABLE_CHANNELS
    request.app.state.config.ENABLE_MEMORIES = form_data.ENABLE_MEMORIES
    request.app.state.config.ENABLE_NOTES = form_data.ENABLE_NOTES

    if form_data.DEFAULT_USER_ROLE in ["pending", "user", "admin"]:
        request.app.state.config.DEFAULT_USER_ROLE = form_data.DEFAULT_USER_ROLE

    request.app.state.config.DEFAULT_GROUP_ID = form_data.DEFAULT_GROUP_ID

    pattern = r"^(-1|0|(-?\d+(\.\d+)?)(ms|s|m|h|d|w))$"

    # Check if the input string matches the pattern
    if re.match(pattern, form_data.JWT_EXPIRES_IN):
        request.app.state.config.JWT_EXPIRES_IN = form_data.JWT_EXPIRES_IN

    request.app.state.config.ENABLE_COMMUNITY_SHARING = (
        form_data.ENABLE_COMMUNITY_SHARING
    )
    request.app.state.config.ENABLE_MESSAGE_RATING = form_data.ENABLE_MESSAGE_RATING

    request.app.state.config.ENABLE_USER_WEBHOOKS = form_data.ENABLE_USER_WEBHOOKS
    request.app.state.config.ENABLE_USER_STATUS = form_data.ENABLE_USER_STATUS

    request.app.state.config.PENDING_USER_OVERLAY_TITLE = (
        form_data.PENDING_USER_OVERLAY_TITLE
    )
    request.app.state.config.PENDING_USER_OVERLAY_CONTENT = (
        form_data.PENDING_USER_OVERLAY_CONTENT
    )

    request.app.state.config.RESPONSE_WATERMARK = form_data.RESPONSE_WATERMARK

    return {
        "SHOW_ADMIN_DETAILS": request.app.state.config.SHOW_ADMIN_DETAILS,
        "ADMIN_EMAIL": request.app.state.config.ADMIN_EMAIL,
        "WEBUI_URL": request.app.state.config.WEBUI_URL,
        "ENABLE_SIGNUP": request.app.state.config.ENABLE_SIGNUP,
        "ENABLE_API_KEYS": request.app.state.config.ENABLE_API_KEYS,
        "ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS": request.app.state.config.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS,
        "API_KEYS_ALLOWED_ENDPOINTS": request.app.state.config.API_KEYS_ALLOWED_ENDPOINTS,
        "DEFAULT_USER_ROLE": request.app.state.config.DEFAULT_USER_ROLE,
        "DEFAULT_GROUP_ID": request.app.state.config.DEFAULT_GROUP_ID,
        "JWT_EXPIRES_IN": request.app.state.config.JWT_EXPIRES_IN,
        "ENABLE_COMMUNITY_SHARING": request.app.state.config.ENABLE_COMMUNITY_SHARING,
        "ENABLE_MESSAGE_RATING": request.app.state.config.ENABLE_MESSAGE_RATING,
        "ENABLE_FOLDERS": request.app.state.config.ENABLE_FOLDERS,
        "FOLDER_MAX_FILE_COUNT": request.app.state.config.FOLDER_MAX_FILE_COUNT,
        "ENABLE_CHANNELS": request.app.state.config.ENABLE_CHANNELS,
        "ENABLE_MEMORIES": request.app.state.config.ENABLE_MEMORIES,
        "ENABLE_NOTES": request.app.state.config.ENABLE_NOTES,
        "ENABLE_USER_WEBHOOKS": request.app.state.config.ENABLE_USER_WEBHOOKS,
        "ENABLE_USER_STATUS": request.app.state.config.ENABLE_USER_STATUS,
        "PENDING_USER_OVERLAY_TITLE": request.app.state.config.PENDING_USER_OVERLAY_TITLE,
        "PENDING_USER_OVERLAY_CONTENT": request.app.state.config.PENDING_USER_OVERLAY_CONTENT,
        "RESPONSE_WATERMARK": request.app.state.config.RESPONSE_WATERMARK,
    }


class LdapServerConfig(BaseModel):
    label: str
    host: str
    port: Optional[int] = None
    attribute_for_mail: str = "mail"
    attribute_for_username: str = "uid"
    app_dn: str
    app_dn_password: str
    search_base: str
    search_filters: str = ""
    use_tls: bool = True
    certificate_path: Optional[str] = None
    validate_cert: bool = True
    ciphers: Optional[str] = "ALL"


@router.get("/admin/config/ldap/server", response_model=LdapServerConfig)
async def get_ldap_server(request: Request, user=Depends(get_admin_user)):
    return {
        "label": request.app.state.config.LDAP_SERVER_LABEL,
        "host": request.app.state.config.LDAP_SERVER_HOST,
        "port": request.app.state.config.LDAP_SERVER_PORT,
        "attribute_for_mail": request.app.state.config.LDAP_ATTRIBUTE_FOR_MAIL,
        "attribute_for_username": request.app.state.config.LDAP_ATTRIBUTE_FOR_USERNAME,
        "app_dn": request.app.state.config.LDAP_APP_DN,
        "app_dn_password": request.app.state.config.LDAP_APP_PASSWORD,
        "search_base": request.app.state.config.LDAP_SEARCH_BASE,
        "search_filters": request.app.state.config.LDAP_SEARCH_FILTERS,
        "use_tls": request.app.state.config.LDAP_USE_TLS,
        "certificate_path": request.app.state.config.LDAP_CA_CERT_FILE,
        "validate_cert": request.app.state.config.LDAP_VALIDATE_CERT,
        "ciphers": request.app.state.config.LDAP_CIPHERS,
    }


@router.post("/admin/config/ldap/server")
async def update_ldap_server(
    request: Request, form_data: LdapServerConfig, user=Depends(get_admin_user)
):
    required_fields = [
        "label",
        "host",
        "attribute_for_mail",
        "attribute_for_username",
        "app_dn",
        "app_dn_password",
        "search_base",
    ]
    for key in required_fields:
        value = getattr(form_data, key)
        if not value:
            raise HTTPException(400, detail=f"Required field {key} is empty")

    request.app.state.config.LDAP_SERVER_LABEL = form_data.label
    request.app.state.config.LDAP_SERVER_HOST = form_data.host
    request.app.state.config.LDAP_SERVER_PORT = form_data.port
    request.app.state.config.LDAP_ATTRIBUTE_FOR_MAIL = form_data.attribute_for_mail
    request.app.state.config.LDAP_ATTRIBUTE_FOR_USERNAME = (
        form_data.attribute_for_username
    )
    request.app.state.config.LDAP_APP_DN = form_data.app_dn
    request.app.state.config.LDAP_APP_PASSWORD = form_data.app_dn_password
    request.app.state.config.LDAP_SEARCH_BASE = form_data.search_base
    request.app.state.config.LDAP_SEARCH_FILTERS = form_data.search_filters
    request.app.state.config.LDAP_USE_TLS = form_data.use_tls
    request.app.state.config.LDAP_CA_CERT_FILE = form_data.certificate_path
    request.app.state.config.LDAP_VALIDATE_CERT = form_data.validate_cert
    request.app.state.config.LDAP_CIPHERS = form_data.ciphers

    return {
        "label": request.app.state.config.LDAP_SERVER_LABEL,
        "host": request.app.state.config.LDAP_SERVER_HOST,
        "port": request.app.state.config.LDAP_SERVER_PORT,
        "attribute_for_mail": request.app.state.config.LDAP_ATTRIBUTE_FOR_MAIL,
        "attribute_for_username": request.app.state.config.LDAP_ATTRIBUTE_FOR_USERNAME,
        "app_dn": request.app.state.config.LDAP_APP_DN,
        "app_dn_password": request.app.state.config.LDAP_APP_PASSWORD,
        "search_base": request.app.state.config.LDAP_SEARCH_BASE,
        "search_filters": request.app.state.config.LDAP_SEARCH_FILTERS,
        "use_tls": request.app.state.config.LDAP_USE_TLS,
        "certificate_path": request.app.state.config.LDAP_CA_CERT_FILE,
        "validate_cert": request.app.state.config.LDAP_VALIDATE_CERT,
        "ciphers": request.app.state.config.LDAP_CIPHERS,
    }


@router.get("/admin/config/ldap")
async def get_ldap_config(request: Request, user=Depends(get_admin_user)):
    return {"ENABLE_LDAP": request.app.state.config.ENABLE_LDAP}


class LdapConfigForm(BaseModel):
    enable_ldap: Optional[bool] = None


@router.post("/admin/config/ldap")
async def update_ldap_config(
    request: Request, form_data: LdapConfigForm, user=Depends(get_admin_user)
):
    request.app.state.config.ENABLE_LDAP = form_data.enable_ldap
    return {"ENABLE_LDAP": request.app.state.config.ENABLE_LDAP}


############################
# API Key
############################


# create api key
@router.post("/api_key", response_model=ApiKey)
async def generate_api_key(
    request: Request, user=Depends(get_current_user), db: Session = Depends(get_session)
):
    if not request.app.state.config.ENABLE_API_KEYS or not has_permission(
        user.id, "features.api_keys", request.app.state.config.USER_PERMISSIONS
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ERROR_MESSAGES.API_KEY_CREATION_NOT_ALLOWED,
        )

    api_key = create_api_key()
    success = Users.update_user_api_key_by_id(user.id, api_key, db=db)

    if success:
        return {
            "api_key": api_key,
        }
    else:
        raise HTTPException(500, detail=ERROR_MESSAGES.CREATE_API_KEY_ERROR)


# delete api key
@router.delete("/api_key", response_model=bool)
async def delete_api_key(
    user=Depends(get_current_user), db: Session = Depends(get_session)
):
    return Users.delete_user_api_key_by_id(user.id, db=db)


# get api key
@router.get("/api_key", response_model=ApiKey)
async def get_api_key(
    user=Depends(get_current_user), db: Session = Depends(get_session)
):
    api_key = Users.get_user_api_key_by_id(user.id, db=db)
    if api_key:
        return {
            "api_key": api_key,
        }
    else:
        raise HTTPException(404, detail=ERROR_MESSAGES.API_KEY_NOT_FOUND)


############################
# Email Verification
############################


class VerifyEmailForm(BaseModel):
    token: str


class ResendVerificationForm(BaseModel):
    email: str


@router.get("/verify-email")
async def verify_email(token: str):
    """
    Verify email address using verification token
    
    This endpoint is called when user clicks the verification link in their email.
    On success, it marks the email as verified and sends a welcome email.
    """
    # Validate token
    if not EmailVerificationTokens.is_token_valid(token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Get token details
    token_record = EmailVerificationTokens.get_token_by_token_string(token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token not found"
        )
    
    # Get user
    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user email_verified status
    Users.update_user_by_id(user.id, {"email_verified": True})
    
    # Delete the token (one-time use)
    EmailVerificationTokens.delete_token_by_id(token_record.id)
    
    # Send welcome email
    try:
        await email_service.send_welcome_email(user.email, user.name)
    except Exception as e:
        log.error(f"Failed to send welcome email to {user.email}: {e}")

    log.info(f"Email verified for user {user.id} ({user.email})")
    
    return {
        "success": True,
        "message": "Email verified successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": True
        }
    }


@router.post("/resend-verification")
async def resend_verification_email(form_data: ResendVerificationForm):
    """
    Resend verification email to user
    
    Rate limited to 3 emails per hour per email address.
    """
    # Rate limiting
    if not email_verification_rate_limiter.check_rate_limit(
        key=f"email_verification:{form_data.email}"
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification emails sent. Please try again in an hour."
        )
    
    # Validate email format
    if not validate_email_format(form_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Get user by email
    user = Users.get_user_by_email(form_data.email.lower())
    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a verification link has been sent."
        }
    
    # Check if already verified
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    # Delete any existing verification tokens for this user
    existing_tokens = EmailVerificationTokens.get_tokens_by_user_id(user.id)
    for token in existing_tokens:
        EmailVerificationTokens.delete_token_by_id(token.id)
    
    # Create new verification token
    token_record = EmailVerificationTokens.create_verification_token(
        user_id=user.id,
        email=user.email
    )
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create verification token"
        )
    
    # Send verification email
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured"
        )
    
    success = await email_service.send_verification_email(
        to_email=user.email,
        name=user.name,
        verification_token=token_record.token
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )
    
    log.info(f"Verification email sent to {user.email}")
    
    return {
        "success": True,
        "message": "Verification email sent successfully"
    }


############################
# Password Reset
############################


class RequestPasswordResetForm(BaseModel):
    email: str


class ResetPasswordForm(BaseModel):
    token: str
    new_password: str


@router.post("/request-password-reset")
async def request_password_reset(form_data: RequestPasswordResetForm):
    """
    Request password reset - sends reset email to user
    
    Rate limited to 3 requests per hour per email address.
    """
    # Rate limiting
    if not password_reset_rate_limiter.check_rate_limit(
        key=f"password_reset:{form_data.email}"
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please try again in an hour."
        )
    
    # Validate email format
    if not validate_email_format(form_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Get user by email
    user = Users.get_user_by_email(form_data.email.lower())
    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a password reset link has been sent."
        }
    
    # Check if email service is configured
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured"
        )
    
    # Delete any existing password reset tokens for this user
    existing_tokens = PasswordResetTokens.get_tokens_by_user_id(user.id)
    for token in existing_tokens:
        PasswordResetTokens.delete_token_by_id(token.id)
    
    # Create new password reset token (2 hour expiry)
    token_record = PasswordResetTokens.create_reset_token(
        user_id=user.id,
        expiry_hours=2
    )
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create password reset token"
        )
    
    # Send password reset email
    success = await email_service.send_password_reset_email(
        to_email=user.email,
        name=user.name,
        reset_token=token_record.token
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email"
        )
    
    log.info(f"Password reset email sent to {user.email}")
    
    return {
        "success": True,
        "message": "If the email exists, a password reset link has been sent."
    }


@router.get("/validate-reset-token/{token}")
async def validate_reset_token(token: str):
    """
    Validate password reset token before showing reset form

    Проверить токен сброса пароля перед показом формы.
    """
    # Check if token is valid
    if not PasswordResetTokens.is_token_valid(token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )

    # Get token details
    token_record = PasswordResetTokens.get_token_by_token_string(token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token not found"
        )

    # Get user email (masked for security)
    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Mask email for privacy (show first 2 chars and domain)
    email_parts = user.email.split("@")
    masked_email = email_parts[0][:2] + "***@" + email_parts[1] if len(email_parts) == 2 else "***"

    return {
        "valid": True,
        "email": masked_email
    }


@router.post("/reset-password")
async def reset_password(form_data: ResetPasswordForm):
    """
    Reset password using reset token
    
    Validates the token, updates the password, and sends confirmation email.
    """
    # Validate token
    if not PasswordResetTokens.is_token_valid(form_data.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )
    
    # Get token details
    token_record = PasswordResetTokens.get_token_by_token_string(form_data.token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token not found"
        )
    
    # Get user
    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate new password
    try:
        validate_password(form_data.new_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Update user password
    hashed_password = get_password_hash(form_data.new_password)
    auth_user = Auths.get_auth_by_id(user.id)
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authentication record not found"
        )
    
    success = Auths.update_user_password_by_id(user.id, hashed_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )
    
    # Mark token as used
    PasswordResetTokens.mark_token_as_used(token_record.id)
    
    # Send password changed confirmation email
    try:
        await email_service.send_password_changed_email(user.email, user.name)
    except Exception as e:
        log.error(f"Failed to send password changed email to {user.email}: {e}")
    
    log.info(f"Password reset successfully for user {user.id} ({user.email})")
    
    return {
        "success": True,
        "message": "Password reset successfully"
    }
