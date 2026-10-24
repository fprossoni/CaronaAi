"""Geocoding service using OpenStreetMap Nominatim and ViaCEP.

Allows looking up Brazilian postal codes (CEP) to autofill street and neighborhood,
and resolves physical addresses into geographic coordinates (lat, lng) without
requiring the user to provide raw coordinates.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
VIACEP_URL = "https://viacep.com.br/ws/{cep}/json/"
USER_AGENT = "CaronaAi-UFRGS/1.0 (academic carpooling platform; caronaai@ufrgs.br)"

# In-memory simple cache for geocoded queries
_GEOCODE_CACHE: dict[str, tuple[float, float, str | None, str]] = {}


def clean_cep(cep: str) -> str:
    return re.sub(r"\D", "", cep or "")


async def lookup_cep(cep: str) -> dict[str, str] | None:
    """Queries ViaCEP to return street, neighborhood, city and state for a CEP."""
    digits = clean_cep(cep)
    if len(digits) != 8:
        return None

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(VIACEP_URL.format(cep=digits))
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("erro"):
                return None

            return {
                "postal_code": f"{digits[:5]}-{digits[5:]}",
                "street": data.get("logradouro") or "",
                "neighborhood": data.get("bairro") or "",
                "city": data.get("localidade") or "Porto Alegre",
                "state": data.get("uf") or "RS",
                "country": "Brasil",
            }
    except Exception as exc:
        logger.warning("ViaCEP lookup error for %s: %s", digits, exc)
        return None


async def geocode_address(
    street: str,
    number: str,
    city: str = "Porto Alegre",
    state: str = "RS",
    country: str = "Brasil",
    postal_code: str | None = None,
) -> tuple[float, float, str | None, str]:
    """Geocodes an address via OpenStreetMap Nominatim.

    Returns:
        (latitude, longitude, neighborhood, display_name)
    Raises:
        ValueError if coordinates could not be resolved.
    """
    clean_street = street.strip()
    clean_num = number.strip()
    cache_key = f"{clean_street.lower()}|{clean_num}|{city.lower()}|{state.lower()}|{clean_cep(postal_code or '')}"

    if cache_key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[cache_key]

    headers = {"User-Agent": USER_AGENT}

    # Query variations in descending order of specificity
    queries = [
        f"{clean_street}, {clean_num}, {city}, {state}, {country}",
        f"{clean_street}, {city}, {state}, {country}",
    ]
    if postal_code:
        digits = clean_cep(postal_code)
        if len(digits) == 8:
            queries.insert(1, f"{clean_street}, {clean_num}, {digits}, {city}, {state}, {country}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        for q in queries:
            try:
                params = {
                    "q": q,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                }
                resp = await client.get(NOMINATIM_URL, params=params, headers=headers)
                if resp.status_code == 200:
                    results: list[dict[str, Any]] = resp.json()
                    if results:
                        best = results[0]
                        lat = float(best["lat"])
                        lng = float(best["lon"])
                        addr = best.get("address", {})
                        neighborhood = (
                            addr.get("neighbourhood")
                            or addr.get("suburb")
                            or addr.get("city_district")
                            or addr.get("quarter")
                        )
                        display_name = best.get("display_name", q)
                        out = (lat, lng, neighborhood, display_name)
                        _GEOCODE_CACHE[cache_key] = out
                        return out
            except Exception as exc:
                logger.warning("Nominatim geocoding error for query '%s': %s", q, exc)

    raise ValueError(f"Não foi possível localizar as coordenadas para o endereço: {clean_street}, {clean_num} - {city}/{state}")
