"""OSRM routing service.

Makes HTTP calls to a self-hosted OSRM instance.
Falls back to Haversine straight-line distance when OSRM is unreachable
(useful during development without a running OSRM container).
"""

import logging
import math
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RouteResult:
    distance_meters: float
    duration_seconds: float
    geometry: dict | None  # GeoJSON LineString or None


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
    total = sum(
        _haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
        for i in range(len(coords) - 1)
    )
    # Rough estimate: 30 km/h average urban speed
    duration = (total / 1000) / 30 * 3600
    return RouteResult(distance_meters=total, duration_seconds=duration, geometry=None)


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
            data = response.json()
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.warning("OSRM unreachable (%s), using Haversine fallback", exc)
        return _fallback_route(coords)
    except httpx.HTTPStatusError as exc:
        logger.error("OSRM returned error: %s", exc)
        return _fallback_route(coords)

    route = data["routes"][0]
    geometry = route.get("geometry") if with_geometry else None

    return RouteResult(
        distance_meters=route["distance"],
        duration_seconds=route["duration"],
        geometry=geometry,
    )
