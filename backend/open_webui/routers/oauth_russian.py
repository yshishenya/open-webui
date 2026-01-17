"""
Russian OAuth Providers Router
Handles VK, Yandex, and Telegram OAuth authentication flows
"""

import logging
import time
import uuid
import hmac
import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from open_webui.models.users import Users
from open_webui.models.auths import Auths
from open_webui.config import (
    VK_CLIENT_ID,
    VK_CLIENT_SECRET,
    VK_REDIRECT_URI,
    VK_OAUTH_SCOPE,
    VK_API_VERSION,
    YANDEX_CLIENT_ID,
    YANDEX_CLIENT_SECRET,
    YANDEX_REDIRECT_URI,
    YANDEX_OAUTH_SCOPE,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_NAME,
    TELEGRAM_AUTH_ORIGIN,
    ENABLE_OAUTH_SIGNUP,
    OAUTH_MERGE_ACCOUNTS_BY_EMAIL,
)
from open_webui.utils.auth import create_token, get_password_hash
from open_webui.utils.misc import parse_duration
from open_webui.utils.redis import get_redis_client
from open_webui.env import (
    WEBUI_AUTH_COOKIE_SAME_SITE,
    WEBUI_AUTH_COOKIE_SECURE,
    SRC_LOG_LEVELS,
)
from open_webui.constants import ERROR_MESSAGES
from open_webui.utils.email import email_service

from aiohttp import ClientSession
import datetime
import json

router = APIRouter()

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["MAIN"])

# Redis client for state management
redis_client = get_redis_client()


############################
# OAuth State Management
############################


def generate_oauth_state() -> str:
    """Generate a secure random state token for CSRF protection"""
    return secrets.token_urlsafe(32)


def store_oauth_state(state: str, provider: str, expiry_seconds: int = 300) -> bool:
    """Store OAuth state in Redis with expiration"""
    try:
        if redis_client:
            key = f"oauth_state:{state}"
            redis_client.setex(key, expiry_seconds, provider)
            return True
        return False
    except Exception as e:
        log.error(f"Failed to store OAuth state: {e}")
        return False


def validate_oauth_state(state: str, expected_provider: str) -> bool:
    """Validate OAuth state token"""
    try:
        if redis_client:
            key = f"oauth_state:{state}"
            stored_provider = redis_client.get(key)
            if stored_provider and stored_provider.decode() == expected_provider:
                redis_client.delete(key)  # One-time use
                return True
        return False
    except Exception as e:
        log.error(f"Failed to validate OAuth state: {e}")
        return False


############################
# VK ID SDK Endpoints (New)
############################


class VKIDAuthRequest(BaseModel):
    """Request model for VK ID SDK authentication"""
    code: Optional[str] = Field(None, description="Authorization code from VK ID SDK")
    device_id: Optional[str] = Field(None, description="Device ID from VK ID SDK")
    state: Optional[str] = Field(None, description="Optional state for CSRF protection")
    # If SDK already exchanged code for token on frontend
    access_token: Optional[str] = Field(None, description="Access token if SDK exchanged code")
    user_id: Optional[int] = Field(None, description="VK user ID from SDK")
    email: Optional[str] = Field(None, description="Email from SDK")


class VKIDAuthResponse(BaseModel):
    """Response model for VK ID SDK authentication"""
    token: str
    token_type: str = "Bearer"
    expires_at: Optional[int] = None
    user: dict


