/**
 * Geocoding & Route Preview Service Layer
 *
 * Architectural Note:
 * Designed with the Adapter/Provider pattern so that location resolution
 * (address autocomplete, reverse geocoding, neighborhood extraction for privacy,
 * and route geometry preview) is completely decoupled from UI components.
 *
 * Current implementation uses:
 * 1. Official UFRGS Campus catalog (instant zero-latency matches)
 * 2. OpenStreetMap Nominatim API (free, no API key required)
 * 3. Public OSRM / Haversine fallback for client-side route previews
 */

import { UFRGS_CAMPUS } from "@/types/ride";

export interface LocationValue {
  label: string;
  region: string;
  lat: number;
  lng: number;
  campusId?: string;
  addressId?: number;
}

export interface GeocodingSuggestion extends LocationValue {
  id: string;
  subtitle: string;
  isCampus?: boolean;
}

export interface RoutePreviewResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJSON.LineString;
}

export interface GeocodingProvider {
  searchAddress(query: string): Promise<GeocodingSuggestion[]>;
  reverseGeocode(lat: number, lng: number): Promise<LocationValue>;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  pedestrian?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
}

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

/**
 * Extracts a concise street label and an anonymized neighborhood/region
 * from Nominatim address components.
 *
 * Why `region` matters:
 * Per the Carona Aí specification, the driver only sees `pickup_region`
 * (e.g. "Bom Fim, Porto Alegre") before accepting a match, keeping the
 * passenger's exact street and house number confidential until confirmed.
 */
function parseNominatimAddress(item: NominatimItem, fallbackLat: number, fallbackLng: number): LocationValue {
  const addr = item.address;
  const lat = parseFloat(item.lat) || fallbackLat;
  const lng = parseFloat(item.lon) || fallbackLng;

  const city = addr?.city || addr?.town || addr?.municipality || "Porto Alegre";
  const neighborhood =
    addr?.suburb ||
    addr?.neighbourhood ||
    addr?.quarter ||
    addr?.city_district ||
    "Região Central";

  const region = `${neighborhood}, ${city}`;

  let streetPart = item.name || addr?.road || addr?.pedestrian || "";
  if (addr?.road && addr?.house_number) {
    streetPart = `${addr.road}, ${addr.house_number}`;
  } else if (addr?.road && !streetPart) {
    streetPart = addr.road;
  }

  const label = streetPart
    ? `${streetPart} — ${neighborhood}`
    : item.display_name.split(",").slice(0, 3).join(",").trim();

  return {
    label: label || `Ponto no mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    region,
    lat,
    lng,
  };
}

class OpenStreetMapGeocodingProvider implements GeocodingProvider {
  // Bounding box prioritizing Rio Grande do Sul / Greater Porto Alegre + Litoral Norte
  private readonly viewbox = "-51.35,-30.25,-50.05,-29.75";

  async searchAddress(query: string): Promise<GeocodingSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const normalizedQuery = trimmed
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // 1. Instant local matches against official UFRGS Campuses
    const campusMatches: GeocodingSuggestion[] = UFRGS_CAMPUS.filter((c) => {
      const target = `${c.name} ${c.shortName} ufrgs`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return target.includes(normalizedQuery);
    }).map((c) => ({
      id: `campus-${c.id}`,
      label: `UFRGS — ${c.name}`,
      subtitle: "Campus Oficial da UFRGS",
      region: c.name,
      lat: c.lat,
      lng: c.lng,
      campusId: c.id,
      isCampus: true,
    }));

    // 2. Remote search via OpenStreetMap Nominatim
    try {
      const searchQuery =
        normalizedQuery.includes("porto alegre") ||
        normalizedQuery.includes("tramandai") ||
        normalizedQuery.includes("canoas") ||
        normalizedQuery.includes("viamao")
          ? trimmed
          : `${trimmed}, Porto Alegre, RS`;

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "br");
      url.searchParams.set("viewbox", this.viewbox);
      url.searchParams.set("q", searchQuery);

      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "pt-BR" },
      });

      if (!res.ok) return campusMatches;
      const items = (await res.json()) as NominatimItem[];

      const osmSuggestions: GeocodingSuggestion[] = items.map((item) => {
        const parsed = parseNominatimAddress(item, 0, 0);
        return {
          id: `osm-${item.place_id}`,
          label: parsed.label,
          subtitle: parsed.region,
          region: parsed.region,
          lat: parsed.lat,
          lng: parsed.lng,
        };
      });

      return [...campusMatches, ...osmSuggestions];
    } catch {
      return campusMatches;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationValue> {
    // Check if coordinates match one of the UFRGS campuses
    const matchedCampus = UFRGS_CAMPUS.find(
      (c) => Math.abs(c.lat - lat) < 0.002 && Math.abs(c.lng - lng) < 0.002
    );
    if (matchedCampus) {
      return {
        label: `UFRGS — ${matchedCampus.name}`,
        region: matchedCampus.name,
        lat: matchedCampus.lat,
        lng: matchedCampus.lng,
        campusId: matchedCampus.id,
      };
    }

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));

      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "pt-BR" },
      });
      if (!res.ok) throw new Error("Reverse geocoding failed");
      const item = (await res.json()) as NominatimItem;
      return parseNominatimAddress(item, lat, lng);
    } catch {
      return {
        label: `Local selecionado (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        region: "Porto Alegre, RS",
        lat,
        lng,
      };
    }
  }
}

export const geocodingService: GeocodingProvider = new OpenStreetMapGeocodingProvider();

/**
 * Helper to convert a UFRGS campus entry directly into a `LocationValue`.
 */
export function campusToLocation(campusId: string): LocationValue | null {
  const campus = UFRGS_CAMPUS.find((c) => c.id === campusId);
  if (!campus) return null;
  return {
    label: `UFRGS — ${campus.name}`,
    region: campus.name,
    lat: campus.lat,
    lng: campus.lng,
    campusId: campus.id,
  };
}

/**
 * Retrieves the user's current GPS position via the browser Geolocation API
 * and resolves its human-readable address and neighborhood region.
 */
export async function getBrowserCurrentLocation(): Promise<LocationValue> {
  if (!("geolocation" in navigator)) {
    throw new Error("Geolocalização não é suportada pelo seu navegador.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
    });
  });

  const { latitude, longitude } = position.coords;
  return geocodingService.reverseGeocode(latitude, longitude);
}

/**
 * Computes a route preview between two points for map visualization.
 * Attempts OSRM public demo routing first and falls back to Haversine straight-line
 * calculation (matching the backend fallback logic in `backend/app/services/osrm.py`).
 */
export async function fetchRoutePreview(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoint?: { lat: number; lng: number }
): Promise<RoutePreviewResult> {
  const points = waypoint ? [origin, waypoint, destination] : [origin, destination];
  const coordsParam = points.map((p) => `${p.lng},${p.lat}`).join(";");

  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`
    );
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      if (route && route.geometry) {
        return {
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          geometry: route.geometry as GeoJSON.LineString,
        };
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback: Haversine distance with 1.3x urban road factor and 30 km/h average speed
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const c =
      sinLat * sinLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    const straight = 2 * 6371000 * Math.asin(Math.sqrt(c));
    totalMeters += straight * 1.3;
  }

  return {
    distanceMeters: totalMeters,
    durationSeconds: totalMeters / (30000 / 3600),
    geometry: {
      type: "LineString",
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  };
}
