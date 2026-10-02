"""
Russian OAuth Providers Router
Handles VK, Yandex, and Telegram OAuth authentication flows
"""

import datetime as dt
import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid

from aiohttp import ClientSession, ClientTimeout
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from open_webui.config import (
    ENABLE_OAUTH_SIGNUP,
    OAUTH_MERGE_ACCOUNTS_BY_EMAIL,
    TELEGRAM_BOT_TOKEN,
    VK_API_VERSION,
    VK_CLIENT_ID,
    VK_CLIENT_SECRET,
    VK_OAUTH_SCOPE,
    VK_REDIRECT_URI,
)
from open_webui.constants import ERROR_MESSAGES
from open_webui.env import (
    SRC_LOG_LEVELS,
    WEBUI_AUTH_COOKIE_SAME_SITE,
    WEBUI_AUTH_COOKIE_SECURE,
)
from open_webui.internal.db import get_async_session
from open_webui.models.config import Config
from open_webui.models.users import UserModel, Users
from open_webui.utils.airis.legal_acceptance import record_legal_acceptances
from open_webui.utils.airis.social_account import (
    VKIdentity,
    create_vk_account,
    require_active_social_account,
    verify_social_address,
)
from open_webui.utils.auth import create_token
from open_webui.utils.email import email_service
from open_webui.utils.misc import parse_duration
from open_webui.utils.redis import get_redis_client
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS.get('MAIN', logging.INFO))

# Redis client for state management
redis_client = get_redis_client(async_mode=True)


############################
# OAuth State Management
############################


def generate_oauth_state() -> str:
    """Generate a secure random state token for CSRF protection"""
    return secrets.token_urlsafe(32)


async def store_oauth_state(state: str, provider: str, expiry_seconds: int = 300) -> bool:
    """Store OAuth state in Redis with expiration"""
    try:
        if redis_client:
            key = f'oauth_state:{state}'
            await redis_client.setex(key, expiry_seconds, provider)
            return True
        return False
    except Exception as e:
        log.error(f'Failed to store OAuth state: {e}')
        return False


async def validate_oauth_state(state: str, expected_provider: str) -> bool:
    """Validate OAuth state token"""
    try:
        if redis_client:
            key = f'oauth_state:{state}'
            stored_provider = await redis_client.get(key)
            if isinstance(stored_provider, bytes):
                stored_provider = stored_provider.decode()
            if stored_provider == expected_provider:
                await redis_client.delete(key)  # One-time use
                return True
        return False
    except Exception as e:
        log.error(f'Failed to validate OAuth state: {e}')
        return False


############################
# VK ID SDK Endpoints (New)
############################


class VKIDAuthRequest(BaseModel):
    """Request model for VK ID SDK authentication"""

    code: str | None = Field(None, description='Authorization code from VK ID SDK')
    device_id: str | None = Field(None, description='Device ID from VK ID SDK')
    state: str | None = Field(None, description='Optional state for CSRF protection')
    # If SDK already exchanged code for token on frontend
    access_token: str | None = Field(None, description='Access token if SDK exchanged code')
    user_id: int | None = Field(None, description='VK user ID from SDK')
    email: str | None = Field(None, description='Email from SDK')


class VKIDAuthResponse(BaseModel):
    """Response model for VK ID SDK authentication"""

    token: str
    token_type: str = 'Bearer'
    expires_at: int | None = None
    user: dict


