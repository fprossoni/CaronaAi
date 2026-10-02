"""Matches router — /matches/*"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import select

from app.api.deps import DbSession, VerifiedUser
from app.models.match import Match, MatchStatus
from app.models.ride import Ride, RideStatus
from app.schemas.match import (
    MatchActionRequest,
    MatchConfirmed,
    MatchForDriver,
    MatchPublic,
    MatchRequest,
)

router = APIRouter(prefix="/matches", tags=["matches"])


def _point_wkt(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


@router.post("/", response_model=MatchPublic, status_code=status.HTTP_201_CREATED)
async def request_match(
    body: MatchRequest,
    current_user: VerifiedUser,
    db: DbSession,
) -> Match:
    """Passenger requests a match with a driver's ride."""
    ride = db.get(Ride, body.ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != RideStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Ride is not accepting passengers")
    if ride.available_seats <= 0:
        raise HTTPException(status_code=400, detail="No seats available")
    if ride.driver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot request your own ride")

    # Check for existing pending/accepted match
    existing = db.execute(
        select(Match)
        .where(Match.ride_id == body.ride_id)
        .where(Match.passenger_id == current_user.id)
        .where(Match.status.in_([MatchStatus.PENDING, MatchStatus.ACCEPTED]))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active match request for this ride")

    # Calculate detour for storage
    from geoalchemy2.shape import to_shape

    from app.services.osrm import get_route

    origin = to_shape(ride.origin_point)
    dest = to_shape(ride.destination_point)
    waypoints = [(origin.y, origin.x), (body.pickup_lat, body.pickup_lng)]
    if body.dropoff_lat and body.dropoff_lng:
        waypoints.append((body.dropoff_lat, body.dropoff_lng))
    waypoints.append((dest.y, dest.x))

    detour_route = await get_route(waypoints)
    detour_meters = max(0.0, detour_route.distance_meters - ride.route_distance_meters)
    detour_seconds = max(0.0, detour_route.duration_seconds - ride.route_duration_seconds)

    match = Match(
        ride_id=body.ride_id,
        passenger_id=current_user.id,
        pickup_point=_point_wkt(body.pickup_lat, body.pickup_lng),
        dropoff_point=_point_wkt(body.dropoff_lat, body.dropoff_lng) if body.dropoff_lat is not None and body.dropoff_lng is not None else None,
        pickup_label=body.pickup_label,
        dropoff_label=body.dropoff_label,
        pickup_region=body.pickup_region,
        detour_meters=detour_meters,
        detour_seconds=detour_seconds,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.get("/my", response_model=list[MatchPublic])
def get_my_matches(current_user: VerifiedUser, db: DbSession) -> list[Match]:
    """Get all matches for the current passenger."""
    matches = db.execute(
        select(Match)
        .where(Match.passenger_id == current_user.id)
        .order_by(Match.created_at.desc())
    ).scalars().all()
    return list(matches)


@router.get("/ride/{ride_id}", response_model=list[MatchForDriver])
def get_ride_matches(ride_id: int, current_user: VerifiedUser, db: DbSession) -> list[Match]:
    """Driver views pending match requests for their ride."""
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")

    matches = db.execute(
        select(Match)
        .where(Match.ride_id == ride_id)
        .where(Match.status == MatchStatus.PENDING)
    ).scalars().all()
    return list(matches)


@router.patch("/{match_id}/respond", response_model=MatchConfirmed)
def respond_to_match(
    match_id: int,
    body: MatchActionRequest,
    current_user: VerifiedUser,
    db: DbSession,
) -> MatchConfirmed:
    """Driver accepts or rejects a match request."""
    if body.action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'reject'")

    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    ride = db.get(Ride, match.ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")

    if match.status != MatchStatus.PENDING:
        raise HTTPException(status_code=400, detail="Match is no longer pending")

    match.responded_at = datetime.now(UTC)

    if body.action == "accept":
        if ride.available_seats <= 0:
            raise HTTPException(status_code=400, detail="No seats available")

        match.status = MatchStatus.ACCEPTED
        ride.available_seats -= 1
        if ride.available_seats == 0:
            ride.status = RideStatus.FULL

        db.commit()
        db.refresh(match)

        # Build MatchConfirmed with full info revealed
        pickup_shape = to_shape(match.pickup_point)
        passenger = match.passenger

        return MatchConfirmed(
            id=match.id,
            ride_id=match.ride_id,
            status=match.status,
            detour_meters=match.detour_meters,
            detour_seconds=match.detour_seconds,
            pickup_label=match.pickup_label,
            dropoff_label=match.dropoff_label,
            pickup_region=match.pickup_region,
            created_at=match.created_at,
            responded_at=match.responded_at,
            # Full info revealed after acceptance
            driver_phone=current_user.phone,
            pickup_lat=pickup_shape.y,
            pickup_lng=pickup_shape.x,
            passenger_phone=passenger.phone,
        )

    else:  # reject
        match.status = MatchStatus.REJECTED
        db.commit()
        db.refresh(match)
        return MatchConfirmed.model_validate(match)


@router.patch("/{match_id}/cancel")
def cancel_match(match_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Passenger cancels their own pending match."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.passenger_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your match")
    if match.status not in (MatchStatus.PENDING, MatchStatus.ACCEPTED):
        raise HTTPException(status_code=400, detail="Cannot cancel this match")

    if match.status == MatchStatus.ACCEPTED:
        # Restore the seat
        ride = db.get(Ride, match.ride_id)
        if ride:
            ride.available_seats += 1
            if ride.status == RideStatus.FULL:
                ride.status = RideStatus.ACTIVE

    match.status = MatchStatus.CANCELLED
    db.commit()
    return {"message": "Match cancelled"}


@router.get("/{match_id}", response_model=MatchConfirmed)
def get_match(match_id: int, current_user: VerifiedUser, db: DbSession) -> MatchConfirmed:
    """Get match details. Full info only returned if ACCEPTED."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    ride = db.get(Ride, match.ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    is_driver = ride.driver_id == current_user.id
    is_passenger = match.passenger_id == current_user.id

    if not (is_driver or is_passenger):
        raise HTTPException(status_code=403, detail="Access denied")

    result = MatchConfirmed.model_validate(match)

    # Only reveal exact location if match is accepted
    if match.status == MatchStatus.ACCEPTED:
        pickup_shape = to_shape(match.pickup_point)
        result.pickup_lat = pickup_shape.y
        result.pickup_lng = pickup_shape.x
        result.passenger_phone = match.passenger.phone
        result.driver_phone = ride.driver.phone

    return result
