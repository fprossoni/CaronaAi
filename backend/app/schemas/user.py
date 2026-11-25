import re
from datetime import date

from pydantic import BaseModel, field_validator

from app.models.user import Gender

MIN_AGE = 16
MAX_AGE = 100


class ProfileUpdate(BaseModel):
    name: str | None = None
    course: str | None = None
    gender: Gender | None = None
    phone: str | None = None
    photo_url: str | None = None
    social_link: str | None = None
    instagram: str | None = None
    bio: str | None = None
    campuses: list[str] | None = None
    birth_date: date | None = None
    is_driver: bool = False
    car_brand: str | None = None
    car_model: str | None = None
    car_plate: str | None = None
    car_color: str | None = None

    @field_validator("name", "course", "car_brand", "car_model", "car_color", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        digits = re.sub(r"\D", "", value)
        if len(digits) not in (10, 11) and not (digits.startswith("55") and len(digits) in (12, 13)):
            raise ValueError("Informe um telefone válido com DDD.")
        return value.strip()

    @field_validator("car_plate")
    @classmethod
    def validate_car_plate(cls, v: str | None) -> str | None:
        if not v:
            return None
        clean = v.strip().upper().replace("-", "")
        if not re.match(r"^[A-Z]{3}[0-9]([0-9]|[A-J])[0-9]{2}$", clean):
            raise ValueError("Placa inválida. Utilize o formato ABC1234 ou ABC1C34 (letras A-J).")
        return clean

    @field_validator("instagram")
    @classmethod
    def normalize_instagram(cls, v: str | None) -> str | None:
        """Accepts '@user', 'user' or an instagram.com URL and stores '@user'."""
        if not v or not v.strip():
            return None
        handle = v.strip()
        url_match = re.match(r"^(?:https?://)?(?:www\.)?instagram\.com/([^/?#]+)", handle, re.IGNORECASE)
        if url_match:
            handle = url_match.group(1)
        handle = handle.lstrip("@")
        if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", handle):
            raise ValueError("Instagram inválido. Use apenas letras, números, ponto e underline.")
        return f"@{handle}"

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date | None) -> date | None:
        if v is None:
            return None
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < MIN_AGE or age > MAX_AGE:
            raise ValueError(f"Data de nascimento inválida (idade entre {MIN_AGE} e {MAX_AGE} anos).")
        return v


class UserPublic(BaseModel):
    """Level 1: minimal profile visible before confirmation."""
    id: int
    name: str | None
    course: str | None
    gender: Gender | None = None
    photo_url: str | None
    age: int | None = None
    bio: str | None = None
    campuses: list[str] | None = None
    avg_rating: float
    rating_count: int
    is_driver: bool
    car_brand: str | None = None
    car_model: str | None = None
    model_config = {"from_attributes": True}


class UserConfirmed(UserPublic):
    """Level 2: only shared with the counterpart of a confirmed match."""
    phone: str | None = None
    social_link: str | None = None
    instagram: str | None = None
    car_color: str | None = None
    car_plate: str | None = None


class UserPrivate(UserConfirmed):
    """Level 3: account owner only. Addresses use owner-scoped endpoints."""
    email: str
    birth_date: date | None = None
    is_verified: bool
    profile_complete: bool = False
