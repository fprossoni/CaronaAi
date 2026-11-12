"""OSRM routing service.

Makes HTTP calls to a self-hosted OSRM instance.
Falls back to Haversine straight-line distance when OSRM is unreachable
(useful during development without a running OSRM container).
"""

import logging
import math
from dataclasses import dataclass
from itertools import batched

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Reserve two locations for the passenger's pickup and dropoff.
TABLE_BATCH_SIZE = 98
Point = tuple[float, float]


@dataclass(frozen=True)
class TravelLeg:
    distance_meters: float
    duration_seconds: float


class InvalidRouteError(ValueError):
    """The routing service could not calculate a route through the waypoints."""


@dataclass
class RouteResult:
    distance_meters: float
    duration_seconds: float
    geometry: dict | None  # GeoJSON LineString or None
    leg_durations_seconds: tuple[float, ...]
    leg_distances_meters: tuple[float, ...] = ()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in meters between two coordinates."""
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_straight_line_leg(origin: Point, destination: Point) -> TravelLeg:
    distance = _haversine(*origin, *destination)
    # Rough estimate: 30 km/h average urban speed.
    return TravelLeg(distance, distance / (30 / 3.6))


def estimate_straight_line_route(coords: list[Point]) -> RouteResult:
    """Haversine-based fallback when OSRM is unreachable."""
    legs = [estimate_straight_line_leg(start, end) for start, end in zip(coords, coords[1:])]
    durations = tuple(leg.duration_seconds for leg in legs)
    return RouteResult(
        distance_meters=sum(leg.distance_meters for leg in legs),
        duration_seconds=sum(durations),
        geometry=None,
        leg_durations_seconds=durations,
        leg_distances_meters=tuple(leg.distance_meters for leg in legs),
    )


async def get_route(coords: list[tuple[float, float]], with_geometry: bool = False) -> RouteResult:
    """
    Get a route from OSRM for a list of (lat, lng) waypoints.
    
    Args:
        coords: List of (lat, lng) tuples — at least 2.
        with_geometry: If True, request full GeoJSON geometry.
    
    Returns:
        RouteResult with distance, duration, and optionally GeoJSON geometry.
    """
    # OSRM expects coordinates as lng,lat (reversed from the GIS convention)
    coord_str = ";".join(f"{lng},{lat}" for lat, lng in coords)
    url = f"{settings.OSRM_URL}/route/v1/driving/{coord_str}"

    params = {
        "overview": "full" if with_geometry else "false",
        "geometries": "geojson",
        "steps": "false",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
    except httpx.RequestError as exc:
        logger.warning("OSRM unreachable (%s), using Haversine fallback", exc)
        return estimate_straight_line_route(coords)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            raise InvalidRouteError("OSRM rejected the route waypoints") from exc
        logger.error("OSRM returned error: %s", exc)
        return estimate_straight_line_route(coords)

    try:
        route = response.json()["routes"][0]
        durations = tuple(float(leg["duration"]) for leg in route["legs"])
        distances = tuple(float(leg["distance"]) for leg in route["legs"])
        if len(durations) != len(coords) - 1 or any(not math.isfinite(d) or d < 0 for d in (*durations, *distances)):
            raise ValueError("Invalid route legs")
        return RouteResult(
            distance_meters=route["distance"],
            duration_seconds=route["duration"],
            geometry=route.get("geometry") if with_geometry else None,
            leg_durations_seconds=durations,
            leg_distances_meters=distances,
        )
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise InvalidRouteError("OSRM did not return a valid route") from exc


async def _read_table(
    client: httpx.AsyncClient, sources: tuple[Point, ...], destinations: tuple[Point, ...],
) -> dict[tuple[Point, Point], TravelLeg | None]:
    sources = tuple(dict.fromkeys(sources))
    destinations = tuple(dict.fromkeys(destinations))
    points = dict.fromkeys((*sources, *destinations))
    indices = {point: str(index) for index, point in enumerate(points)}
    coords = ";".join(f"{lng},{lat}" for lat, lng in points)
    response = await client.get(
        f"{settings.OSRM_URL}/table/v1/driving/{coords}",
        params={
            "sources": ";".join(indices[point] for point in sources),
            "destinations": ";".join(indices[point] for point in destinations),
            "annotations": "duration,distance",
        },
    )
    response.raise_for_status()
    data = response.json()
    legs = {}
    for origin, durations, distances in zip(sources, data["durations"], data["distances"], strict=True):
        for destination, duration, distance in zip(destinations, durations, distances, strict=True):
            if origin == destination:
                continue
            if duration is None or distance is None:
                legs[origin, destination] = None  # A valid Table response marked the leg as unreachable.
            elif all(type(value) in (int, float) and 0 <= value < math.inf for value in (duration, distance)):
                legs[origin, destination] = TravelLeg(distance, duration)
            else:
                raise ValueError("Invalid Table distance or duration")
    return legs


async def get_detour_legs(
    pickup: Point, dropoff: Point, origins: list[Point], destinations: list[Point],
) -> dict[tuple[Point, Point], TravelLeg | None]:
    """Estimate each ride's direct and amended legs in narrow, directional matrices."""
    legs: dict[tuple[Point, Point], TravelLeg | None] = {}
    if not (origins or destinations):
        return legs

    inbound = (point for point in dict.fromkeys(origins) if point != pickup)
    outbound = (point for point in dict.fromkeys(destinations) if point != dropoff)
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            for batch in batched(inbound, TABLE_BATCH_SIZE):
                legs.update(await _read_table(client, (*batch, pickup), (pickup, dropoff)))
            for batch in batched(outbound, TABLE_BATCH_SIZE):
                legs.update(await _read_table(client, (pickup, dropoff), (*batch, dropoff)))
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning("OSRM Table unavailable for remaining detour estimates (%s)", type(exc).__name__)
    return legs
