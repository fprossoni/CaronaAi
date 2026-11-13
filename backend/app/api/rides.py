"""Rides router — /rides/*"""

from datetime import UTC, datetime
from typing import Annotated, TypeVar

from fastapi import APIRouter, HTTPException, Query, status
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import func, select

from app.api.deps import DbSession, DriverUser, VerifiedUser
from app.core.campuses import CAMPUS_COORDS, CAMPUS_REQUIRED_MESSAGE, campus_at, campus_label
from app.models.address import UserAddress
from app.models.rating import Rating
from app.models.ride import Ride, RideStatus
from app.models.user import Gender
from app.schemas.ride import (
    RideCreate, RideDetail, RidePublic, RideSearchResult, RoutePreview, RoutePreviewRequest,
    SearchRidesRequest, TripHistory, TripParticipant,
)
from app.services.addresses import get_owned_address
from app.services.geocoding import geocode_address
from app.services.matching import find_matching_rides
from app.services.osrm import InvalidRouteError, RouteResult, get_route

router = APIRouter(prefix="/rides", tags=["rides"])
RideSchema = TypeVar("RideSchema", bound=RidePublic)

def _point_wkt(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _serialize_ride(ride: Ride, schema_cls: type[RideSchema], *, driver_view: bool = False) -> RideSchema:
    """Convert ORM Ride to Pydantic schema including PostGIS coordinates & route GeoJSON."""
    result = schema_cls.model_validate(ride)
    try:
        if ride.origin_point is not None:
            pt = to_shape(ride.origin_point)
            result.origin_lat = pt.y
            result.origin_lng = pt.x
        if ride.destination_point is not None:
            pt = to_shape(ride.destination_point)
            result.destination_lat = pt.y
            result.destination_lng = pt.x
        route_line = ride.route_line
        if driver_view and ride.planned_route:
            route_line = ride.planned_route_line
            result.route_distance_meters = ride.planned_route["distance"]
            result.route_duration_seconds = ride.planned_route["duration"]
        if route_line is not None:
            result.route_geojson = dict(mapping(to_shape(route_line)))
    except Exception:
        pass
    return result


async def _route_between(origin: tuple[float, float], destination: tuple[float, float]) -> RouteResult:
    try:
        return await get_route([origin, destination], with_geometry=True)
    except InvalidRouteError as exc:
        raise HTTPException(status_code=400, detail="Não foi possível calcular uma rota entre os pontos informados.") from exc


@router.post("/preview", response_model=RoutePreview)
async def preview_route(body: RoutePreviewRequest, current_user: DriverUser) -> RoutePreview:
    origin = (body.origin.lat, body.origin.lng)
    destination = (body.destination.lat, body.destination.lng)
    if not (campus_at(origin) or campus_at(destination)):
        raise HTTPException(status_code=400, detail=CAMPUS_REQUIRED_MESSAGE)
    route = await _route_between(origin, destination)
    return RoutePreview(route_geojson=route.geometry)


@router.post("/", response_model=RideDetail, status_code=status.HTTP_201_CREATED)
async def create_ride(body: RideCreate, current_user: DriverUser, db: DbSession) -> RideDetail:
    """Create a ride between the two supplied locations."""
    if body.women_only and current_user.gender != Gender.FEMALE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas motoristas mulheres podem oferecer caronas exclusivas para mulheres.",
        )

    origin_lat = body.origin_lat
    origin_lng = body.origin_lng
    origin_label = body.origin_label
    destination_lat = body.destination_lat
    destination_lng = body.destination_lng
    destination_label = body.destination_label

    if body.origin_campus_id is not None:
        origin_lat, origin_lng = CAMPUS_COORDS[body.origin_campus_id]
        origin_label = campus_label(body.origin_campus_id)
    elif body.origin_address_id is not None:
        address = get_owned_address(db, body.origin_address_id, current_user.id)
        origin_lat, origin_lng, origin_label = address.lat, address.lng, address.full_address
    if body.destination_campus_id is not None:
        destination_lat, destination_lng = CAMPUS_COORDS[body.destination_campus_id]
        destination_label = campus_label(body.destination_campus_id)
    elif body.destination_address_id is not None:
        address = get_owned_address(db, body.destination_address_id, current_user.id)
        destination_lat, destination_lng, destination_label = address.lat, address.lng, address.full_address

    # Support the original campus and address payload.
    if (
        body.campus_point
        and not (body.origin_campus_id or body.destination_campus_id)
        and None in (origin_lat, origin_lng, destination_lat, destination_lng)
    ):
        campus_lat, campus_lng = CAMPUS_COORDS[body.campus_point]
        campus_name = campus_label(body.campus_point)

        # Resolve driver's personal address
        addr_lat: float | None = None
        addr_lng: float | None = None
        addr_label: str = ""

        if body.address_id is not None:
            saved_addr = get_owned_address(db, body.address_id, current_user.id)
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

    if None in (origin_lat, origin_lng, destination_lat, destination_lng):
        raise HTTPException(status_code=400, detail="Informe os pontos de origem e destino.")
    campus = campus_at((destination_lat, destination_lng)) or campus_at((origin_lat, origin_lng))
    if campus is None:
        raise HTTPException(status_code=400, detail=CAMPUS_REQUIRED_MESSAGE)
    if not origin_label or not destination_label:
        raise HTTPException(status_code=400, detail="Identifique os pontos de origem e destino.")

    route = await _route_between((origin_lat, origin_lng), (destination_lat, destination_lng))

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
        campus_point=campus,
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

    result = _serialize_ride(ride, RideDetail)
    if route_geojson and not result.route_geojson:
        result.route_geojson = route_geojson
    return result


