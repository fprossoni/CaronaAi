"""Ride matching service — Detour Distance algorithm.

Algorithm:
  1. Pre-filter rides with PostGIS ST_DWithin (fast, uses GiST index)
  2. For each candidate ride, calculate detour via OSRM
  3. Filter by max detour thresholds
  4. Sort by detour distance ASC
"""

import logging
from dataclasses import dataclass

from geoalchemy2.functions import ST_DWithin, ST_GeomFromText, ST_SetSRID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.rating import Block
from app.models.ride import Ride, RideStatus
from app.services.osrm import RouteResult, get_route

logger = logging.getLogger(__name__)


@dataclass
class RideCandidate:
    ride: Ride
    detour_meters: float
    detour_seconds: float


async def find_matching_rides(
    db: Session,
    passenger_id: int,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float | None,
    dropoff_lng: float | None,
    women_only: bool = False,
    departure_after=None,
) -> list[RideCandidate]:
    """
    Returns a list of RideCandidate ordered by detour_meters ASC.
    
    Privacy note: exact passenger coordinates are only used server-side
    for the matching computation — they are never stored until a match
    is explicitly created.
    """
    # ── Step 1: PostGIS pre-filter ─────────────────────────────────────────
    # Build a WKT POINT for the passenger's pickup location
    passenger_point = ST_SetSRID(
        ST_GeomFromText(f"POINT({pickup_lng} {pickup_lat})"),
        4326,
    )

    # Get IDs of users who blocked the passenger or were blocked by them
    blocked_subq = select(Block.blocked_id).where(Block.blocker_id == passenger_id)
    blocker_subq = select(Block.blocker_id).where(Block.blocked_id == passenger_id)

    query = (
        select(Ride)
        .where(Ride.status == RideStatus.ACTIVE)
        .where(Ride.available_seats > 0)
        .where(Ride.driver_id != passenger_id)
        .where(Ride.driver_id.notin_(blocked_subq))
        .where(Ride.driver_id.notin_(blocker_subq))
        # PostGIS spatial pre-filter: passenger within buffer of route
        .where(
            ST_DWithin(
                Ride.route_line,
                passenger_point,
                settings.OSRM_PREFILER_BUFFER_METERS,
                use_spheroid=False,  # Fast planar distance for pre-filter
            )
        )
    )

    if women_only:
        query = query.where(Ride.women_only == True)

    if departure_after:
        query = query.where(Ride.departure_at >= departure_after)

    candidate_rides = db.execute(query).scalars().all()
    logger.debug("PostGIS pre-filter: %d candidate rides", len(candidate_rides))

    # ── Step 2: Detour calculation via OSRM ───────────────────────────────
    results: list[RideCandidate] = []

    for ride in candidate_rides:
        try:
            detour = await _calculate_detour(ride, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        except Exception as exc:
            logger.warning("Error calculating detour for ride %d: %s", ride.id, exc)
            continue

        # ── Step 3: Filter by max thresholds ──────────────────────────────
        if detour.distance_meters > settings.OSRM_MAX_DETOUR_METERS:
            continue
        if detour.duration_seconds > settings.OSRM_MAX_DETOUR_SECONDS:
            continue

        results.append(RideCandidate(
            ride=ride,
            detour_meters=detour.distance_meters,
            detour_seconds=detour.duration_seconds,
        ))

    # ── Step 4: Sort by detour distance ───────────────────────────────────
    results.sort(key=lambda r: r.detour_meters)
    return results


async def _calculate_detour(
    ride: Ride,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float | None,
    dropoff_lng: float | None,
) -> RouteResult:
    """Calculate the added detour if driver picks up this passenger."""
    from geoalchemy2.shape import to_shape

    # Extract driver origin and destination from PostGIS geometry
    origin_shape = to_shape(ride.origin_point)
    dest_shape = to_shape(ride.destination_point)

    driver_origin = (origin_shape.y, origin_shape.x)   # (lat, lng)
    driver_dest = (dest_shape.y, dest_shape.x)

    # Build waypoints: driver_origin → passenger_pickup → [dropoff] → driver_dest
    waypoints = [driver_origin, (pickup_lat, pickup_lng)]
    if dropoff_lat and dropoff_lng:
        waypoints.append((dropoff_lat, dropoff_lng))
    waypoints.append(driver_dest)

    detour_route = await get_route(waypoints)

    # Detour = (route with passenger) - (original route)
    detour_meters = max(0.0, detour_route.distance_meters - ride.route_distance_meters)
    detour_seconds = max(0.0, detour_route.duration_seconds - ride.route_duration_seconds)

    return RouteResult(
        distance_meters=detour_meters,
        duration_seconds=detour_seconds,
        geometry=None,
    )
