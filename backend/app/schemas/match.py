"""Pydantic schemas for matches."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.match import MatchStatus
from app.schemas.address import AddressCreate
from app.schemas.ride import RidePublic
from app.schemas.user import UserPublic


class MatchRequest(BaseModel):
    ride_id: int

    # Address-first input: either a saved address ID or new address details
    pickup_address_id: int | None = None
    custom_address: AddressCreate | None = None

    # Optional / Direct coordinates (computed automatically if address is provided)
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    pickup_label: str | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    dropoff_label: str | None = None
    pickup_region: str | None = None  # Neighbourhood/area — shown to driver pre-acceptance


class MatchBatchRequest(BaseModel):
    """Passenger sends a "matching" to several rides from the search list at once."""
    ride_ids: list[int] = Field(min_length=1, max_length=30)

    # Address-first input: either a saved address ID or new address details
    pickup_address_id: int | None = None
    custom_address: AddressCreate | None = None

    # Optional / Direct coordinates (computed automatically if address is provided)
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    pickup_label: str | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    dropoff_label: str | None = None
    pickup_region: str | None = None


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
    """What the driver sees about a match request.
    
    Exact pickup street and number are NOT included for pending requests — only region.
    Detailed address and phone are revealed after acceptance.
    """
    id: int
    ride_id: int
    status: MatchStatus
    passenger: UserPublic
    pickup_region: str       # e.g. "Bairro Petrópolis"
    detour_meters: float
    detour_seconds: float
    created_at: datetime

    # Revealed only after acceptance
    pickup_street: str | None = None
    pickup_number: str | None = None
    pickup_complement: str | None = None
    pickup_postal_code: str | None = None
    pickup_neighborhood: str | None = None
    pickup_city: str | None = None
    passenger_phone: str | None = None

    model_config = {"from_attributes": True}


class MatchConfirmed(MatchPublic):
    """Returned to both parties after driver accepts.
    
    Includes exact pickup coords, contact info, and detailed pickup address.
    """
    # Driver info (for passenger)
    driver_phone: str | None = None
    # Passenger exact pickup & address (revealed to driver only after acceptance)
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    passenger_phone: str | None = None
    pickup_street: str | None = None
    pickup_number: str | None = None
    pickup_complement: str | None = None
    pickup_postal_code: str | None = None
    pickup_neighborhood: str | None = None
    pickup_city: str | None = None

    model_config = {"from_attributes": True}


class MatchWithRide(MatchPublic):
    """A match the passenger made, including the ride summary.

    Used by GET /matches/my so the passenger can see route, schedule and driver
    without opening each ride individually.
    """
    ride: RidePublic


class MatchActionRequest(BaseModel):
    action: str  # "accept" | "reject"


class MatchBatchSkipped(BaseModel):
    ride_id: int
    reason: str


class MatchBatchResult(BaseModel):
    batch_id: str
    created: list[MatchPublic]
    skipped: list[MatchBatchSkipped]