@router.post("/oauth/vkid/callback")
async def vkid_callback(
    request: Request,
    response: Response,
    auth_data: VKIDAuthRequest
):
    """
    Handle VK ID SDK callback with code exchange.
    This endpoint receives the authorization code from VK ID SDK widget
    and exchanges it for access token and user info.
    """
    if not ENABLE_OAUTH_SIGNUP.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OAuth signup is disabled"
        )

    if not VK_CLIENT_ID.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK ID is not configured"
        )

    try:
        access_token = auth_data.access_token
        vk_user_id = str(auth_data.user_id) if auth_data.user_id else None
        email = auth_data.email

        async with ClientSession() as session:
            # If we don't have access_token, exchange code for it
            if not access_token:
                if not auth_data.code or not auth_data.device_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Either access_token or code+device_id is required"
                    )

                if not VK_CLIENT_SECRET.value:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="VK ID client_secret is not configured"
                    )

                # Exchange code for access token using VK ID API
                token_url = "https://id.vk.com/oauth2/auth"
                token_data = {
                    "grant_type": "authorization_code",
                    "code": auth_data.code,
                    "client_id": VK_CLIENT_ID.value,
                    "client_secret": VK_CLIENT_SECRET.value,
                    "device_id": auth_data.device_id,
                    "redirect_uri": VK_REDIRECT_URI.value,
                }

                headers = {
                    "Content-Type": "application/x-www-form-urlencoded",
                }

                async with session.post(token_url, data=token_data, headers=headers) as resp:
                    token_response = await resp.json()
                    log.debug(f"VK ID token response: {token_response}")

                    if "error" in token_response:
                        log.error(f"VK ID token error: {token_response}")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"VK ID error: {token_response.get('error_description', token_response.get('error'))}"
                        )

                access_token = token_response.get("access_token")
                vk_user_id = str(token_response.get("user_id"))

            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get access token from VK ID"
                )

            # Get user info from VK ID
            user_info_url = "https://id.vk.com/oauth2/user_info"
            user_info_data = {
                "access_token": access_token,
                "client_id": VK_CLIENT_ID.value,
            }

            async with session.post(user_info_url, data=user_info_data) as resp:
                user_info = await resp.json()
                log.debug(f"VK ID user info: {user_info}")

                if "error" in user_info:
                    log.error(f"VK ID user info error: {user_info}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get user info from VK ID"
                    )

            # Extract user data
            user_data = user_info.get("user", {})
            vk_user_id = str(user_data.get("user_id", vk_user_id))
            first_name = user_data.get("first_name", "")
            last_name = user_data.get("last_name", "")
            email = user_data.get("email", email or "")
            phone = user_data.get("phone", "")
            avatar = user_data.get("avatar", "")

            name = f"{first_name} {last_name}".strip() or "VK User"
            profile_image_url = avatar if avatar else "/user.png"

            # Email is required for our system
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is required. Please grant email permission in VK ID settings."
                )
            email_lower = email.lower()

        # Find or create user
        user = Users.get_user_by_oauth_sub("vk", vk_user_id)

        if not user:
            existing_user = Users.get_user_by_email(email_lower)
            if existing_user:
                if OAUTH_MERGE_ACCOUNTS_BY_EMAIL.value:
                    Users.update_user_oauth_by_id(existing_user.id, "vk", vk_user_id)
                    Users.update_user_by_id(existing_user.id, {"email_verified": True})
                    log.info(f"Merged VK ID account with existing user {existing_user.id}")
                    user = existing_user
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ERROR_MESSAGES.EMAIL_TAKEN
                    )

        if not user:
            # Create new user
            user_id = str(uuid.uuid4())
            role = "admin" if not Users.has_users() else request.app.state.config.DEFAULT_USER_ROLE

            user = Users.insert_new_user(
                id=user_id,
                name=name,
                email=email_lower,
                profile_image_url=profile_image_url,
                role=role,
                oauth={"vk": {"sub": vk_user_id}}
            )

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )

            Users.update_user_by_id(user.id, {
                "email_verified": True,
                "terms_accepted_at": int(time.time())
            })

            if email_service.is_configured():
                try:
                    await email_service.send_welcome_email(user.email, user.name)
                except Exception as e:
                    log.error(f"Failed to send welcome email: {e}")

            log.info(f"Created new user {user.id} via VK ID")

        # Create JWT token
        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        # Set cookie
        response.set_cookie(
            key="token",
            value=token,
            expires=(
                datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
                if expires_at
                else None
            ),
            httponly=True,
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        return VKIDAuthResponse(
            token=token,
            token_type="Bearer",
            expires_at=expires_at,
            user={
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "profile_image_url": user.profile_image_url,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"VK ID callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VK ID authentication failed"
        )


############################
# VK OAuth Endpoints (Legacy)
############################


@router.get("/oauth/vk/login")
async def vk_oauth_login(request: Request):
    """Initiate VK OAuth flow"""
    if not ENABLE_OAUTH_SIGNUP.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OAuth signup is disabled"
        )

    if not VK_CLIENT_ID.value or not VK_CLIENT_SECRET.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK OAuth is not configured"
        )

    # Generate state token for CSRF protection
    state = generate_oauth_state()
    if not store_oauth_state(state, "vk"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session storage unavailable. Please try again."
        )

    # Build VK authorization URL
    auth_url = (
        f"https://oauth.vk.com/authorize?"
        f"client_id={VK_CLIENT_ID.value}&"
        f"redirect_uri={VK_REDIRECT_URI.value}&"
        f"scope={VK_OAUTH_SCOPE.value}&"
        f"response_type=code&"
        f"state={state}&"
        f"v={VK_API_VERSION.value}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/oauth/vk/callback")
