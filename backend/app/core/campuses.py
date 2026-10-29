"""UFRGS campus coordinates and metadata - single source of truth."""

from typing import TypedDict


class CampusInfo(TypedDict):
    id: str
    name: str
    short_name: str
    lat: float
    lng: float


CAMPUS_LIST: list[CampusInfo] = [
    {"id": "campus_centro", "name": "Campus Centro", "short_name": "Centro", "lat": -30.033310, "lng": -51.221131}, # ok -30.033310, -51.221131
    {"id": "campus_saude", "name": "Campus Saúde", "short_name": "Saúde", "lat": -30.043243, "lng": -51.206096}, # ok -30.043243, -51.206096
    {"id": "campus_olimpico", "name": "Campus Olímpico (ESEFID)", "short_name": "Olímpico (ESEFID)", "lat": -30.051421, "lng": -51.182585}, # ok -30.051421, -51.182585
    {"id": "campus_vale", "name": "Campus do Vale", "short_name": "Vale", "lat": -30.075477, "lng": -51.124666}, # ok -30.075477, -51.124666
    {"id": "campus_agronomia", "name": "Campus Agronomia", "short_name": "Agronomia", "lat": -30.069883, "lng": -51.142024}, # ok -30.069883, -51.142024
    {"id": "campus_litoral_norte", "name": "Campus Litoral Norte", "short_name": "Litoral Norte", "lat": -29.971383, "lng": -50.226691}, # ok -29.971383, -50.226691
]

CAMPUS_COORDS: dict[str, tuple[float, float]] = {
    campus["id"]: (campus["lat"], campus["lng"]) for campus in CAMPUS_LIST
}

CAMPUS_BY_ID: dict[str, CampusInfo] = {campus["id"]: campus for campus in CAMPUS_LIST}
DEFAULT_CAMPUS_ID = "campus_centro"
DEFAULT_CAMPUS_COORDS = CAMPUS_BY_ID[DEFAULT_CAMPUS_ID]

