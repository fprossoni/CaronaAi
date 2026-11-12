import type { UserPublic } from "./user";
import type { CampusId, RidePublic } from "./ride";
import type { AddressCreate } from "./address";

export type MatchStatus = "pending" | "accepted" | "rejected" | "cancelled" | "superseded";

export interface MatchPublic {
  id: number;
  ride_id: number;
  status: MatchStatus;
  detour_meters: number;
  detour_seconds: number;
  pickup_label: string;
  dropoff_label: string | null;
  pickup_region: string;
  created_at: string;
  responded_at: string | null;
}

export interface MatchForDriver {
  id: number;
  ride_id: number;
  status: MatchStatus;
  passenger: UserPublic;
  pickup_region: string;
  detour_meters: number;
  detour_seconds: number;
  created_at: string;
  // Revealed only after acceptance
  pickup_street?: string | null;
  pickup_number?: string | null;
  pickup_complement?: string | null;
  pickup_postal_code?: string | null;
  pickup_neighborhood?: string | null;
  pickup_city?: string | null;
  passenger_phone?: string | null;
}

export interface MatchConfirmed extends MatchPublic {
  // Revealed after acceptance
  driver_phone?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  passenger_phone?: string | null;
  pickup_street?: string | null;
  pickup_number?: string | null;
  pickup_complement?: string | null;
  pickup_postal_code?: string | null;
  pickup_neighborhood?: string | null;
  pickup_city?: string | null;
}

export interface MatchWithRide extends MatchPublic {
  // Ride summary, returned by GET /matches/my
  ride: RidePublic;
}

interface MatchTrip {
  pickup_campus_id?: CampusId;
  dropoff_campus_id?: CampusId;
  pickup_after: string;
  pickup_before: string;
  pickup_address_id?: number | null;
  dropoff_address_id?: number | null;
  custom_address?: AddressCreate | null;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_label?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_label?: string;
  pickup_region?: string;
}

export interface MatchRequest extends MatchTrip {
  ride_id: number;
}

export interface MatchBatchRequest extends MatchTrip {
  ride_ids: number[];
}

export interface MatchBatchResult {
  batch_id: string;
  created: MatchPublic[];
  skipped: { ride_id: number; reason: string }[];
}