@router.post('/oauth/vkid/callback')
async def vkid_callback(
    request: Request,
    response: Response,
    auth_data: VKIDAuthRequest,
    db: AsyncSession = Depends(get_async_session),
) -> VKIDAuthResponse:
    """
    Handle VK ID SDK callback with code exchange.
    This endpoint receives the authorization code from VK ID SDK widget
    and exchanges it for access token and user info.
    """
    if not ENABLE_OAUTH_SIGNUP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='OAuth signup is disabled')

    if not VK_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='VK ID is not configured')

    try:

        vk_user_id, email_lower, name, profile_image_url = await _read_vk_identity(auth_data)

        # Find or create user
        user = await Users.get_user_by_oauth_sub('vk', vk_user_id, db=db)

        if not user and await Users.get_user_by_email(email_lower, db=db):
            raise HTTPException(400, detail=ERROR_MESSAGES.EMAIL_TAKEN)

        if not user:
            user = await create_vk_account(name, email_lower, profile_image_url, str(vk_user_id), db)

            log.info('Created new user %s via VK ID', user.id)

        await require_active_social_account(user, db, repair_legacy_vk=True)
        await verify_social_address(user, db)

        # Create JWT token
        expires_delta = parse_duration(await Config.get('auth.jwt_expiry'))
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={'id': user.id},
            expires_delta=expires_delta,
        )

        # Set cookie
        response.set_cookie(
            key='token',
            value=token,
            expires=(dt.datetime.fromtimestamp(expires_at, dt.UTC) if expires_at else None),
            httponly=True,
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        return VKIDAuthResponse(
            token=token,
            token_type='Bearer',
            expires_at=expires_at,
            user={
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'profile_image_url': user.profile_image_url,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f'VK ID callback error: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='VK ID authentication failed')


############################
# VK OAuth Endpoints (Legacy)
############################


@router.get('/oauth/vk/login')
async def vk_oauth_login(request: Request):
    """Initiate VK OAuth flow"""
    if not ENABLE_OAUTH_SIGNUP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='OAuth signup is disabled')

    if not VK_CLIENT_ID or not VK_CLIENT_SECRET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='VK OAuth is not configured')

    # Generate state token for CSRF protection
    state = generate_oauth_state()
    if not await store_oauth_state(state, 'vk'):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Session storage unavailable. Please try again.'
        )

    # Build VK authorization URL
    auth_url = (
        f'https://oauth.vk.com/authorize?'
        f'client_id={VK_CLIENT_ID}&'
        f'redirect_uri={VK_REDIRECT_URI}&'
        f'scope={VK_OAUTH_SCOPE}&'
        f'response_type=code&'
        f'state={state}&'
        f'v={VK_API_VERSION}'
    )

    return RedirectResponse(url=auth_url)