@router.get("/search", response_model=list[RideSearchResult])
async def search_rides(
    current_user: VerifiedUser,
    db: DbSession,
    search: Annotated[SearchRidesRequest, Query()],
) -> list[RideSearchResult]:
    """Search by pickup, dropoff and estimated pickup window, ordered by detour."""
    if search.pickup_before <= datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Informe um fim posterior ao horário atual.")

    pickup = (search.pickup_lat, search.pickup_lng)
    dropoff = (search.dropoff_lat, search.dropoff_lng)
    if search.campus_point is not None:
        if search.direction is None:
            raise HTTPException(status_code=400, detail="Informe um campus e um sentido válidos.")
        campus = CAMPUS_COORDS[search.campus_point]
        if search.direction == "from_campus":
            pickup = campus
        else:
            dropoff = campus

    pickup_address_id = search.pickup_address_id
    dropoff_address_id = search.dropoff_address_id
    if search.campus_point is not None and search.address_id is not None:
        if search.direction == "from_campus":
            dropoff_address_id = search.address_id
        else:
            pickup_address_id = search.address_id
    if search.pickup_campus_id is not None:
        pickup = CAMPUS_COORDS[search.pickup_campus_id]
    elif pickup_address_id is not None:
        address = get_owned_address(db, pickup_address_id, current_user.id)
        pickup = (address.lat, address.lng)
    if search.dropoff_campus_id is not None:
        dropoff = CAMPUS_COORDS[search.dropoff_campus_id]
    elif dropoff_address_id is not None:
        address = get_owned_address(db, dropoff_address_id, current_user.id)
        dropoff = (address.lat, address.lng)
    if None in (*pickup, *dropoff):
        raise HTTPException(status_code=400, detail="Informe os pontos de origem e destino.")
    if not (campus_at(pickup) or campus_at(dropoff)):
        raise HTTPException(status_code=400, detail=CAMPUS_REQUIRED_MESSAGE)

    from app.models.match import Match, MatchStatus

    candidates = await find_matching_rides(
        db=db,
        passenger_id=current_user.id,
        pickup_lat=pickup[0],
        pickup_lng=pickup[1],
        dropoff_lat=dropoff[0],
        dropoff_lng=dropoff[1],
        passenger_gender=current_user.gender,
        women_only=search.women_only,
        pickup_after=search.pickup_after,
        pickup_before=search.pickup_before,
        max_detour_meters=search.max_detour_meters,
        max_detour_seconds=search.max_detour_seconds,
    )

    my_matches: dict[int, Match] = {}
    completed_counts: dict[int, int] = {}
    if candidates:
        rows = db.execute(
            select(Match)
            .where(Match.passenger_id == current_user.id)
            .where(Match.ride_id.in_([c.ride.id for c in candidates]))
            .where(Match.status.in_([MatchStatus.PENDING, MatchStatus.ACCEPTED]))
        ).scalars().all()
        my_matches = {m.ride_id: m for m in rows}
        completed_rows = db.execute(
            select(Ride.driver_id, func.count())
            .where(Ride.driver_id.in_({candidate.ride.driver_id for candidate in candidates}))
            .where(Ride.status == RideStatus.COMPLETED)
            .group_by(Ride.driver_id)
        )
        completed_counts = {driver_id: count for driver_id, count in completed_rows}

    results = []
    for c in candidates:
        ride_schema = _serialize_ride(c.ride, RideSearchResult)
        ride_schema.driver_completed_ride_count = completed_counts.get(c.ride.driver_id, 0)
        ride_schema.detour_meters = c.detour_meters
        ride_schema.detour_seconds = c.detour_seconds
        ride_schema.estimated_pickup_at = c.estimated_pickup_at
        ride_schema.estimated_dropoff_at = c.estimated_dropoff_at
        ride_schema.detour_geojson = c.detour_geojson
        mine = my_matches.get(c.ride.id)
        if mine:
            ride_schema.my_match_id = mine.id
            ride_schema.my_match_status = mine.status.value
        results.append(ride_schema)

    return results


