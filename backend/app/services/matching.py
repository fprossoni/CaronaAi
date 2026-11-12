"""Ride matching service — Detour Distance algorithm.

Algorithm:
  1. Match campus endpoints and check proximity for the remaining address
  2. Screen pickup times via OSRM Table when the driver needs to reach the pickup
  3. Compute the detour, reusing the original route when both endpoints coincide
  4. Filter by estimated pickup time and max detour thresholds, then sort by detour distance
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from geoalchemy2 import Geography, WKBElement, WKTElement
from geoalchemy2.functions import ST_DWithin, ST_GeomFromText, ST_SetSRID
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.campuses import CAMPUS_COORDS, campus_at
from app.core.config import settings
from app.models.rating import Block
from app.models.ride import Ride, RideStatus
from app.models.user import Gender
from app.services.osrm import get_pickup_durations, get_route

logger = logging.getLogger(__name__)

CAMPUS_POINTS = {
    campus_id: WKTElement(f"POINT({lng} {lat})", srid=4326)
    for campus_id, (lat, lng) in CAMPUS_COORDS.items()
}


class IncompatibleCampusError(ValueError):
    """The passenger and driver have different campus endpoints."""


def validate_campus_match(
    driver_origin: tuple[float, float],
    driver_destination: tuple[float, float],
    pickup: tuple[float, float],
    dropoff: tuple[float, float],
) -> None:
    origin_campus = campus_at(driver_origin)
    destination_campus = campus_at(driver_destination)
    if not (origin_campus or destination_campus):
        raise IncompatibleCampusError("A carona precisa ter pelo menos um campus da UFRGS.")
    if (origin_campus and origin_campus != campus_at(pickup)) or (
        destination_campus and destination_campus != campus_at(dropoff)
    ):
        raise IncompatibleCampusError("Use o mesmo campus da carona no lado correspondente do trajeto.")


def _campus_filter(column, campus_id: str | None):
    if campus_id is None:
        return ~or_(*(column == point for point in CAMPUS_POINTS.values()))
    point = CAMPUS_POINTS[campus_id]
    return and_(column.intersects(point), column == point)


@dataclass
class RideCandidate:
    ride: Ride
    detour_meters: float
    detour_seconds: float
    estimated_pickup_at: datetime
    estimated_dropoff_at: datetime | None = None
    detour_geojson: dict | None = None

    def rejection_reason(self, pickup_after: datetime, pickup_before: datetime) -> str | None:
        if not pickup_after <= self.estimated_pickup_at <= pickup_before:
            return "O horário previsto de chegada à origem está fora do intervalo informado."
        pickup_delay = (self.estimated_pickup_at - self.ride.departure_at).total_seconds()
        if not 0 <= pickup_delay <= settings.MATCH_MAX_PICKUP_DELAY_SECONDS:
            return "A chegada à origem está fora do tempo máximo após a saída do motorista."
        if (
            self.detour_meters > settings.OSRM_MAX_DETOUR_METERS
            or self.detour_seconds > settings.OSRM_MAX_DETOUR_SECONDS
        ):
            return "O ponto informado exige um desvio maior que o permitido."
        return None


def _point_coordinates(point: WKBElement | WKTElement) -> tuple[float, float]:
    shape = to_shape(point)
    return shape.y, shape.x


async def find_matching_rides(
    db: Session,
    passenger_id: int,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    *,
    passenger_gender: Gender | None,
    pickup_after: datetime,
    pickup_before: datetime,
    women_only: bool = False,
) -> list[RideCandidate]:
    """
    Returns a list of RideCandidate ordered by detour_meters ASC.
    
    Privacy note: exact passenger coordinates are only used server-side
    for the matching computation — they are never stored until a match
    is explicitly created.
    """
    if women_only and passenger_gender != Gender.FEMALE:
        return []

    pickup_campus = campus_at((pickup_lat, pickup_lng))
    dropoff_campus = campus_at((dropoff_lat, dropoff_lng))
    pickup = (pickup_lat, pickup_lng)
    dropoff = (dropoff_lat, dropoff_lng)
    if not (pickup_campus or dropoff_campus):
        return []

    line = func.coalesce(Ride.route_line, func.ST_MakeLine(Ride.origin_point, Ride.destination_point))

    def near(point: tuple[float, float]):
        lat, lng = point
        address = cast(ST_SetSRID(ST_GeomFromText(f"POINT({lng} {lat})"), 4326), Geography)
        return ST_DWithin(line, address, settings.OSRM_PREFILER_BUFFER_METERS, False)

    campus_routes = []
    if pickup_campus:
        starts_at_campus = and_(
            _campus_filter(Ride.origin_point, pickup_campus), Ride.departure_at >= pickup_after
        )
        campus_routes.append(and_(starts_at_campus, _campus_filter(Ride.destination_point, None), near(dropoff)))
        if dropoff_campus:
            campus_routes.append(and_(starts_at_campus, _campus_filter(Ride.destination_point, dropoff_campus)))
    if dropoff_campus:
        campus_routes.append(and_(
            _campus_filter(Ride.destination_point, dropoff_campus), _campus_filter(Ride.origin_point, None), near(pickup)
        ))

    earliest_departure = pickup_after
    if dropoff_campus:
        earliest_departure -= timedelta(seconds=settings.MATCH_MAX_PICKUP_DELAY_SECONDS)

    blocked_subq = select(Block.blocked_id).where(Block.blocker_id == passenger_id)
    blocker_subq = select(Block.blocker_id).where(Block.blocked_id == passenger_id)

    query = (
        select(Ride)
        .where(Ride.status == RideStatus.ACTIVE)
        .where(Ride.available_seats > 0)
        .where(Ride.driver_id != passenger_id)
        .where(
            Ride.departure_at > datetime.now(UTC),
            Ride.departure_at >= earliest_departure,
            Ride.departure_at <= pickup_before,
        )
        .where(Ride.driver_id.notin_(blocked_subq))
        .where(Ride.driver_id.notin_(blocker_subq))
        .where(or_(*campus_routes))
    )

    if women_only:
        query = query.where(Ride.women_only.is_(True))
    elif passenger_gender != Gender.FEMALE:
        query = query.where(Ride.women_only.is_(False))

    candidate_rides = db.execute(query).scalars().all()
    logger.debug("PostGIS pre-filter: %d candidate rides", len(candidate_rides))
    if not candidate_rides:
        return []

    rides_with_origins: list[tuple[Ride, tuple[float, float]]] = []
    for ride in candidate_rides:
        try:
            rides_with_origins.append((ride, _point_coordinates(ride.origin_point)))
        except Exception as exc:
            logger.warning("Invalid origin for ride %d (%s)", ride.id, type(exc).__name__)

    durations = {}
    table_origins = [origin for _, origin in rides_with_origins if origin != pickup]
    if len(table_origins) > 1:
        durations = await get_pickup_durations(table_origins, pickup)
    margin = settings.OSRM_TABLE_MARGIN_SECONDS
    results: list[RideCandidate] = []

    for ride, origin in rides_with_origins:
        estimate = durations.get(origin)
        earliest = max(0, (pickup_after - ride.departure_at).total_seconds())
        latest = min(settings.MATCH_MAX_PICKUP_DELAY_SECONDS, (pickup_before - ride.departure_at).total_seconds())
        if estimate is not None and not earliest - margin <= estimate <= latest + margin:
            continue
        try:
            candidate = await calculate_ride_candidate(
                ride, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, with_geometry=True
            )
        except Exception as exc:
            logger.warning("Error calculating detour for ride %d: %s", ride.id, exc)
            continue

        if candidate.rejection_reason(pickup_after, pickup_before) is None:
            results.append(candidate)

    # ── Step 4: Sort by detour distance ───────────────────────────────────
    results.sort(key=lambda r: r.detour_meters)
    return results


async def calculate_ride_candidate(
    ride: Ride,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    *,
    with_geometry: bool = False,
) -> RideCandidate:
    """Estimate boarding time and detour from the same route through the pickup point."""
    if ride.origin_point is None or ride.destination_point is None:
        raise IncompatibleCampusError("A carona precisa ter origem e destino para receber solicitações.")
    driver_origin = _point_coordinates(ride.origin_point)
    driver_dest = _point_coordinates(ride.destination_point)

    pickup = (pickup_lat, pickup_lng)
    dropoff = (dropoff_lat, dropoff_lng)
    validate_campus_match(driver_origin, driver_dest, pickup, dropoff)
    shared_origin = pickup == driver_origin
    shared_destination = dropoff == driver_dest
    if shared_origin and shared_destination:
        return RideCandidate(
            ride=ride,
            detour_meters=0.0,
            detour_seconds=0.0,
            estimated_pickup_at=ride.departure_at,
            estimated_dropoff_at=ride.departure_at + timedelta(seconds=ride.route_duration_seconds),
            detour_geojson=dict(mapping(to_shape(ride.route_line))) if with_geometry and ride.route_line else None,
        )

    waypoints = [driver_origin]
    if not shared_origin:
        waypoints.append(pickup)
    if not shared_destination:
        waypoints.append(dropoff)
    waypoints.append(driver_dest)
    detour_route = await get_route(waypoints, with_geometry=with_geometry)
    legs = detour_route.leg_durations_seconds

    # Detour = (route with passenger) - (original route)
    detour_meters = max(0.0, detour_route.distance_meters - ride.route_distance_meters)
    detour_seconds = max(0.0, detour_route.duration_seconds - ride.route_duration_seconds)

    return RideCandidate(
        ride=ride,
        detour_meters=detour_meters,
        detour_seconds=detour_seconds,
        estimated_pickup_at=ride.departure_at + timedelta(seconds=0 if shared_origin else legs[0]),
        estimated_dropoff_at=ride.departure_at + timedelta(seconds=sum(legs) if shared_destination else sum(legs[:-1])),
        detour_geojson=detour_route.geometry,
    )