async def vk_oauth_callback(
    request: Request,
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None
):
    """Handle VK OAuth callback"""
    
    # Handle authorization errors
    if error:
        log.error(f"VK OAuth error: {error} - {error_description}")
        error_msg = "Вы отклонили доступ" if error == "access_denied" else "Ошибка авторизации VK"
        return RedirectResponse(url=f"/auth?error=oauth_error&message={error_msg}")

    # Validate state token
    if not state or not validate_oauth_state(state, "vk"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid state token - possible CSRF attack"
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code not provided"
        )

    try:
        # Exchange authorization code for access token
        async with ClientSession() as session:
            token_url = "https://oauth.vk.com/access_token"
            token_data = {
                "client_id": VK_CLIENT_ID.value,
                "client_secret": VK_CLIENT_SECRET.value,
                "code": code,
                "redirect_uri": VK_REDIRECT_URI.value,
            }
            
            async with session.post(token_url, data=token_data) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to exchange authorization code"
                    )
                token_response = await resp.json()

            access_token = token_response.get("access_token")
            vk_user_id = token_response.get("user_id")
            email = token_response.get("email")

            if not access_token or not vk_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid token response from VK"
                )

            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email required. Please grant email permission in VK settings"
                )
            email_lower = email.lower()

            # Fetch user profile from VK API
            user_info_url = (
                f"https://api.vk.com/method/users.get?"
                f"access_token={access_token}&"
                f"user_ids={vk_user_id}&"
                f"fields=photo_200,screen_name&"
                f"v={VK_API_VERSION.value}"
            )
            
            async with session.get(user_info_url) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to fetch VK user profile"
                    )
                profile_response = await resp.json()

            vk_response = profile_response.get("response", [])
            if not vk_response:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Empty VK profile response"
                )

            user_profile = vk_response[0]
            first_name = user_profile.get("first_name", "")
            last_name = user_profile.get("last_name", "")
            name = f"{first_name} {last_name}".strip()
            profile_image_url = user_profile.get("photo_200", "/user.png")

        # Find or create user
        user = Users.get_user_by_oauth_sub("vk", str(vk_user_id))

        if not user:
            existing_user = Users.get_user_by_email(email_lower)
            if existing_user:
                if OAUTH_MERGE_ACCOUNTS_BY_EMAIL.value:
                    # Merge accounts: link VK to existing user
                    Users.update_user_oauth_by_id(existing_user.id, "vk", str(vk_user_id))
                    # Update email_verified since VK verifies emails
                    Users.update_user_by_id(existing_user.id, {"email_verified": True})
                    log.info(f"Merged VK account with existing user {existing_user.id}")
                    user = existing_user
                    # FIXME(billing): Send account merge notification email when email templates are ready
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ERROR_MESSAGES.EMAIL_TAKEN
                    )

        if not user:
            # Create new user
            user_id = str(uuid.uuid4())
            role = "admin" if not Users.has_users() else request.app.state.config.DEFAULT_USER_ROLE
            
            user = Users.insert_new_user(
                id=user_id,
                name=name,
                email=email_lower,
                profile_image_url=profile_image_url,
                role=role,
                oauth={"vk": {"sub": str(vk_user_id)}}
            )

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )

            # Set email as verified (VK verifies emails) and record terms acceptance
            Users.update_user_by_id(user.id, {
                "email_verified": True,
                "terms_accepted_at": int(time.time())
            })
            
            # Send welcome email
            if email_service.is_configured():
                try:
                    await email_service.send_welcome_email(user.email, user.name)
                except Exception as e:
                    log.error(f"Failed to send welcome email to {user.email}: {e}")

            # FIXME(billing): Assign default free plan via billing_service.assign_free_plan(user.id)
            # This requires billing system integration - see .memory_bank/specs/billing.md

            log.info(f"Created new user {user.id} via VK OAuth")

        # Create JWT token
        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        # Set cookie
        response = RedirectResponse(url="/home")
        response.set_cookie(
            key="token",
            value=token,
            expires=(
                datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
                if expires_at
                else None
            ),
            httponly=True,
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"VK OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VK authentication failed"
        )