@router.get('/oauth/vk/callback')
async def vk_oauth_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_async_session),
) -> RedirectResponse:
    """Handle VK OAuth callback"""

    # Handle authorization errors
    if error:
        log.error(f'VK OAuth error: {error} - {error_description}')
        error_msg = {'access_denied': 'Вы отклонили доступ'}.get(error, 'Ошибка авторизации VK')
        return RedirectResponse(url=f'/auth?error=oauth_error&message={error_msg}')

    # Validate state token
    if not state or not await validate_oauth_state(state, 'vk'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Invalid state token - possible CSRF attack')

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Authorization code not provided')

    try:

        vk_user_id, email_lower, name, profile_image_url = await _read_vk_profile(code)

        # Find or create user
        user = await Users.get_user_by_oauth_sub('vk', str(vk_user_id), db=db)

        if not user and await Users.get_user_by_email(email_lower, db=db):
            raise HTTPException(400, detail=ERROR_MESSAGES.EMAIL_TAKEN)

        if not user:
            user = await create_vk_account(name, email_lower, profile_image_url, str(vk_user_id), db)

            log.info('Created new user %s via VK OAuth', user.id)

        await require_active_social_account(user, db, repair_legacy_vk=True)
        await verify_social_address(user, db)

        # Billing: lead magnet applies by default; no free plan assignment.

        # Create JWT token
        expires_delta = parse_duration(await Config.get('auth.jwt_expiry'))
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={'id': user.id},
            expires_delta=expires_delta,
        )

        # Set cookie
        response = RedirectResponse(url='/home')
        response.set_cookie(
            key='token',
            value=token,
            expires=(dt.datetime.fromtimestamp(expires_at, dt.UTC) if expires_at else None),
            httponly=True,
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        log.error(f'VK OAuth callback error: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='VK authentication failed')


############################
# Yandex OAuth Endpoints (Thin hooks)
############################


@router.get('/oauth/yandex/login')
async def yandex_oauth_login(request: Request):
    return await request.app.state.oauth_manager.handle_login(request, 'yandex')


@router.get('/oauth/yandex/callback')
async def yandex_oauth_callback(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_async_session),
):
    return await request.app.state.oauth_manager.handle_callback(request, 'yandex', response, db=db)


############################
# Telegram OAuth Endpoints
############################


class TelegramAuthData(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


def verify_telegram_auth(auth_data: dict, bot_token: str) -> bool:
    """Verify Telegram widget authentication data"""
    try:
        # Extract hash
        received_hash = auth_data.pop('hash', None)
        if not received_hash:
            return False

        # Create data check string
        data_check_arr = [f'{k}={v}' for k, v in sorted(auth_data.items())]
        data_check_string = '\n'.join(data_check_arr)

        # Calculate secret key
        secret_key = hashlib.sha256(bot_token.encode()).digest()

        # Calculate hash
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        # Compare hashes
        if calculated_hash != received_hash:
            return False

        # Check auth_date (within last 24 hours)
        if time.time() - int(auth_data.get('auth_date', 0)) > 86400:
            return False

        return True

    except Exception as e:
        log.error(f'Telegram auth verification error: {e}')
        return False


@router.post('/oauth/telegram/callback')
async def telegram_oauth_callback(
    request: Request,
    response: Response,
    auth_data: TelegramAuthData,
    db: AsyncSession = Depends(get_async_session),
):
    """Handle Telegram OAuth widget callback"""

    if not ENABLE_OAUTH_SIGNUP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='OAuth signup is disabled')

    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Telegram OAuth is not configured')

    # Convert to dict for verification
    auth_dict = auth_data.model_dump(exclude_none=True)

    # Verify authentication data
    if not verify_telegram_auth(auth_dict.copy(), TELEGRAM_BOT_TOKEN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Invalid Telegram authentication data')

    try:
        telegram_id = str(auth_data.id)
        first_name = auth_data.first_name
        last_name = auth_data.last_name or ''
        username = auth_data.username
        photo_url = auth_data.photo_url or '/user.png'

        name = f'{first_name} {last_name}'.strip() or username or f'Telegram User {telegram_id}'

        # Find user by Telegram ID
        user = await Users.get_user_by_oauth_sub('telegram', telegram_id, db=db)

        if user:
            # User exists, login directly
            expires_delta = parse_duration(await Config.get('auth.jwt_expiry'))
            expires_at = None
            if expires_delta:
                expires_at = int(time.time()) + int(expires_delta.total_seconds())

            token = create_token(
                data={'id': user.id},
                expires_delta=expires_delta,
            )

            return {
                'token': token,
                'token_type': 'Bearer',
                'expires_at': expires_at,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'role': user.role,
                    'profile_image_url': user.profile_image_url,
                },
            }
        else:
            # New user - need to collect email
            # Create temporary session for email collection
            temp_session_id = secrets.token_urlsafe(32)
            temp_session_data = {
                'telegram_id': telegram_id,
                'name': name,
                'photo_url': photo_url,
                'username': username,
            }

            # Store in Redis for 10 minutes
            if redis_client:
                await redis_client.setex(
                    f'telegram_temp_session:{temp_session_id}', 600, json.dumps(temp_session_data)  # 10 minutes
                )

            return {
                'requires_email': True,
                'temp_session': temp_session_id,
                'name': name,
            }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f'Telegram OAuth callback error: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Telegram authentication failed')


class TelegramCompleteProfileForm(BaseModel):
    temp_session: str
    email: EmailStr
    terms_accepted: bool = False
    privacy_accepted: bool = False


