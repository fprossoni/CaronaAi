"""Ride matching service — Detour Distance algorithm.

Algorithm:
  1. Pre-filter rides by proximity of both trip points to the driver’s route
  2. Screen candidate pickup times in batches via OSRM Table
  3. Confirm each remaining candidate via OSRM Route
  4. Filter by estimated pickup time and max detour thresholds, then sort by detour distance
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from geoalchemy2 import Geography, WKBElement, WKTElement
from geoalchemy2.functions import ST_DWithin, ST_GeomFromText, ST_SetSRID
from geoalchemy2.shape import to_shape
from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.rating import Block
from app.models.ride import Ride, RideStatus
from app.models.user import Gender
from app.services.osrm import get_pickup_durations, get_route

logger = logging.getLogger(__name__)


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

    pickup = ST_SetSRID(ST_GeomFromText(f"POINT({pickup_lng} {pickup_lat})"), 4326)
    dropoff = ST_SetSRID(ST_GeomFromText(f"POINT({dropoff_lng} {dropoff_lat})"), 4326)
    buffer = settings.OSRM_PREFILER_BUFFER_METERS

    def near_both(line):
        return and_(
            ST_DWithin(line, cast(pickup, Geography), buffer, False),
            ST_DWithin(line, cast(dropoff, Geography), buffer, False),
        )

    blocked_subq = select(Block.blocked_id).where(Block.blocker_id == passenger_id)
    blocker_subq = select(Block.blocker_id).where(Block.blocked_id == passenger_id)

    query = (
        select(Ride)
        .where(Ride.status == RideStatus.ACTIVE)
        .where(Ride.available_seats > 0)
        .where(Ride.driver_id != passenger_id)
        .where(
            Ride.departure_at > datetime.now(UTC),
            Ride.departure_at >= pickup_after - timedelta(seconds=settings.MATCH_MAX_PICKUP_DELAY_SECONDS),
            Ride.departure_at <= pickup_before,
        )
        .where(Ride.driver_id.notin_(blocked_subq))
        .where(Ride.driver_id.notin_(blocker_subq))
        .where(
            or_(
                near_both(Ride.route_line),
                and_(
                    Ride.route_line.is_(None),
                    near_both(func.ST_MakeLine(Ride.origin_point, Ride.destination_point)),
                ),
            )
        )
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
    if len(rides_with_origins) > 1:
        durations = await get_pickup_durations([origin for _, origin in rides_with_origins], (pickup_lat, pickup_lng))
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
    dropoff_lat: float | None,
    dropoff_lng: float | None,
    *,
    with_geometry: bool = False,
) -> RideCandidate:
    """Estimate boarding time and detour from the same route through the pickup point."""
    # Extract driver origin and destination from PostGIS geometry
    driver_origin = _point_coordinates(ride.origin_point)
    driver_dest = _point_coordinates(ride.destination_point)

    # Build waypoints: driver_origin → passenger_pickup → [dropoff] → driver_dest
    waypoints = [driver_origin, (pickup_lat, pickup_lng)]
    has_dropoff = dropoff_lat is not None and dropoff_lng is not None
    if has_dropoff:
        waypoints.append((dropoff_lat, dropoff_lng))
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
        estimated_pickup_at=ride.departure_at + timedelta(seconds=legs[0]),
        estimated_dropoff_at=ride.departure_at + timedelta(seconds=sum(legs[:2])) if has_dropoff else None,
        detour_geojson=detour_route.geometry,
    )