############################
# Yandex OAuth Endpoints
############################


@router.get("/oauth/yandex/login")
async def yandex_oauth_login(request: Request):
    """Initiate Yandex OAuth flow"""
    if not ENABLE_OAUTH_SIGNUP.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OAuth signup is disabled"
        )

    if not YANDEX_CLIENT_ID.value or not YANDEX_CLIENT_SECRET.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yandex OAuth is not configured"
        )

    # Generate state token for CSRF protection
    state = generate_oauth_state()
    if not store_oauth_state(state, "yandex"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session storage unavailable. Please try again."
        )

    # Build Yandex authorization URL
    auth_url = (
        f"https://oauth.yandex.ru/authorize?"
        f"client_id={YANDEX_CLIENT_ID.value}&"
        f"redirect_uri={YANDEX_REDIRECT_URI.value}&"
        f"response_type=code&"
        f"state={state}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/oauth/yandex/callback")
async def yandex_oauth_callback(
    request: Request,
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None
):
    """Handle Yandex OAuth callback"""
    
    # Handle authorization errors
    if error:
        log.error(f"Yandex OAuth error: {error} - {error_description}")
        error_msg = "Вы отклонили доступ" if error == "access_denied" else "Ошибка авторизации Yandex"
        return RedirectResponse(url=f"/auth?error=oauth_error&message={error_msg}")

    # Validate state token
    if not state or not validate_oauth_state(state, "yandex"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid state token - possible CSRF attack"
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code not provided"
        )

    try:
        # Exchange authorization code for access token
        async with ClientSession() as session:
            token_url = "https://oauth.yandex.ru/token"
            token_data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": YANDEX_CLIENT_ID.value,
                "client_secret": YANDEX_CLIENT_SECRET.value,
            }
            
            async with session.post(token_url, data=token_data) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to exchange authorization code"
                    )
                token_response = await resp.json()

            access_token = token_response.get("access_token")

            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid token response from Yandex"
                )

            # Fetch user info from Yandex API
            user_info_url = "https://login.yandex.ru/info"
            headers = {"Authorization": f"OAuth {access_token}"}
            
            async with session.get(user_info_url, headers=headers) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to fetch Yandex user info"
                    )
                user_info = await resp.json()

            yandex_user_id = user_info.get("id")
            email = user_info.get("default_email")
            display_name = user_info.get("display_name")
            first_name = user_info.get("first_name", "")
            last_name = user_info.get("last_name", "")
            
            name = display_name or f"{first_name} {last_name}".strip() or "Yandex User"
            
            # Get avatar URL
            default_avatar_id = user_info.get("default_avatar_id")
            profile_image_url = f"https://avatars.yandex.net/get-yapic/{default_avatar_id}/islands-200" if default_avatar_id else "/user.png"

            if not yandex_user_id or not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email required from Yandex"
                )
            email_lower = email.lower()

        # Find or create user
        user = Users.get_user_by_oauth_sub("yandex", str(yandex_user_id))

        if not user:
            existing_user = Users.get_user_by_email(email_lower)
            if existing_user:
                if OAUTH_MERGE_ACCOUNTS_BY_EMAIL.value:
                    Users.update_user_oauth_by_id(existing_user.id, "yandex", str(yandex_user_id))
                    Users.update_user_by_id(existing_user.id, {"email_verified": True})
                    log.info(f"Merged Yandex account with existing user {existing_user.id}")
                    user = existing_user
                    # FIXME(billing): Send account merge notification email when email templates are ready
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=ERROR_MESSAGES.EMAIL_TAKEN
                    )

        if not user:
            # Create new user
            user_id = str(uuid.uuid4())
            role = "admin" if not Users.has_users() else request.app.state.config.DEFAULT_USER_ROLE
            
            user = Users.insert_new_user(
                id=user_id,
                name=name,
                email=email_lower,
                profile_image_url=profile_image_url,
                role=role,
                oauth={"yandex": {"sub": str(yandex_user_id)}}
            )

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )

            # Set email as verified (Yandex verifies emails) and record terms acceptance
            Users.update_user_by_id(user.id, {
                "email_verified": True,
                "terms_accepted_at": int(time.time())
            })
            
            # Send welcome email
            if email_service.is_configured():
                try:
                    await email_service.send_welcome_email(user.email, user.name)
                except Exception as e:
                    log.error(f"Failed to send welcome email to {user.email}: {e}")

            # FIXME(billing): Assign default free plan via billing_service.assign_free_plan(user.id)
            # This requires billing system integration - see .memory_bank/specs/billing.md

            log.info(f"Created new user {user.id} via Yandex OAuth")

        # Create JWT token
        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        # Set cookie
        response = RedirectResponse(url="/home")
        response.set_cookie(
            key="token",
            value=token,
            expires=(
                datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
                if expires_at
                else None
            ),
            httponly=True,
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Yandex OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Yandex authentication failed"
        )