@router.post('/oauth/telegram/complete-profile')
async def telegram_complete_profile(
    request: Request,
    response: Response,
    form_data: TelegramCompleteProfileForm,
    db: AsyncSession = Depends(get_async_session),
):
    """Complete Telegram user profile with email"""

    if not form_data.terms_accepted or not form_data.privacy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail='You must accept the terms and privacy policy'
        )

    try:

        session_data = await _read_telegram_profile(form_data)

        telegram_id = session_data['telegram_id']
        name = session_data['name']
        photo_url = session_data.get('photo_url', '/user.png')

        # Validate email
        email = form_data.email.lower()

        # Check for existing user with this email
        existing_user = await Users.get_user_by_email(email, db=db)

        if existing_user and OAUTH_MERGE_ACCOUNTS_BY_EMAIL:
            # Merge: Link Telegram to existing account
            await Users.update_user_oauth_by_id(existing_user.id, 'telegram', telegram_id, db=db)
            user = existing_user
            log.info(f'Merged Telegram account with existing user {user.id}')
            # FIXME(billing): Send account merge notification email when email templates are ready
        elif existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email already in use')
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            role = await Config.get('ui.default_user_role')

            user = await Users.insert_new_user(
                id=user_id,
                name=name,
                email=email,
                profile_image_url=photo_url,
                role=role,
                oauth={'telegram': {'sub': telegram_id}},
                db=db,
            )

            if not user:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to create user')

            if await Users.get_num_users(db=db) == 1:
                await Users.update_user_role_by_id(user.id, 'admin', db=db)
                user = await Users.get_user_by_id(user.id, db=db)
                await Config.upsert({'ui.enable_signup': False})

            await _send_telegram_address_verification(user)

            # Billing: lead magnet applies by default; no free plan assignment.

            log.info(f'Created new user {user.id} via Telegram OAuth')

        if user:
            await record_legal_acceptances(
                user_id=user.id,
                keys=['terms_offer', 'privacy_policy'],
                request=request,
                method='telegram_complete',
                db=db,
            )

        # Delete temporary session
        await redis_client.delete(f'telegram_temp_session:{form_data.temp_session}')

        # Create JWT token
        expires_delta = parse_duration(await Config.get('auth.jwt_expiry'))
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        token = create_token(
            data={'id': user.id},
            expires_delta=expires_delta,
        )

        return {
            'token': token,
            'token_type': 'Bearer',
            'expires_at': expires_at,
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'role': user.role,
                'profile_image_url': user.profile_image_url,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f'Telegram profile completion error: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to complete profile')


async def _read_telegram_profile(form_data: TelegramCompleteProfileForm) -> dict[str, object]:
    # Retrieve temporary session data
    if not redis_client:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Session storage not available')

    session_key = f'telegram_temp_session:{form_data.temp_session}'
    session_data_str = await redis_client.get(session_key)

    if not session_data_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Session expired or invalid')

    # Parse session data
    if isinstance(session_data_str, bytes):
        session_data_str = session_data_str.decode()
    session_data = json.loads(session_data_str)
    return session_data


