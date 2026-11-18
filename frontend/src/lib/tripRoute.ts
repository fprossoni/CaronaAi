import { campusToLocation, type LocationValue } from "@/lib/geocoding";
import { UFRGS_CAMPUS, type CampusId, type TripDirection } from "@/types/ride";

export interface TripRoute {
  origin: LocationValue | null;
  destination: LocationValue | null;
}

export function hasTripCampus({ origin, destination }: TripRoute): boolean {
  return Boolean(origin?.campusId || destination?.campusId);
}

export interface TripPrefill {
  campus?: CampusId;
  direction?: TripDirection;
  addressQuery?: string;
  originQuery?: string;
  destinationQuery?: string;
  origin?: LocationValue | null;
  destination?: LocationValue | null;
}

function matchCampusQuery(query?: string): LocationValue | null {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 3) return null;
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const matched = UFRGS_CAMPUS.find((c) => {
    const candidates = [
      c.name,
      c.shortName,
      `ufrgs — ${c.name}`,
      `ufrgs - ${c.name}`,
      c.id,
    ].map((s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    );
    return candidates.some((cand) => cand === normalized || cand.includes(normalized));
  });

  return matched ? campusToLocation(matched.id) : null;
}

export function getInitialTripRoute(prefill: TripPrefill | null): TripRoute {
  if (!prefill) {
    return { origin: null, destination: null };
  }

  const campus = prefill.campus ? campusToLocation(prefill.campus) : null;
  const fallbackOrigin =
    prefill.origin ??
    matchCampusQuery(prefill.originQuery) ??
    (prefill.direction === "from_campus" ? campus : null);
  const fallbackDestination =
    prefill.destination ??
    matchCampusQuery(prefill.destinationQuery) ??
    (prefill.direction !== "from_campus" ? campus : null);

  return {
    origin: fallbackOrigin,
    destination: fallbackDestination,
  };
}