############################
# Telegram OAuth Endpoints
############################


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


def verify_telegram_auth(auth_data: dict, bot_token: str) -> bool:
    """Verify Telegram widget authentication data"""
    try:
        # Extract hash
        received_hash = auth_data.pop("hash", None)
        if not received_hash:
            return False

        # Create data check string
        data_check_arr = [f"{k}={v}" for k, v in sorted(auth_data.items())]
        data_check_string = "\n".join(data_check_arr)

        # Calculate secret key
        secret_key = hashlib.sha256(bot_token.encode()).digest()

        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        # Compare hashes
        if calculated_hash != received_hash:
            return False

        # Check auth_date (within last 24 hours)
        if time.time() - int(auth_data.get("auth_date", 0)) > 86400:
            return False

        return True

    except Exception as e:
        log.error(f"Telegram auth verification error: {e}")
        return False


@router.post("/oauth/telegram/callback")
async def telegram_oauth_callback(
    request: Request,
    response: Response,
    auth_data: TelegramAuthData
):
    """Handle Telegram OAuth widget callback"""
    
    if not ENABLE_OAUTH_SIGNUP.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OAuth signup is disabled"
        )

    if not TELEGRAM_BOT_TOKEN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram OAuth is not configured"
        )

    # Convert to dict for verification
    auth_dict = auth_data.model_dump(exclude_none=True)
    
    # Verify authentication data
    if not verify_telegram_auth(auth_dict.copy(), TELEGRAM_BOT_TOKEN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Telegram authentication data"
        )

    try:
        telegram_id = str(auth_data.id)
        first_name = auth_data.first_name
        last_name = auth_data.last_name or ""
        username = auth_data.username
        photo_url = auth_data.photo_url or "/user.png"

        name = f"{first_name} {last_name}".strip() or username or f"Telegram User {telegram_id}"

        # Find user by Telegram ID
        user = Users.get_user_by_oauth_sub("telegram", telegram_id)

        if user:
            # User exists, login directly
            expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
            expires_at = None
            if expires_delta:
                expires_at = int(time.time()) + int(expires_delta.total_seconds())

            token = create_token(
                data={"id": user.id},
                expires_delta=expires_delta,
            )

            return {
                "token": token,
                "token_type": "Bearer",
                "expires_at": expires_at,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "profile_image_url": user.profile_image_url,
                }
            }
        else:
            # New user - need to collect email
            # Create temporary session for email collection
            temp_session_id = secrets.token_urlsafe(32)
            temp_session_data = {
                "telegram_id": telegram_id,
                "name": name,
                "photo_url": photo_url,
                "username": username,
            }
            
            # Store in Redis for 10 minutes
            if redis_client:
                redis_client.setex(
                    f"telegram_temp_session:{temp_session_id}",
                    600,  # 10 minutes
                    json.dumps(temp_session_data)
                )

            return {
                "requires_email": True,
                "temp_session": temp_session_id,
                "name": name,
            }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Telegram OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Telegram authentication failed"
        )


