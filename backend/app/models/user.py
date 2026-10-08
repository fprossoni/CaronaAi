"""SQLAlchemy ORM models for users."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Profile fields
    name: Mapped[str | None] = mapped_column(String(100))
    course: Mapped[str | None] = mapped_column(String(100))
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender))
    phone: Mapped[str | None] = mapped_column(String(20))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    social_link: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(String(300))
    campuses: Mapped[list[str] | None] = mapped_column(JSON)

    # Driver-specific
    is_driver: Mapped[bool] = mapped_column(Boolean, default=False)
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

    # Email verification
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship("EmailVerificationToken", back_populates="user")


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="verification_tokens")
