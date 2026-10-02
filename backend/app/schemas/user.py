"""Pydantic schemas for users and profiles."""

from pydantic import BaseModel

from app.models.user import Gender


class ProfileUpdate(BaseModel):
    course: str | None = None
    gender: Gender | None = None
    phone: str | None = None
    photo_url: str | None = None
    social_link: str | None = None
    is_driver: bool = False
    car_model: str | None = None
    car_plate: str | None = None


class UserPublic(BaseModel):
    """Public-facing user info (shown in ride listings)."""
    id: int
    name: str | None
    course: str | None
    photo_url: str | None
    social_link: str | None
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
    is_verified: bool

    model_config = {"from_attributes": True}