class TelegramCompleteProfileForm(BaseModel):
    temp_session: str
    email: EmailStr
    terms_accepted: bool = False


@router.post("/oauth/telegram/complete-profile")
async def telegram_complete_profile(
    request: Request,
    response: Response,
    form_data: TelegramCompleteProfileForm
):
    """Complete Telegram user profile with email"""
    
    if not form_data.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the terms of service"
        )

    try:
        # Retrieve temporary session data
        if not redis_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Session storage not available"
            )

        session_key = f"telegram_temp_session:{form_data.temp_session}"
        session_data_str = redis_client.get(session_key)
        
        if not session_data_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session expired or invalid"
            )

        # Parse session data
        session_data = json.loads(session_data_str.decode())

        telegram_id = session_data["telegram_id"]
        name = session_data["name"]
        photo_url = session_data.get("photo_url", "/user.png")

        # Validate email
        email = form_data.email.lower()
        
        # Check for existing user with this email
        existing_user = Users.get_user_by_email(email)
        
        if existing_user and OAUTH_MERGE_ACCOUNTS_BY_EMAIL.value:
            # Merge: Link Telegram to existing account
            Users.update_user_oauth_by_id(existing_user.id, "telegram", telegram_id)
            user = existing_user
            log.info(f"Merged Telegram account with existing user {user.id}")
            # FIXME(billing): Send account merge notification email when email templates are ready
        elif existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            role = "admin" if not Users.has_users() else request.app.state.config.DEFAULT_USER_ROLE
            
            user = Users.insert_new_user(
                id=user_id,
                name=name,
                email=email,
                profile_image_url=photo_url,
                role=role,
                oauth={"telegram": {"sub": telegram_id}}
            )

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )

            # Set terms accepted timestamp
            Users.update_user_by_id(user.id, {"terms_accepted_at": int(time.time())})
            
            # Email NOT verified (Telegram doesn't verify emails)
            # Send verification email
            if email_service.is_configured():
                try:
                    from open_webui.models.email_verification import EmailVerificationTokens
                    
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
                        log.info(f"Verification email sent to new Telegram user {user.email}")
                except Exception as e:
                    log.error(f"Failed to send verification email to {user.email}: {e}")
            
            # FIXME(billing): Assign default free plan via billing_service.assign_free_plan(user.id)
            # This requires billing system integration - see .memory_bank/specs/billing.md

            log.info(f"Created new user {user.id} via Telegram OAuth")

        # Delete temporary session
        redis_client.delete(session_key)

        # Create JWT token
        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        return {
            "token": token,
            "token_type": "Bearer",
            "expires_at": expires_at,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "profile_image_url": user.profile_image_url,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Telegram profile completion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete profile"
        )
