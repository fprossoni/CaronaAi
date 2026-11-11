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

# Keep each query within 100 locations, including the shared pickup destination.
TABLE_BATCH_SIZE = 99


class InvalidRouteError(ValueError):
    """The routing service could not calculate a route through the waypoints."""


@dataclass
class RouteResult:
    distance_meters: float
    duration_seconds: float
    geometry: dict | None  # GeoJSON LineString or None
    leg_durations_seconds: tuple[float, ...]


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in meters between two coordinates."""
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fallback_route(coords: list[tuple[float, float]]) -> RouteResult:
    """Haversine-based fallback when OSRM is unreachable."""
    distances = tuple(
        _haversine(*start, *end) for start, end in zip(coords, coords[1:])
    )
    # Rough estimate: 30 km/h average urban speed
    durations = tuple(distance / (30 / 3.6) for distance in distances)
    return RouteResult(
        distance_meters=sum(distances),
        duration_seconds=sum(durations),
        geometry=None,
        leg_durations_seconds=durations,
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
        return _fallback_route(coords)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            raise InvalidRouteError("OSRM rejected the route waypoints") from exc
        logger.error("OSRM returned error: %s", exc)
        return _fallback_route(coords)

    try:
        route = response.json()["routes"][0]
        durations = tuple(float(leg["duration"]) for leg in route["legs"])
        if len(durations) != len(coords) - 1 or any(not math.isfinite(d) or d < 0 for d in durations):
            raise ValueError("Invalid route leg durations")
        return RouteResult(
            distance_meters=route["distance"],
            duration_seconds=route["duration"],
            geometry=route.get("geometry") if with_geometry else None,
            leg_durations_seconds=durations,
        )
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise InvalidRouteError("OSRM did not return a valid route") from exc


async def get_pickup_durations(
    origins: list[tuple[float, float]], pickup: tuple[float, float]
) -> dict[tuple[float, float], float]:
    """Get Table durations from distinct origins to one pickup, omitting unknown estimates."""
    durations: dict[tuple[float, float], float] = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for batch in batched(dict.fromkeys(origins), TABLE_BATCH_SIZE):
            coords = ";".join(f"{lng},{lat}" for lat, lng in (*batch, pickup))
            url = f"{settings.OSRM_URL}/table/v1/driving/{coords}"
            try:
                response = await client.get(
                    url,
                    params={
                        "sources": ";".join(map(str, range(len(batch)))),
                        "destinations": str(len(batch)),
                        "annotations": "duration",
                    },
                )
                response.raise_for_status()
                rows = response.json()["durations"]
                if len(rows) != len(batch) or any(not isinstance(row, list) or len(row) != 1 for row in rows):
                    raise ValueError("Unexpected Table dimensions")
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                # Route will handle the remaining candidates if Table is unavailable.
                logger.warning("OSRM Table unavailable for pickup screening (%s)", type(exc).__name__)
                break

            for origin, (duration,) in zip(batch, rows, strict=True):
                if type(duration) in (int, float) and 0 <= duration < math.inf:
                    durations[origin] = duration
    return durations
