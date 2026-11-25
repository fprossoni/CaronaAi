"""SQLAlchemy ORM models for users."""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import Enum as PyEnum
import re

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Gender(str, PyEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    auth_version: Mapped[int] = mapped_column(default=0, server_default="0")
    dev_owner_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Profile fields
    name: Mapped[str | None] = mapped_column(String(100))
    course: Mapped[str | None] = mapped_column(String(100))
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender))
    phone: Mapped[str | None] = mapped_column(String(20))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    social_link: Mapped[str | None] = mapped_column(String(500))
    instagram: Mapped[str | None] = mapped_column(String(100))
    bio: Mapped[str | None] = mapped_column(String(300))
    campuses: Mapped[list[str] | None] = mapped_column(JSON)
    # Private — only the derived `age` is exposed publicly
    birth_date: Mapped[date | None] = mapped_column(Date)

    # Driver-specific
    is_driver: Mapped[bool] = mapped_column(Boolean, default=False)
    car_brand: Mapped[str | None] = mapped_column(String(100))
    car_model: Mapped[str | None] = mapped_column(String(100))
    car_plate: Mapped[str | None] = mapped_column(String(20))
    car_color: Mapped[str | None] = mapped_column(String(50))

    # Stats
    avg_rating: Mapped[float] = mapped_column(default=0.0)
    rating_count: Mapped[int] = mapped_column(default=0)

    # Relationships
    rides_offered: Mapped[list["Ride"]] = relationship("Ride", back_populates="driver", foreign_keys="Ride.driver_id")
    matches_as_passenger: Mapped[list["Match"]] = relationship("Match", back_populates="passenger", foreign_keys="Match.passenger_id")
    ratings_given: Mapped[list["Rating"]] = relationship("Rating", back_populates="rater", foreign_keys="Rating.rater_id")
    ratings_received: Mapped[list["Rating"]] = relationship("Rating", back_populates="rated", foreign_keys="Rating.rated_id")
    blocks_made: Mapped[list["Block"]] = relationship("Block", back_populates="blocker", foreign_keys="Block.blocker_id")
    blocks_received: Mapped[list["Block"]] = relationship("Block", back_populates="blocked", foreign_keys="Block.blocked_id")

    # Saved personal addresses
    addresses: Mapped[list["UserAddress"]] = relationship("UserAddress", back_populates="user", cascade="all, delete-orphan")

    # Email verification
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship("EmailVerificationToken", back_populates="user")

    @property
    def profile_complete(self) -> bool:
        if self.dev_owner_hash is not None:
            return True
        required = (self.name, self.course, self.gender, self.birth_date, self.phone)
        if not all(required) or any(isinstance(v, str) and not v.strip() for v in required):
            return False
        if self.age is None or not 16 <= self.age <= 100:
            return False
        digits = re.sub(r"\D", "", self.phone)
        if len(digits) not in (10, 11) and not (digits.startswith("55") and len(digits) in (12, 13)):
            return False
        if self.is_driver:
            return bool(re.fullmatch(r"[A-Z]{3}[0-9]([0-9]|[A-J])[0-9]{2}", self.car_plate or "")) and all(value and value.strip() for value in (
                self.car_brand, self.car_model, self.car_color, self.car_plate,
            ))
        return True

    @property
    def age(self) -> int | None:
        """Age in full years, derived from birth_date (None if not provided)."""
        if not self.birth_date:
            return None
        today = date.today()
        years = today.year - self.birth_date.year
        if (today.month, today.day) < (self.birth_date.month, self.birth_date.day):
            years -= 1
        return years


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    purpose: Mapped[str] = mapped_column(String(20), default="verification", server_default="verification")
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")

    user: Mapped["User"] = relationship("User", back_populates="verification_tokens")
