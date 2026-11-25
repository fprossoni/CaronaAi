"""Pydantic schemas for authentication."""

import re
from pydantic import BaseModel, EmailStr, Field, field_validator

UFRGS_EMAIL_REGEX = re.compile(r"^[^\s@]+@(?:[a-zA-Z0-9-]+\.)*ufrgs\.br$", re.IGNORECASE)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("email")
    @classmethod
    def must_be_ufrgs(cls, v: str) -> str:
        clean = v.strip().lower()
        if not UFRGS_EMAIL_REGEX.match(clean):
            raise ValueError("Apenas e-mails institucionais da UFRGS (@ufrgs.br ou @*.ufrgs.br) são permitidos")
        return clean

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v.encode()) > 72:
            raise ValueError("A senha deve ter no máximo 72 bytes.")
        return v


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    token: str = Field(pattern=r"^[0-9]{6}$")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordRequest(EmailRequest):
    token: str = Field(pattern=r"^[0-9]{6}$")
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8 or len(value.encode()) > 72:
            raise ValueError("Use uma senha de pelo menos 8 caracteres e no máximo 72 bytes.")
        return value
