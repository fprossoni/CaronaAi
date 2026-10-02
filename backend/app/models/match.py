"""SQLAlchemy ORM models for ride matches."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum as PyEnum

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MatchStatus(str, PyEnum):
    PENDING = "pending"       # Passenger requested, waiting driver
    ACCEPTED = "accepted"     # Driver accepted — full info revealed
    REJECTED = "rejected"     # Driver rejected
    CANCELLED = "cancelled"   # Cancelled by either party


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), index=True)
    passenger_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # Passenger pickup/dropoff (exact coords — hidden until accepted)
    pickup_point = mapped_column(Geometry("POINT", srid=4326))
    dropoff_point = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    pickup_label: Mapped[str] = mapped_column(String(300))
    dropoff_label: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Approximate region shown to driver before acceptance
    pickup_region: Mapped[str] = mapped_column(String(100))   # e.g. "Bairro Petrópolis"

    # Detour metrics (calculated by matching service)
    detour_meters: Mapped[float] = mapped_column(Float, default=0.0)
    detour_seconds: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    ride: Mapped["Ride"] = relationship("Ride", back_populates="matches")
    passenger: Mapped["User"] = relationship("User", back_populates="matches_as_passenger", foreign_keys=[passenger_id])
