import re
from pydantic import BaseModel, field_validator, model_validator

from app.models.user import Gender


class ProfileUpdate(BaseModel):
    course: str | None = None
    gender: Gender | None = None
    phone: str | None = None
    photo_url: str | None = None
    social_link: str | None = None
    bio: str | None = None
    campuses: list[str] | None = None
    is_driver: bool = False
    car_model: str | None = None
    car_plate: str | None = None
    car_color: str | None = None

    @field_validator("car_plate")
    @classmethod
    def validate_car_plate(cls, v: str | None) -> str | None:
        if not v:
            return None
        clean = v.strip().upper().replace("-", "")
        if not re.match(r"^[A-Z]{3}[0-9]([0-9]|[A-J])[0-9]{2}$", clean):
            raise ValueError("Placa inválida. Utilize o formato ABC1234 ou ABC1C34 (letras A-J).")
        return clean


class UserPublic(BaseModel):
    """Public-facing user info (shown in ride listings)."""
    id: int
    name: str | None
    course: str | None
    photo_url: str | None
    social_link: str | None
    bio: str | None = None
    campuses: list[str] | None = None
    avg_rating: float
    rating_count: int
    is_driver: bool

    model_config = {"from_attributes": True}


class UserPrivate(UserPublic):
    """Full profile — only returned to the user themselves."""
    email: str
    gender: Gender | None
    phone: str | None
    car_model: str | None
    car_plate: str | None
    car_color: str | None = None
    is_verified: bool
    profile_complete: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_profile_complete(self) -> "UserPrivate":
        """A profile is complete when the mandatory fields are filled."""
        self.profile_complete = bool(self.name and self.course and self.gender)
        return self