@router.get("/my", response_model=list[RideDetail])
def get_my_rides(current_user: VerifiedUser, db: DbSession) -> list[RideDetail]:
    """Get all rides created by the current driver."""
    rides = db.execute(
        select(Ride)
        .where(Ride.driver_id == current_user.id)
        .order_by(Ride.departure_at.desc())
    ).scalars().all()
    return [_serialize_ride(r, RideDetail, driver_view=True) for r in rides]


@router.get("/history", response_model=list[TripHistory])
def get_history(current_user: VerifiedUser, db: DbSession) -> list[TripHistory]:
    """Trips the user took part in — as driver or as passenger.

    A trip is history when the ride was cancelled/completed. Each item lists the participants (driver +
    accepted passengers), excluding the current user.
    """
    from app.models.match import Match, MatchStatus

    # Fetch ratings already submitted by current_user
    user_ratings = db.execute(
        select(Rating.match_id, Rating.rated_id).where(Rating.rater_id == current_user.id)
    ).all()
    rated_pairs = {(r.match_id, r.rated_id) for r in user_ratings}

    def build_participants(ride: Ride, exclude_id: int, viewer_match_id: int | None = None) -> list[TripParticipant]:
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
                match_id=viewer_match_id,
                already_rated=bool(viewer_match_id and (viewer_match_id, driver.id) in rated_pairs),
            ))
        for m in ride.matches:
            if m.status == MatchStatus.ACCEPTED and m.passenger_id != exclude_id:
                p = m.passenger
                target_match_id = m.id if ride.driver_id == exclude_id else viewer_match_id
                participants.append(TripParticipant(
                    id=p.id,
                    name=p.name,
                    course=p.course,
                    photo_url=p.photo_url,
                    avg_rating=p.avg_rating,
                    rating_count=p.rating_count,
                    role="passenger",
                    match_id=target_match_id,
                    already_rated=bool(target_match_id and (target_match_id, p.id) in rated_pairs),
                ))
        return participants

    def ride_status(ride: Ride) -> str:
        return "cancelled" if ride.status == RideStatus.CANCELLED else "completed"

    results: list[TripHistory] = []

    # 1) As driver — rides explicitly completed/cancelled
    driver_rides = db.execute(
        select(Ride).where(Ride.driver_id == current_user.id)
    ).scalars().all()
    for ride in driver_rides:
        is_history = ride.status in (RideStatus.COMPLETED, RideStatus.CANCELLED)
        if not is_history:
            continue
        results.append(TripHistory(
            ride_id=ride.id,
            role="driver",
            status=ride_status(ride),
            departure_at=ride.departure_at,
            origin_label=ride.origin_label,
            destination_label=ride.destination_label,
            participants=build_participants(ride, current_user.id, None),
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
        is_ride_history = ride.status in (RideStatus.COMPLETED, RideStatus.CANCELLED)
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
            participants=build_participants(
                ride,
                current_user.id,
                match.id if match.status == MatchStatus.ACCEPTED else None,
            ),
        ))

    results.sort(key=lambda t: t.departure_at, reverse=True)
    return results


@router.get("/{ride_id}", response_model=RideDetail)
def get_ride(ride_id: int, db: DbSession, current_user: VerifiedUser) -> RideDetail:
    """Get a specific ride by ID."""
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return _serialize_ride(ride, RideDetail, driver_view=ride.driver_id == current_user.id)


@router.patch("/{ride_id}/cancel")
def cancel_ride(ride_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Cancel a ride (driver only, only if ACTIVE or FULL)."""
    ride = db.get(Ride, ride_id, with_for_update=True)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")
    if ride.status not in (RideStatus.ACTIVE, RideStatus.FULL):
        raise HTTPException(status_code=400, detail="Ride cannot be cancelled in its current state")

    ride.status = RideStatus.CANCELLED
    db.commit()
    return {"message": "Ride cancelled"}


@router.patch("/{ride_id}/start")
def start_ride(ride_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    ride = db.get(Ride, ride_id, with_for_update=True)
    if not ride or ride.driver_id != current_user.id:
        raise HTTPException(403, "Apenas o motorista pode iniciar a carona")
    if ride.status not in (RideStatus.ACTIVE, RideStatus.FULL):
        raise HTTPException(409, "Esta carona não pode ser iniciada")
    ride.status = RideStatus.IN_PROGRESS
    db.commit()
    return {"message": "Carona iniciada"}


@router.patch("/{ride_id}/complete")
def complete_ride(ride_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    ride = db.get(Ride, ride_id, with_for_update=True)
    if not ride or ride.driver_id != current_user.id:
        raise HTTPException(403, "Apenas o motorista pode concluir a carona")
    if ride.status != RideStatus.IN_PROGRESS:
        raise HTTPException(409, "Inicie a carona antes de concluí-la")
    ride.status = RideStatus.COMPLETED
    db.commit()
    return {"message": "Carona concluída. Conversas encerradas."}
