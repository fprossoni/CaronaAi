"""Authentication router — /auth/*"""

import random
import string
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.email import send_verification_email
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import EmailVerificationToken, User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_token(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: DbSession,
    background: BackgroundTasks,
) -> dict:
    """Create a new user account and send verification email."""
    existing = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.flush()  # Get user.id without committing

    # Create verification token
    token_value = _generate_token()
    expires = datetime.now(UTC) + timedelta(minutes=settings.EMAIL_TOKEN_EXPIRE_MINUTES)
    verification = EmailVerificationToken(
        user_id=user.id,
        token=token_value,
        expires_at=expires,
    )
    db.add(verification)
    db.commit()

    background.add_task(send_verification_email, body.email, token_value)
    resp = {"message": "Registration successful. Check your @ufrgs.br email for the verification code."}
    if settings.DEBUG or not settings.SMTP_USER:
        resp["dev_token"] = token_value
    return resp


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(body: VerifyEmailRequest, db: DbSession) -> TokenResponse:
    """Verify a user's email with the 6-digit token and log them in."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(UTC)
    token = db.execute(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id)
        .where(EmailVerificationToken.token == body.token)
        .where(EmailVerificationToken.used == False)
        .where(EmailVerificationToken.expires_at > now)
        .order_by(EmailVerificationToken.id.desc())
    ).scalar_one_or_none()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    token.used = True
    user.is_verified = True
    db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession) -> TokenResponse:
    """Authenticate and return JWT tokens."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: DbSession) -> TokenResponse:
    """Issue a new access token from a valid refresh token."""
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/resend-verification")
def resend_verification(
    current_user: CurrentUser,
    db: DbSession,
    background: BackgroundTasks,
) -> dict:
    """Resend verification email for unverified users."""
    if current_user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    token_value = _generate_token()
    expires = datetime.now(UTC) + timedelta(minutes=settings.EMAIL_TOKEN_EXPIRE_MINUTES)
    verification = EmailVerificationToken(
        user_id=current_user.id,
        token=token_value,
        expires_at=expires,
    )
    db.add(verification)
    db.commit()
    background.add_task(send_verification_email, current_user.email, token_value)
    resp = {"message": "Verification email resent"}
    if settings.DEBUG or not settings.SMTP_USER:
        resp["dev_token"] = token_value
    return resp