async def _read_vk_profile(code: str) -> tuple[str, str, str, str]:
    # Exchange authorization code for access token
    async with ClientSession(timeout=ClientTimeout(total=15), trust_env=True) as session:
        token_url = 'https://oauth.vk.com/access_token'
        token_data = {
            'client_id': VK_CLIENT_ID,
            'client_secret': VK_CLIENT_SECRET,
            'code': code,
            'redirect_uri': VK_REDIRECT_URI,
        }

        async with session.post(token_url, data=token_data) as resp:
            if resp.status != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to exchange authorization code'
                )
            token_response = await resp.json()

        access_token = token_response.get('access_token')
        vk_user_id = token_response.get('user_id')
        email = token_response.get('email')

        if not access_token or not vk_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid token response from VK')

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Email required. Please grant email permission in VK settings',
            )
        email_lower = email.lower()

        # Fetch user profile from VK API
        user_info_url = (
            f'https://api.vk.com/method/users.get?'
            f'access_token={access_token}&'
            f'user_ids={vk_user_id}&'
            f'fields=photo_200,screen_name&'
            f'v={VK_API_VERSION}'
        )

        async with session.get(user_info_url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to fetch VK user profile')
            profile_response = await resp.json()

        vk_response = profile_response.get('response', [])
        if not vk_response:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Empty VK profile response')

        user_profile = vk_response[0]
        if str(user_profile.get('id')) != str(vk_user_id):
            raise HTTPException(400, detail='VK profile identity mismatch')
        first_name = user_profile.get('first_name', '')
        last_name = user_profile.get('last_name', '')
        name = f'{first_name} {last_name}'.strip()
        profile_image_url = user_profile.get('photo_200', '/user.png')
    return str(vk_user_id), email_lower, name, profile_image_url


async def _exchange_vk_code(auth_data: VKIDAuthRequest, session: ClientSession) -> str | None:
    # If we don't have access_token, exchange code for it
    if not auth_data.code or not auth_data.device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Either access_token or code+device_id is required',
        )

    if not VK_CLIENT_SECRET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='VK ID client_secret is not configured')

    # Exchange code for access token using VK ID API
    token_url = 'https://id.vk.com/oauth2/auth'
    token_data = {
        'grant_type': 'authorization_code',
        'code': auth_data.code,
        'client_id': VK_CLIENT_ID,
        'client_secret': VK_CLIENT_SECRET,
        'device_id': auth_data.device_id,
        'redirect_uri': VK_REDIRECT_URI,
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    }

    async with session.post(token_url, data=token_data, headers=headers) as resp:
        token_response = await resp.json()
        if 'error' in token_response:
            log.warning('VK ID token exchange rejected')
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='VK ID authentication failed',
            )

    return token_response.get('access_token')


async def _read_vk_identity(auth_data: VKIDAuthRequest) -> tuple[str, str, str, str]:
    access_token = auth_data.access_token
    async with ClientSession(timeout=ClientTimeout(total=15), trust_env=True) as session:

        if not access_token:
            access_token = await _exchange_vk_code(auth_data, session)

        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to get access token from VK ID')

        # Get user info from VK ID
        user_info_url = 'https://id.vk.com/oauth2/user_info'
        user_info_data = {
            'access_token': access_token,
            'client_id': VK_CLIENT_ID,
        }

        async with session.post(user_info_url, data=user_info_data) as resp:
            if resp.status != 200:
                raise HTTPException(400, detail='Failed to get user info from VK ID')
            user_info = await resp.json()
            if 'error' in user_info:
                log.warning('VK ID user info rejected')
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to get user info from VK ID'
                )

        # Browser email/user_id never establish identity or address proof.
        try:
            identity = VKIdentity.model_validate(user_info.get('user', {}))
        except ValueError:
            raise HTTPException(400, detail='VK ID must provide identity and email') from None
        vk_user_id = identity.user_id
        email_lower = str(identity.email).lower()
        name = f'{identity.first_name} {identity.last_name}'.strip() or 'VK User'
        profile_image_url = identity.avatar or '/user.png'
    return vk_user_id, email_lower, name, profile_image_url


async def _send_telegram_address_verification(user: UserModel) -> None:
    # Email NOT verified (Telegram doesn't verify emails)
    # Send verification email
    if email_service.is_configured():
        try:
            from open_webui.models.email_verification import EmailVerificationTokens

            # Create verification token
            token_record = await EmailVerificationTokens.create_verification_token(user_id=user.id, email=user.email)

            if token_record:
                # Send verification email
                await email_service.send_verification_email(
                    to_email=user.email, name=user.name, verification_token=token_record.token
                )
                log.info(f'Verification email sent to new Telegram user {user.email}')
        except Exception as e:
            log.error(f'Failed to send verification email to {user.email}: {e}')
