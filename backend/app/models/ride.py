"""SQLAlchemy ORM models for rides."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum as PyEnum

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RideStatus(str, PyEnum):
    ACTIVE = "active"       # Accepting passengers
    FULL = "full"           # No more seats
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# List of valid UFRGS campus identifiers
UFRGS_CAMPUS = [
    "campus_centro",
    "campus_saude",
    "campus_olimpico",
    "campus_vale",
    "campus_agronomia",
    "campus_litoral_norte",
    "campus_agronomia_esefid",  # backward compatibility
]

CAMPUS_COORDS: dict[str, tuple[float, float]] = {
    "campus_centro": (-30.0349, -51.2177),
    "campus_saude": (-30.0395, -51.2089),
    "campus_olimpico": (-30.0538, -51.1789),
    "campus_vale": (-30.0734, -51.1201),
    "campus_agronomia": (-30.0664, -51.1378),
    "campus_litoral_norte": (-29.9794, -50.1330),
    "campus_agronomia_esefid": (-30.0608, -51.1734),  # backward compatibility
}


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # Route description
    origin_label: Mapped[str] = mapped_column(String(300))         # Human-readable
    destination_label: Mapped[str] = mapped_column(String(300))
    campus_point: Mapped[str] = mapped_column(String(50))           # Which campus is origin/destination

    # Coordinates stored as PostGIS geometry (WGS84)
    origin_point = mapped_column(Geometry("POINT", srid=4326))
    destination_point = mapped_column(Geometry("POINT", srid=4326))
    route_line = mapped_column(Geometry("LINESTRING", srid=4326))   # Full route geometry from OSRM

    # Route metrics (pre-calculated)
    route_distance_meters: Mapped[float] = mapped_column(Float, default=0.0)
    route_duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)

    # Schedule
    departure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delay_tolerance_minutes: Mapped[int] = mapped_column(Integer, default=10)

    # Seats
    total_seats: Mapped[int] = mapped_column(Integer, default=1)
    available_seats: Mapped[int] = mapped_column(Integer, default=1)

    # Filters
    women_only: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[RideStatus] = mapped_column(Enum(RideStatus), default=RideStatus.ACTIVE)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    driver: Mapped["User"] = relationship("User", back_populates="rides_offered", foreign_keys=[driver_id])
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="ride")
