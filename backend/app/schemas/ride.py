"""Pydantic schemas for rides."""

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, AwareDatetime, BaseModel, Field, field_validator, model_validator

from app.models.ride import UFRGS_CAMPUS, RideStatus
from app.schemas.address import AddressCreate
from app.schemas.user import UserPublic

TripDirection = Literal["to_campus", "from_campus"]


class PickupWindow(BaseModel):
    pickup_after: AwareDatetime = Field(validation_alias=AliasChoices("pickup_after", "departure_after"))
    pickup_before: AwareDatetime = Field(validation_alias=AliasChoices("pickup_before", "departure_before"))

    @model_validator(mode="after")
    def validate_pickup_window(self) -> "PickupWindow":
        if self.pickup_before <= self.pickup_after:
            raise ValueError("O fim do intervalo de saída deve ser posterior ao início.")
        return self


class Coordinates(BaseModel):
    lat: float
    lng: float


class RideCreate(BaseModel):
    campus_point: str | None = None
    direction: TripDirection = "to_campus"

    # Address selection: either an existing saved address or a new address definition
    origin_address_id: int | None = None
    destination_address_id: int | None = None
    address_id: int | None = None
    custom_address: AddressCreate | None = None
    save_address: bool = True

    # Legacy / Direct coordinates (optional - backend computes from address + campus)
    origin_label: str | None = None
    origin_lat: float | None = Field(default=None, ge=-90, le=90)
    origin_lng: float | None = Field(default=None, ge=-180, le=180)
    destination_label: str | None = None
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)

    departure_at: datetime
    total_seats: int = 1
    women_only: bool = False

    @field_validator("campus_point")
    @classmethod
    def validate_campus(cls, v: str | None) -> str | None:
        if v is not None and v not in UFRGS_CAMPUS:
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
    campus_point: str | None = None
    origin_lat: float | None = Field(default=None, ge=-90, le=90)
    origin_lng: float | None = Field(default=None, ge=-180, le=180)
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)
    departure_at: datetime
    total_seats: int
    available_seats: int
    women_only: bool
    status: RideStatus
    route_distance_meters: float
    route_duration_seconds: float
    route_geojson: dict | None = None

    # Detour calculated for a specific passenger search
    detour_meters: float | None = None
    detour_seconds: float | None = None
    estimated_pickup_at: datetime | None = None
    estimated_dropoff_at: datetime | None = None
    detour_geojson: dict | None = None

    # The searching passenger's own active request for this ride, if any
    my_match_id: int | None = None
    my_match_status: str | None = None

    model_config = {"from_attributes": True}


class RideDetail(RidePublic):
    """Full ride info including geometry — returned to the driver."""

    model_config = {"from_attributes": True}


class TripParticipant(BaseModel):
    """A person who took part in a ride (driver or accepted passenger)."""
    id: int
    name: str | None
    course: str | None
    photo_url: str | None
    avg_rating: float
    rating_count: int
    role: str  # "driver" | "passenger"
    match_id: int | None = None
    already_rated: bool = False


class TripHistory(BaseModel):
    """A trip the current user participated in (driver or passenger view)."""
    ride_id: int
    role: str            # "driver" | "passenger"
    status: str          # "completed" | "cancelled"
    departure_at: datetime
    origin_label: str
    destination_label: str
    participants: list[TripParticipant]


class SearchRidesRequest(PickupWindow):
    campus_point: str | None = None
    direction: TripDirection | None = None
    pickup_address_id: int | None = None
    dropoff_address_id: int | None = None
    address_id: int | None = None
    pickup_lat: float | None = Field(default=None, ge=-90, le=90)
    pickup_lng: float | None = Field(default=None, ge=-180, le=180)
    pickup_label: str | None = None
    dropoff_lat: float | None = Field(default=None, ge=-90, le=90)
    dropoff_lng: float | None = Field(default=None, ge=-180, le=180)
    dropoff_label: str | None = None
    women_only: bool = False
