import type { UserPublic } from "./user";

export type MatchStatus = "pending" | "accepted" | "rejected" | "cancelled";

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
}

export interface MatchConfirmed extends MatchPublic {
  // Revealed after acceptance
  driver_phone?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  passenger_phone?: string;
}

export interface MatchRequest {
  ride_id: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_label?: string;
  pickup_region: string;
}
