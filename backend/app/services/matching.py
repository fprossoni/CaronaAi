"""Ride matching service — Detour Distance algorithm.

Algorithm:
  1. Match campus endpoints and check proximity for the remaining address
  2. Estimate the direct and amended trips with directional OSRM Table batches
  3. Filter by pickup time and detour thresholds, then sort by estimated detour distance
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from geoalchemy2 import Geography, WKBElement, WKTElement
from geoalchemy2.functions import ST_DWithin, ST_GeomFromText, ST_SetSRID
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, mapping, shape
from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.campuses import CAMPUS_COORDS, campus_at
from app.core.config import settings
from app.models.match import Match, MatchStatus
from app.models.rating import Block
from app.models.ride import Ride, RideStatus
from app.models.user import Gender
from app.services.osrm import (
    InvalidRouteError, Point, RouteResult, TravelLeg, estimate_straight_line_leg,
    estimate_straight_line_route, get_detour_legs, get_route,
)

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
    plan: RoutePlan | None = None

    def rejection_reason(
        self, pickup_after: datetime, pickup_before: datetime, *, max_detour_meters: int | None = None,
    ) -> str | None:
        if not pickup_after <= self.estimated_pickup_at <= pickup_before:
            return "O horário previsto de chegada à origem está fora do intervalo informado."
        pickup_delay = (self.estimated_pickup_at - self.ride.departure_at).total_seconds()
        if not 0 <= pickup_delay <= settings.MATCH_MAX_PICKUP_DELAY_SECONDS:
            return "A chegada à origem está fora do tempo máximo após a saída do motorista."
        if max_detour_meters is None:
            max_detour_meters = settings.OSRM_MAX_DETOUR_METERS
        if (
            self.detour_meters > max_detour_meters
            or self.detour_seconds > settings.OSRM_MAX_DETOUR_SECONDS
        ):
            return "O ponto informado exige um desvio maior que o permitido."
        return None


def _point_coordinates(point: WKBElement | WKTElement) -> tuple[float, float]:
    shape = to_shape(point)
    return shape.y, shape.x


@dataclass
class RoutePlan:
    points: list[Point]
    route: RouteResult

    def arrival(self, ride: Ride, point: Point) -> datetime:
        index = self.points.index(point)
        return ride.departure_at + timedelta(seconds=sum(self.route.leg_durations_seconds[:index]))


def _base_plan(ride: Ride) -> RoutePlan:
    return RoutePlan(
        [_point_coordinates(ride.origin_point), _point_coordinates(ride.destination_point)],
        RouteResult(ride.route_distance_meters, ride.route_duration_seconds, None,
                    (ride.route_duration_seconds,), (ride.route_distance_meters,)),
    )


def _saved_plan(ride: Ride) -> RoutePlan:
    if not ride.planned_route:
        return _base_plan(ride)
    data = ride.planned_route
    geometry = dict(mapping(to_shape(ride.planned_route_line))) if data["routed"] else None
    return RoutePlan(
        [tuple(point) for point in data["points"]],
        RouteResult(data["distance"], data["duration"], geometry, tuple(data["leg_durations"]), tuple(data["leg_distances"])),
    )


def _insertion_index(points: list[Point], stop: Point) -> int:
    def added_distance(index: int) -> float:
        before, after = points[index - 1], points[index]
        return (estimate_straight_line_leg(before, stop).distance_meters
                + estimate_straight_line_leg(stop, after).distance_meters
                - estimate_straight_line_leg(before, after).distance_meters)

    return min(range(1, len(points)), key=added_distance)


def _insert_stop(points: list[Point], stop: Point) -> None:
    if stop not in points:
        points.insert(_insertion_index(points, stop), stop)


def confirmed_matches(db: Session, ride: Ride) -> list[Match]:
    return list(db.scalars(select(Match).where(
        Match.ride_id == ride.id, Match.status == MatchStatus.ACCEPTED,
    ).order_by(Match.responded_at, Match.id)))


def _required_stops(matches: list[Match]) -> list[Point]:
    return [_point_coordinates(point) for match in matches
            for point in (match.pickup_point, match.dropoff_point) if point is not None]


async def _route_plan(ride: Ride, points: list[Point], *, with_geometry: bool = True) -> RoutePlan:
    if len(points) == 2:
        return _base_plan(ride)
    return RoutePlan(points, await get_route(points, with_geometry=with_geometry))


def save_route_plan(ride: Ride, plan: RoutePlan) -> None:
    if len(plan.points) == 2:
        ride.planned_route_line = None
        ride.planned_route = None
        return
    route = plan.route
    geometry = shape(route.geometry) if route.geometry else LineString([(lng, lat) for lat, lng in plan.points])
    ride.planned_route_line = from_shape(geometry, srid=4326)
    ride.planned_route = {
        "points": plan.points,
        "distance": route.distance_meters,
        "duration": route.duration_seconds,
        "leg_durations": route.leg_durations_seconds,
        "leg_distances": route.leg_distances_meters,
        "routed": route.geometry is not None,
    }


async def remove_cancelled_stop(ride: Ride, remaining: list[Match]) -> None:
    if not ride.planned_route:
        return
    stops = set(_required_stops(remaining))
    plan = _saved_plan(ride)
    points = [plan.points[0], *(point for point in plan.points[1:-1] if point in stops), plan.points[-1]]
    if points != plan.points:
        try:
            updated = await _route_plan(ride, points)
        except InvalidRouteError:
            updated = RoutePlan(points, estimate_straight_line_route(points))
        save_route_plan(ride, updated)


def _unchanged_candidate(ride: Ride, with_geometry: bool) -> RideCandidate:
    return RideCandidate(
        ride=ride,
        detour_meters=0.0,
        detour_seconds=0.0,
        estimated_pickup_at=ride.departure_at,
        estimated_dropoff_at=ride.departure_at + timedelta(seconds=ride.route_duration_seconds),
        detour_geojson=dict(mapping(to_shape(ride.route_line))) if with_geometry and ride.route_line else None,
    )


def _estimate_candidate(
    ride: Ride, origin: Point, destination: Point, pickup: Point, dropoff: Point,
    table: dict[tuple[Point, Point], TravelLeg | None],
) -> RideCandidate | None:
    if origin == pickup and destination == dropoff:
        return _unchanged_candidate(ride, with_geometry=True)

    pairs = ((origin, pickup), (pickup, dropoff), (dropoff, destination), (origin, destination))
    if any(pair in table and table[pair] is None for pair in pairs):
        return None

    zero = TravelLeg(0, 0)
    legs = [zero if start == end else table.get((start, end)) for start, end in pairs]
    if any(leg is None for leg in legs):
        # Compare consistent estimates when a Table batch was unavailable.
        legs = [estimate_straight_line_leg(start, end) for start, end in pairs]
    to_pickup, passenger_leg, to_destination, direct = legs
    amended_distance = to_pickup.distance_meters + passenger_leg.distance_meters + to_destination.distance_meters
    amended_duration = to_pickup.duration_seconds + passenger_leg.duration_seconds + to_destination.duration_seconds
    return RideCandidate(
        ride=ride,
        detour_meters=max(0.0, amended_distance - direct.distance_meters),
        detour_seconds=max(0.0, amended_duration - direct.duration_seconds),
        estimated_pickup_at=ride.departure_at + timedelta(seconds=to_pickup.duration_seconds),
        estimated_dropoff_at=ride.departure_at + timedelta(seconds=to_pickup.duration_seconds + passenger_leg.duration_seconds),
    )


def _candidate_from_plan(
    ride: Ride, plan: RoutePlan, pickup: Point, dropoff: Point, *, current: RoutePlan,
) -> RideCandidate:
    return RideCandidate(
        ride=ride,
        detour_meters=max(0.0, plan.route.distance_meters - current.route.distance_meters),
        detour_seconds=max(0.0, plan.route.duration_seconds - current.route.duration_seconds),
        estimated_pickup_at=plan.arrival(ride, pickup),
        estimated_dropoff_at=plan.arrival(ride, dropoff),
        plan=plan,
    )


def _estimate_insertion(ride: Ride, plan: RoutePlan, pickup: Point, dropoff: Point, table) -> RideCandidate | None:
    stop = pickup if pickup not in plan.points else dropoff
    if stop in plan.points:
        return _candidate_from_plan(ride, plan, pickup, dropoff, current=plan)
    index = _insertion_index(plan.points, stop)
    before, after = plan.points[index - 1], plan.points[index]
    pairs = ((before, stop), (stop, after))
    if any(pair in table and table[pair] is None for pair in pairs):
        return None
    first, second = [table.get(pair) for pair in pairs]
    if first is None or second is None:
        first, second = [estimate_straight_line_leg(*pair) for pair in pairs]
        direct = estimate_straight_line_leg(before, after)
    else:
        direct = TravelLeg(plan.route.leg_distances_meters[index - 1], plan.route.leg_durations_seconds[index - 1])

    extra_seconds = max(0.0, first.duration_seconds + second.duration_seconds - direct.duration_seconds)
    extra_distance = max(0.0, first.distance_meters + second.distance_meters - direct.distance_meters)
    durations = plan.route.leg_durations_seconds
    # Preserve the estimated total of the replaced leg plus the additional time.
    split_duration = durations[index - 1] + extra_seconds
    first_seconds = min(split_duration, first.duration_seconds)
    estimated = RoutePlan(
        [*plan.points[:index], stop, *plan.points[index:]],
        RouteResult(plan.route.distance_meters + extra_distance, plan.route.duration_seconds + extra_seconds, None,
                    (*durations[:index - 1], first_seconds, split_duration - first_seconds, *durations[index:])),
    )
    return _candidate_from_plan(ride, estimated, pickup, dropoff, current=plan)


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

    line = func.coalesce(Ride.planned_route_line, Ride.route_line, func.ST_MakeLine(Ride.origin_point, Ride.destination_point))

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

    trips: list[tuple[Ride, Point, Point]] = []
    planned_trips: list[tuple[Ride, RoutePlan, Point]] = []
    neighbors: dict[Point, tuple[list[Point], list[Point]]] = {}
    for ride in candidate_rides:
        if ride.origin_point is None or ride.destination_point is None:
            continue
        try:
            if ride.planned_route:
                plan = _saved_plan(ride)
                stop = pickup if pickup not in plan.points else dropoff
                planned_trips.append((ride, plan, stop))
                if stop not in plan.points:
                    index = _insertion_index(plan.points, stop)
                    before, after = neighbors.setdefault(stop, ([], []))
                    before.append(plan.points[index - 1])
                    after.append(plan.points[index])
                continue
            trips.append((ride, _point_coordinates(ride.origin_point), _point_coordinates(ride.destination_point)))
        except Exception as exc:
            logger.warning("Invalid points for ride %d (%s)", ride.id, type(exc).__name__)

    # Each compatible ride shares at least one campus endpoint, so at most one
    # driver endpoint varies. Identical trips do not need any Table requests.
    table = await get_detour_legs(
        pickup, dropoff,
        [origin for _, origin, _ in trips if origin != pickup],
        [destination for _, _, destination in trips if destination != dropoff],
    )
    stop_tables = {stop: await get_detour_legs(stop, stop, before, after) for stop, (before, after) in neighbors.items()}
    candidates = [_estimate_candidate(ride, origin, destination, pickup, dropoff, table)
                  for ride, origin, destination in trips]
    candidates.extend(_estimate_insertion(ride, plan, pickup, dropoff, stop_tables.get(stop, {}))
                      for ride, plan, stop in planned_trips)
    results = [candidate for candidate in candidates if candidate and candidate.rejection_reason(
        pickup_after, pickup_before, max_detour_meters=settings.OSRM_TABLE_MAX_DETOUR_METERS,
    ) is None]

    results.sort(key=lambda r: (r.detour_meters, r.detour_seconds, r.estimated_pickup_at, r.ride.id))
    return results


async def calculate_ride_candidate(
    ride: Ride,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    *,
    confirmed: list[Match],
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
    current = _saved_plan(ride)
    points = current.points.copy()
    for stop in _required_stops(confirmed):
        _insert_stop(points, stop)
    if points != current.points or (ride.planned_route and not ride.planned_route["routed"]):
        current = await _route_plan(ride, points)

    points = current.points.copy()
    for stop in (pickup, dropoff):
        _insert_stop(points, stop)
    if points == current.points and (not with_geometry or len(points) == 2 or current.route.geometry is not None):
        plan = current
    else:
        plan = await _route_plan(ride, points, with_geometry=with_geometry)
    return _candidate_from_plan(ride, plan, pickup, dropoff, current=current)
