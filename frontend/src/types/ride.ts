import type { UserPublic } from "./user";
import type { AddressCreate } from "./address";
import { CAMPUS_LIST, DEFAULT_CAMPUS, type CampusId, type CampusInfo } from "@/constants/campuses";

export type { CampusId, CampusInfo };
export { CAMPUS_LIST, DEFAULT_CAMPUS };
export const UFRGS_CAMPUS = CAMPUS_LIST;

export type RideStatus = "active" | "full" | "in_progress" | "completed" | "cancelled";

export interface RidePublic {
  id: number;
  driver: UserPublic;
  origin_label: string;
  destination_label: string;
  campus_point: CampusId;
  departure_at: string; // ISO datetime
  delay_tolerance_minutes: number;
  total_seats: number;
  available_seats: number;
  women_only: boolean;
  status: RideStatus;
  route_distance_meters: number;
  route_duration_seconds: number;
  // Set when returned from search
  detour_meters?: number;
  detour_seconds?: number;
  // Passenger's own active request for this ride (search only)
  my_match_id?: number | null;
  my_match_status?: "pending" | "accepted" | null;
}

export interface RideDetail extends RidePublic {
  route_geojson?: GeoJSON.LineString | null;
}

export interface RideCreate {
  campus_point: CampusId;
  direction: "to_campus" | "from_campus";
  address_id?: number | null;
  custom_address?: AddressCreate | null;
  save_address?: boolean;
  origin_label?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_label?: string;
  destination_lat?: number;
  destination_lng?: number;
  departure_at: string;
  delay_tolerance_minutes?: number;
  total_seats?: number;
  women_only?: boolean;
}

export interface SearchRidesParams {
  address_id?: number;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_label?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  women_only?: boolean;
}

export interface TripParticipant {
  id: number;
  name: string | null;
  course: string | null;
  photo_url: string | null;
  avg_rating: number;
  rating_count: number;
  role: "driver" | "passenger";
}

export interface TripHistory {
  ride_id: number;
  role: "driver" | "passenger";
  status: "completed" | "cancelled";
  departure_at: string;
  origin_label: string;
  destination_label: string;
  participants: TripParticipant[];
}
