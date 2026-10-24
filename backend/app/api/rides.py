"""Rides router — /rides/*"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.api.deps import DbSession, DriverUser, VerifiedUser
from app.models.address import UserAddress
from app.models.ride import CAMPUS_COORDS, Ride, RideStatus
from app.schemas.ride import RideCreate, RideDetail, RidePublic, TripHistory, TripParticipant
from app.services.geocoding import geocode_address
from app.services.matching import find_matching_rides
from app.services.osrm import get_route

router = APIRouter(prefix="/rides", tags=["rides"])

CAMPUS_NAMES: dict[str, str] = {
    "campus_centro": "UFRGS - Campus Centro",
    "campus_saude": "UFRGS - Campus Saúde",
    "campus_olimpico": "UFRGS - Campus Olímpico (ESEFID)",
    "campus_vale": "UFRGS - Campus do Vale",
    "campus_agronomia": "UFRGS - Campus Agronomia",
    "campus_litoral_norte": "UFRGS - Campus Litoral Norte",
}


def _point_wkt(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


@router.post("/", response_model=RideDetail, status_code=status.HTTP_201_CREATED)
async def create_ride(body: RideCreate, current_user: DriverUser, db: DbSession) -> RideDetail:
    """Create a new ride offer (driver only).

    Computes coordinates automatically from the chosen UFRGS campus and either a
    saved personal address or a physical address geocoded via Nominatim.
    """
    origin_lat = body.origin_lat
    origin_lng = body.origin_lng
    origin_label = body.origin_label
    destination_lat = body.destination_lat
    destination_lng = body.destination_lng
    destination_label = body.destination_label

    # Auto-resolve coordinates if not explicitly provided
    if origin_lat is None or destination_lat is None:
        campus_coords = CAMPUS_COORDS.get(body.campus_point)
        if not campus_coords:
            raise HTTPException(status_code=400, detail="Campus selecionado inválido")
        campus_lat, campus_lng = campus_coords
        campus_name = CAMPUS_NAMES.get(body.campus_point, body.campus_point)

        # Resolve driver's personal address
        addr_lat: float | None = None
        addr_lng: float | None = None
        addr_label: str = ""

        if body.address_id is not None:
            saved_addr = db.get(UserAddress, body.address_id)
            if not saved_addr or saved_addr.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Endereço pessoal salvo não encontrado")
            addr_lat = saved_addr.lat
            addr_lng = saved_addr.lng
            addr_label = saved_addr.full_address
        elif body.custom_address is not None:
            try:
                lat, lng, neighborhood, _ = await geocode_address(
                    street=body.custom_address.street,
                    number=body.custom_address.number,
                    city=body.custom_address.city,
                    state=body.custom_address.state,
                    country=body.custom_address.country,
                    postal_code=body.custom_address.postal_code,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

            addr_lat, addr_lng = lat, lng
            addr_label = f"{body.custom_address.street}, {body.custom_address.number} - {body.custom_address.city}"

            if body.save_address:
                new_addr = UserAddress(
                    user_id=current_user.id,
                    label=body.custom_address.label or "Endereço",
                    street=body.custom_address.street,
                    number=body.custom_address.number,
                    complement=body.custom_address.complement,
                    neighborhood=body.custom_address.neighborhood or neighborhood,
                    postal_code=body.custom_address.postal_code,
                    city=body.custom_address.city,
                    state=body.custom_address.state,
                    country=body.custom_address.country,
                    lat=lat,
                    lng=lng,
                )
                db.add(new_addr)
                db.flush()
        else:
            raise HTTPException(status_code=400, detail="Selecione um endereço salvo ou informe um endereço físico")

        if body.direction == "to_campus":
            origin_lat, origin_lng = addr_lat, addr_lng
            origin_label = origin_label or addr_label
            destination_lat, destination_lng = campus_lat, campus_lng
            destination_label = destination_label or campus_name
        else:
            origin_lat, origin_lng = campus_lat, campus_lng
            origin_label = origin_label or campus_name
            destination_lat, destination_lng = addr_lat, addr_lng
            destination_label = destination_label or addr_label

    # Calculate route via OSRM
    route = await get_route(
        [(origin_lat, origin_lng), (destination_lat, destination_lng)],
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
        origin_label=origin_label,
        destination_label=destination_label,
        campus_point=body.campus_point,
        origin_point=_point_wkt(origin_lat, origin_lng),
        destination_point=_point_wkt(destination_lat, destination_lng),
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
    current_user: VerifiedUser,
    db: DbSession,
    pickup_lat: float | None = None,
    pickup_lng: float | None = None,
    pickup_label: str | None = None,
    address_id: int | None = None,
    dropoff_lat: float | None = None,
    dropoff_lng: float | None = None,
    women_only: bool = False,
    departure_after: datetime | None = None,
) -> list[RidePublic]:
    """Search for rides matching the passenger's pickup location.

    Accepts an address_id (from passenger's saved addresses) or explicit coordinates.
    Results are ordered by smallest detour for the driver.
    """
    if address_id is not None:
        saved_addr = db.get(UserAddress, address_id)
        if not saved_addr or saved_addr.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Endereço não encontrado")
        pickup_lat = saved_addr.lat
        pickup_lng = saved_addr.lng
        pickup_label = pickup_label or saved_addr.full_address

    if pickup_lat is None or pickup_lng is None:
        raise HTTPException(status_code=400, detail="Informe um endereço salvo ou coordenadas de embarque")
    if not pickup_label:
        pickup_label = "Local de embarque"

    from app.models.match import Match, MatchStatus

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

    my_matches: dict[int, Match] = {}
    if candidates:
        rows = db.execute(
            select(Match)
            .where(Match.passenger_id == current_user.id)
            .where(Match.ride_id.in_([c.ride.id for c in candidates]))
            .where(Match.status.in_([MatchStatus.PENDING, MatchStatus.ACCEPTED]))
        ).scalars().all()
        my_matches = {m.ride_id: m for m in rows}

    results = []
    for c in candidates:
        ride_schema = RidePublic.model_validate(c.ride)
        ride_schema.detour_meters = c.detour_meters
        ride_schema.detour_seconds = c.detour_seconds
        mine = my_matches.get(c.ride.id)
        if mine:
            ride_schema.my_match_id = mine.id
            ride_schema.my_match_status = mine.status.value
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
