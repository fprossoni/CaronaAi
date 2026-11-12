import { campusToLocation, type LocationValue } from "@/lib/geocoding";
import type { CampusId, TripDirection } from "@/types/ride";

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
}

export function getInitialTripRoute(prefill: TripPrefill | null): TripRoute {
  const campus = prefill?.campus ? campusToLocation(prefill.campus) : null;
  return prefill?.direction === "from_campus"
    ? { origin: campus, destination: null }
    : { origin: null, destination: campus };
}
