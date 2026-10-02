"""Pydantic schemas for rides."""

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.ride import UFRGS_CAMPUS, RideStatus
from app.schemas.user import UserPublic


class Coordinates(BaseModel):
    lat: float
    lng: float


class RideCreate(BaseModel):
    origin_label: str
    origin_lat: float
    origin_lng: float
    destination_label: str
    destination_lat: float
    destination_lng: float
    campus_point: str           # Which of the 5 campi is part of this trip
    departure_at: datetime
    delay_tolerance_minutes: int = 10
    total_seats: int = 1
    women_only: bool = False

    @field_validator("campus_point")
    @classmethod
    def validate_campus(cls, v: str) -> str:
        if v not in UFRGS_CAMPUS:
            raise ValueError(f"campus_point must be one of: {UFRGS_CAMPUS}")
        return v

    @field_validator("total_seats")
    @classmethod
    def seats_range(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("Seats must be between 1 and 8")
        return v


class RidePublic(BaseModel):
    """Ride data visible in listings (passenger view)."""
    id: int
    driver: UserPublic
    origin_label: str
    destination_label: str
    campus_point: str
    departure_at: datetime
    delay_tolerance_minutes: int
    total_seats: int
    available_seats: int
    women_only: bool
    status: RideStatus
    route_distance_meters: float
    route_duration_seconds: float

    # Detour calculated for a specific passenger search
    detour_meters: float | None = None
    detour_seconds: float | None = None

    model_config = {"from_attributes": True}


class RideDetail(RidePublic):
    """Full ride info including geometry — returned to the driver."""
    # Route GeoJSON for map display
    route_geojson: dict | None = None

    model_config = {"from_attributes": True}


class SearchRidesRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_label: str
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    dropoff_label: str | None = None
    departure_after: datetime | None = None
    women_only: bool = False
