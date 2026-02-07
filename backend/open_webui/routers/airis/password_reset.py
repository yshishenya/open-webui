import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from open_webui.models.auths import Auths
from open_webui.models.email_verification import EmailVerificationTokens
from open_webui.models.password_reset import PasswordResetTokens
from open_webui.models.users import Users
from open_webui.utils.auth import get_password_hash, validate_password
from open_webui.utils.email import email_service
from open_webui.utils.misc import validate_email_format
from open_webui.utils.rate_limit import RateLimiter
from open_webui.utils.redis import get_redis_client

router = APIRouter()

log = logging.getLogger(__name__)

email_verification_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=3, window=60 * 60  # 3 emails per hour
)

password_reset_rate_limiter = RateLimiter(
    redis_client=get_redis_client(), limit=3, window=60 * 60  # 3 reset requests per hour
)


class VerifyEmailForm(BaseModel):
    token: str


class ResendVerificationForm(BaseModel):
    email: str


@router.get("/verify-email")
async def verify_email(token: str):
    """Verify email address using verification token.

    This endpoint is called when user clicks the verification link in their email.
    On success, it marks the email as verified and sends a welcome email.
    """
    if not EmailVerificationTokens.is_token_valid(token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    token_record = EmailVerificationTokens.get_token_by_token_string(token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token not found",
        )

    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    Users.update_user_by_id(user.id, {"email_verified": True})
    EmailVerificationTokens.delete_token_by_id(token_record.id)

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
            "email_verified": True,
        },
    }


@router.post("/resend-verification")
async def resend_verification_email(form_data: ResendVerificationForm):
    """Resend verification email to user.

    Rate limited to 3 emails per hour per email address.
    """
    if not email_verification_rate_limiter.check_rate_limit(
        key=f"email_verification:{form_data.email}"
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification emails sent. Please try again in an hour.",
        )

    if not validate_email_format(form_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format",
        )

    user = Users.get_user_by_email(form_data.email.lower())
    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a verification link has been sent.",
        }

    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified",
        )

    existing_tokens = EmailVerificationTokens.get_tokens_by_user_id(user.id)
    for token_record in existing_tokens:
        EmailVerificationTokens.delete_token_by_id(token_record.id)

    token_record = EmailVerificationTokens.create_verification_token(
        user_id=user.id,
        email=user.email,
    )
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create verification token",
        )

    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured",
        )

    success = await email_service.send_verification_email(
        to_email=user.email,
        name=user.name,
        verification_token=token_record.token,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email",
        )

    log.info(f"Verification email sent to {user.email}")

    return {
        "success": True,
        "message": "Verification email sent successfully",
    }


class RequestPasswordResetForm(BaseModel):
    email: str


class ResetPasswordForm(BaseModel):
    token: str
    new_password: str


@router.post("/request-password-reset")
async def request_password_reset(form_data: RequestPasswordResetForm):
    """Request password reset - sends reset email to user.

    Rate limited to 3 requests per hour per email address.
    """
    if not password_reset_rate_limiter.check_rate_limit(
        key=f"password_reset:{form_data.email}"
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please try again in an hour.",
        )

    if not validate_email_format(form_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format",
        )

    user = Users.get_user_by_email(form_data.email.lower())
    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a password reset link has been sent.",
        }

    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured",
        )

    existing_tokens = PasswordResetTokens.get_tokens_by_user_id(user.id)
    for token_record in existing_tokens:
        PasswordResetTokens.delete_token_by_id(token_record.id)

    token_record = PasswordResetTokens.create_reset_token(user_id=user.id, expiry_hours=2)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create password reset token",
        )

    success = await email_service.send_password_reset_email(
        to_email=user.email,
        name=user.name,
        reset_token=token_record.token,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email",
        )

    log.info(f"Password reset email sent to {user.email}")

    return {
        "success": True,
        "message": "If the email exists, a password reset link has been sent.",
    }


@router.get("/validate-reset-token/{token}")
async def validate_reset_token(token: str):
    """Validate password reset token before showing reset form."""
    if not PasswordResetTokens.is_token_valid(token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    token_record = PasswordResetTokens.get_token_by_token_string(token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token not found",
        )

    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    email_parts = user.email.split("@")
    masked_email = (
        email_parts[0][:2] + "***@" + email_parts[1] if len(email_parts) == 2 else "***"
    )

    return {"valid": True, "email": masked_email}


@router.post("/reset-password")
async def reset_password(form_data: ResetPasswordForm):
    """Reset password using reset token.

    Validates the token, updates the password, and sends confirmation email.
    """
    if not PasswordResetTokens.is_token_valid(form_data.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    token_record = PasswordResetTokens.get_token_by_token_string(form_data.token)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token not found",
        )

    user = Users.get_user_by_id(token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    try:
        validate_password(form_data.new_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    hashed_password = get_password_hash(form_data.new_password)
    auth_user = Auths.get_auth_by_id(user.id)
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authentication record not found",
        )

    success = Auths.update_user_password_by_id(user.id, hashed_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password",
        )

    PasswordResetTokens.mark_token_as_used(token_record.id)

    try:
        await email_service.send_password_changed_email(user.email, user.name)
    except Exception as e:
        log.error(f"Failed to send password changed email to {user.email}: {e}")

    log.info(f"Password reset successfully for user {user.id} ({user.email})")

    return {"success": True, "message": "Password reset successfully"}

