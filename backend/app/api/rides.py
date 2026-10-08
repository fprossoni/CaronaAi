"""Rides router — /rides/*"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.api.deps import DbSession, DriverUser, VerifiedUser
from app.models.ride import Ride, RideStatus
from app.schemas.ride import RideCreate, RideDetail, RidePublic, TripHistory, TripParticipant
from app.services.matching import find_matching_rides
from app.services.osrm import get_route

router = APIRouter(prefix="/rides", tags=["rides"])


def _point_wkt(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


@router.post("/", response_model=RideDetail, status_code=status.HTTP_201_CREATED)
async def create_ride(body: RideCreate, current_user: DriverUser, db: DbSession) -> RideDetail:
    """Create a new ride offer (driver only)."""
    # Calculate route via OSRM
    route = await get_route(
        [(body.origin_lat, body.origin_lng), (body.destination_lat, body.destination_lng)],
        with_geometry=True,
    )

    # Encode route geometry as WKT LineString for PostGIS
    route_line = None
    route_geojson = None
    if route.geometry and route.geometry.get("type") == "LineString":
        route_geojson = route.geometry
        coords = route.geometry["coordinates"]  # [[lng, lat], ...]
        wkt_coords = ", ".join(f"{c[0]} {c[1]}" for c in coords)
        route_line = WKTElement(f"LINESTRING({wkt_coords})", srid=4326)

    ride = Ride(
        driver_id=current_user.id,
        origin_label=body.origin_label,
        destination_label=body.destination_label,
        campus_point=body.campus_point,
        origin_point=_point_wkt(body.origin_lat, body.origin_lng),
        destination_point=_point_wkt(body.destination_lat, body.destination_lng),
        route_line=route_line,
        route_distance_meters=route.distance_meters,
        route_duration_seconds=route.duration_seconds,
        departure_at=body.departure_at,
        delay_tolerance_minutes=body.delay_tolerance_minutes,
        total_seats=body.total_seats,
        available_seats=body.total_seats,
        women_only=body.women_only,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)

    # Attach geojson for the response
    result = RideDetail.model_validate(ride)
    result.route_geojson = route_geojson
    return result


@router.get("/search", response_model=list[RidePublic])
async def search_rides(
    pickup_lat: float,
    pickup_lng: float,
    pickup_label: str,
    current_user: VerifiedUser,
    db: DbSession,
    dropoff_lat: float | None = None,
    dropoff_lng: float | None = None,
    women_only: bool = False,
    departure_after: datetime | None = None,
) -> list[RidePublic]:
    """Search for rides matching the passenger's pickup location."""
    candidates = await find_matching_rides(
        db=db,
        passenger_id=current_user.id,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
        dropoff_lat=dropoff_lat,
        dropoff_lng=dropoff_lng,
        women_only=women_only,
        departure_after=departure_after,
    )

    results = []
    for c in candidates:
        ride_schema = RidePublic.model_validate(c.ride)
        ride_schema.detour_meters = c.detour_meters
        ride_schema.detour_seconds = c.detour_seconds
        results.append(ride_schema)

    return results


@router.get("/my", response_model=list[RideDetail])
def get_my_rides(current_user: VerifiedUser, db: DbSession) -> list[Ride]:
    """Get all rides created by the current driver."""
    rides = db.execute(
        select(Ride)
        .where(Ride.driver_id == current_user.id)
        .order_by(Ride.departure_at.desc())
    ).scalars().all()
    return list(rides)


@router.get("/history", response_model=list[TripHistory])
def get_history(current_user: VerifiedUser, db: DbSession) -> list[TripHistory]:
    """Trips the user took part in — as driver or as passenger.

    A trip is history when the ride was cancelled/completed or its departure
    time has already passed. Each item lists the participants (driver +
    accepted passengers), excluding the current user.
    """
    from datetime import UTC, datetime

    from app.models.match import Match, MatchStatus

    now = datetime.now(UTC)

    def build_participants(ride: Ride, exclude_id: int) -> list[TripParticipant]:
        participants: list[TripParticipant] = []
        driver = ride.driver
        if driver.id != exclude_id:
            participants.append(TripParticipant(
                id=driver.id,
                name=driver.name,
                course=driver.course,
                photo_url=driver.photo_url,
                avg_rating=driver.avg_rating,
                rating_count=driver.rating_count,
                role="driver",
            ))
        for m in ride.matches:
            if m.status == MatchStatus.ACCEPTED and m.passenger_id != exclude_id:
                p = m.passenger
                participants.append(TripParticipant(
                    id=p.id,
                    name=p.name,
                    course=p.course,
                    photo_url=p.photo_url,
                    avg_rating=p.avg_rating,
                    rating_count=p.rating_count,
                    role="passenger",
                ))
        return participants

    def ride_status(ride: Ride) -> str:
        return "cancelled" if ride.status == RideStatus.CANCELLED else "completed"

    results: list[TripHistory] = []

    # 1) As driver — rides completed/cancelled or already departed
    driver_rides = db.execute(
        select(Ride).where(Ride.driver_id == current_user.id)
    ).scalars().all()
    for ride in driver_rides:
        is_history = ride.status in (RideStatus.COMPLETED, RideStatus.CANCELLED) or ride.departure_at <= now
        if not is_history:
            continue
        results.append(TripHistory(
            ride_id=ride.id,
            role="driver",
            status=ride_status(ride),
            departure_at=ride.departure_at,
            origin_label=ride.origin_label,
            destination_label=ride.destination_label,
            participants=build_participants(ride, current_user.id),
        ))

    # 2) As passenger — accepted (then completed/cancelled) or cancelled matches
    passenger_matches = db.execute(
        select(Match).where(Match.passenger_id == current_user.id)
    ).scalars().all()
    seen_rides: set[int] = set()
    for match in passenger_matches:
        if match.status not in (MatchStatus.ACCEPTED, MatchStatus.CANCELLED):
            continue
        ride = match.ride
        if ride.id in seen_rides:
            continue
        seen_rides.add(ride.id)
        is_ride_history = ride.status in (RideStatus.COMPLETED, RideStatus.CANCELLED) or ride.departure_at <= now
        if match.status == MatchStatus.ACCEPTED and not is_ride_history:
            continue
        # A cancelled participation is "cancelled" regardless of the ride status
        participation_status = "cancelled" if match.status == MatchStatus.CANCELLED else ride_status(ride)
        results.append(TripHistory(
            ride_id=ride.id,
            role="passenger",
            status=participation_status,
            departure_at=ride.departure_at,
            origin_label=ride.origin_label,
            destination_label=ride.destination_label,
            participants=build_participants(ride, current_user.id),
        ))

    results.sort(key=lambda t: t.departure_at, reverse=True)
    return results


@router.get("/{ride_id}", response_model=RideDetail)
def get_ride(ride_id: int, db: DbSession, current_user: VerifiedUser) -> Ride:
    """Get a specific ride by ID."""
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return ride


@router.patch("/{ride_id}/cancel")
def cancel_ride(ride_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Cancel a ride (driver only, only if ACTIVE or FULL)."""
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")
    if ride.status not in (RideStatus.ACTIVE, RideStatus.FULL):
        raise HTTPException(status_code=400, detail="Ride cannot be cancelled in its current state")

    ride.status = RideStatus.CANCELLED
    db.commit()
    return {"message": "Ride cancelled"}
