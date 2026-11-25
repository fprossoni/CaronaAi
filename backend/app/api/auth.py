"""Authentication router — /auth/*"""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.core.email import send_code_email, send_verification_email
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import EmailVerificationToken, User
from app.schemas.auth import (
    EmailRequest,
    ResetPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_token(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: DbSession,
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
    send_verification_email(body.email, token_value)
    db.commit()
    resp = {"message": "Registration successful. Check your @ufrgs.br email for the verification code."}
    if settings.DEBUG:
        resp["dev_token"] = token_value
    return resp


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(body: VerifyEmailRequest, db: DbSession) -> TokenResponse:
    """Verify a user's email with the 6-digit token and log them in."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(UTC)
    token = _consume_code(db, user.id, "verification", body.token, now)

    token.used = True
    user.is_verified = True
    db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.auth_version),
        refresh_token=create_refresh_token(str(user.id), user.auth_version),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession) -> TokenResponse:
    """Authenticate and return JWT tokens."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active or (user.dev_owner_hash is not None and not settings.DEV_ACCOUNTS_ENABLED):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.auth_version),
        refresh_token=create_refresh_token(str(user.id), user.auth_version),
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
    if not user or not user.is_active or (user.dev_owner_hash is not None and not settings.DEV_ACCOUNTS_ENABLED):
        raise HTTPException(status_code=401, detail="User not found")

    if payload.get("version", 0) != user.auth_version:
        raise HTTPException(401, "Session expired")

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.auth_version),
        refresh_token=create_refresh_token(str(user.id), user.auth_version),
    )


@router.post("/resend-verification")
def resend_verification(body: EmailRequest, db: DbSession) -> dict:
    user = db.scalar(select(User).where(User.email == body.email).with_for_update())
    response = {"message": "Se houver um cadastro pendente, um novo código será enviado."}
    if user and not user.is_verified and user.is_active and user.dev_owner_hash is None:
        code = _issue_code(db, user, "verification")
        if settings.DEBUG:
            response["dev_token"] = code
    return response


def _issue_code(db, user: User, purpose: str) -> str:
    now = datetime.now(UTC)
    previous = db.scalars(select(EmailVerificationToken).where(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.purpose == purpose,
        EmailVerificationToken.used == False,
    ).with_for_update()).all()
    for token in previous:
        issued_at = token.expires_at - timedelta(minutes=settings.EMAIL_TOKEN_EXPIRE_MINUTES)
        if now < issued_at + timedelta(seconds=60):
            raise HTTPException(429, "Aguarde um minuto antes de solicitar outro código.")
    for token in previous:
        token.used = True
    code = _generate_token()
    db.add(EmailVerificationToken(
        user_id=user.id, token=code, purpose=purpose,
        expires_at=now + timedelta(minutes=settings.EMAIL_TOKEN_EXPIRE_MINUTES),
    ))
    send_code_email(user.email, code, recovery=purpose == "password_reset")
    db.commit()
    return code


def _consume_code(db, user_id: int, purpose: str, code: str, now: datetime):
    token = db.scalar(select(EmailVerificationToken).where(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.purpose == purpose,
        EmailVerificationToken.used == False,
        EmailVerificationToken.expires_at > now,
    ).order_by(EmailVerificationToken.id.desc()).limit(1).with_for_update())
    if token is None:
        raise HTTPException(400, "Código inválido ou expirado.")
    if token.attempts >= 5:
        raise HTTPException(400, "Limite de tentativas atingido. Solicite outro código.")
    token.attempts += 1
    if not secrets.compare_digest(token.token, code):
        db.commit()
        raise HTTPException(400, "Código inválido ou expirado.")
    return token


@router.post("/forgot-password")
def forgot_password(body: EmailRequest, db: DbSession) -> dict:
    # Lock the user to serialize concurrent code requests.
    user = db.scalar(select(User).where(User.email == body.email).with_for_update())
    response = {"message": "Se houver uma conta ativa com esse e-mail, enviaremos um código de recuperação."}
    if user and user.is_active and user.is_verified and user.dev_owner_hash is None:
        code = _issue_code(db, user, "password_reset")
        if settings.DEBUG:
            response["dev_token"] = code
    return response


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: DbSession) -> dict:
    user = db.scalar(select(User).where(User.email == body.email).with_for_update())
    if not user or not user.is_active or not user.is_verified or user.dev_owner_hash is not None:
        raise HTTPException(400, "Código inválido ou expirado.")
    token = _consume_code(db, user.id, "password_reset", body.token, datetime.now(UTC))
    user.hashed_password = hash_password(body.password)
    user.auth_version += 1
    token.used = True
    db.commit()
    return {"message": "Senha atualizada. Entre com sua nova senha."}
