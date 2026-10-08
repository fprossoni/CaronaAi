"""Pydantic schemas for matches."""

from datetime import datetime

from pydantic import BaseModel

from app.models.match import MatchStatus
from app.schemas.ride import RidePublic
from app.schemas.user import UserPublic


class MatchRequest(BaseModel):
    ride_id: int
    pickup_lat: float
    pickup_lng: float
    pickup_label: str
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    dropoff_label: str | None = None
    pickup_region: str           # Neighbourhood/area — shown to driver pre-acceptance


class MatchPublic(BaseModel):
    """What the passenger sees about their own match."""
    id: int
    ride_id: int
    status: MatchStatus
    detour_meters: float
    detour_seconds: float
    pickup_label: str
    dropoff_label: str | None
    pickup_region: str
    created_at: datetime
    responded_at: datetime | None

    model_config = {"from_attributes": True}


class MatchForDriver(BaseModel):
    """What the driver sees about a pending match request.
    
    Exact pickup coordinates are NOT included — only region.
    Full coords are revealed after acceptance.
    """
    id: int
    ride_id: int
    status: MatchStatus
    passenger: UserPublic
    pickup_region: str       # e.g. "Bairro Petrópolis"
    detour_meters: float
    detour_seconds: float
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchConfirmed(MatchPublic):
    """Returned to both parties after driver accepts.
    
    Includes exact pickup coords and contact info.
    """
    # Driver info (for passenger)
    driver_phone: str | None = None
    # Passenger exact pickup (for driver)
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    passenger_phone: str | None = None

    model_config = {"from_attributes": True}


class MatchWithRide(MatchPublic):
    """A match the passenger made, including the ride summary.

    Used by GET /matches/my so the passenger can see route, schedule and driver
    without opening each ride individually.
    """
    ride: RidePublic


class MatchActionRequest(BaseModel):
    action: str  # "accept" | "reject"
