"""UFRGS campus coordinates and metadata - single source of truth."""

from typing import TypedDict


class CampusInfo(TypedDict):
    id: str
    name: str
    short_name: str
    lat: float
    lng: float


CAMPUS_LIST: list[CampusInfo] = [
    {"id": "campus_centro", "name": "Campus Centro", "short_name": "Centro", "lat": -30.0349, "lng": -51.2177},
    {"id": "campus_saude", "name": "Campus Saúde", "short_name": "Saúde", "lat": -30.0395, "lng": -51.2089},
    {"id": "campus_olimpico", "name": "Campus Olímpico (ESEFID)", "short_name": "Olímpico (ESEFID)", "lat": -30.0538, "lng": -51.1789},
    {"id": "campus_vale", "name": "Campus do Vale", "short_name": "Vale", "lat": -30.0734, "lng": -51.1201},
    {"id": "campus_agronomia", "name": "Campus Agronomia", "short_name": "Agronomia", "lat": -30.0664, "lng": -51.1378},
    {"id": "campus_litoral_norte", "name": "Campus Litoral Norte", "short_name": "Litoral Norte", "lat": -29.9794, "lng": -50.1330},
]

CAMPUS_COORDS: dict[str, tuple[float, float]] = {
    campus["id"]: (campus["lat"], campus["lng"]) for campus in CAMPUS_LIST
}

CAMPUS_BY_ID: dict[str, CampusInfo] = {campus["id"]: campus for campus in CAMPUS_LIST}
DEFAULT_CAMPUS_ID = "campus_centro"
DEFAULT_CAMPUS_COORDS = CAMPUS_BY_ID[DEFAULT_CAMPUS_ID]

