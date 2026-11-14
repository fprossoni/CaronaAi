import type { UserPublic } from "./user";
import type { AddressCreate } from "./address";
import { CAMPUS_LIST, DEFAULT_CAMPUS, type CampusId, type CampusInfo } from "@/constants/campuses";

export type { CampusId, CampusInfo };
export { CAMPUS_LIST, DEFAULT_CAMPUS };
export const UFRGS_CAMPUS = CAMPUS_LIST;

export type RideStatus = "active" | "full" | "in_progress" | "completed" | "cancelled";
export type TripDirection = "to_campus" | "from_campus";

export interface RidePublic {
  id: number;
  driver: UserPublic;
  origin_label: string;
  destination_label: string;
  campus_point: CampusId | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  departure_at: string; // ISO datetime
  total_seats: number;
  available_seats: number;
  women_only: boolean;
  status: RideStatus;
  route_distance_meters: number;
  route_duration_seconds: number;
  route_geojson?: GeoJSON.LineString | null;
  // Set when returned from search
  detour_meters?: number;
  detour_seconds?: number;
  match_cost?: number | null;
  pickup_difference_seconds?: number | null;
  estimated_pickup_at?: string | null;
  estimated_dropoff_at?: string | null;
  detour_geojson?: GeoJSON.LineString | null;
  // Passenger's own active request for this ride (search only)
  my_match_id?: number | null;
  my_match_status?: "pending" | "accepted" | null;
}

export interface RideSearchResult extends RidePublic {
  driver_completed_ride_count: number;
}

export interface RideDetail extends RidePublic {
  route_geojson?: GeoJSON.LineString | null;
}

export interface RideCreate {
  campus_point?: CampusId;
  origin_campus_id?: CampusId;
  destination_campus_id?: CampusId;
  origin_address_id?: number;
  destination_address_id?: number;
  direction?: TripDirection;
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
  total_seats?: number;
  women_only?: boolean;
}

export interface SearchRidesParams {
  pickup_campus_id?: CampusId;
  dropoff_campus_id?: CampusId;
  pickup_address_id?: number;
  dropoff_address_id?: number;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_label?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  women_only?: boolean;
  desired_pickup_at: string;
}

export interface TripParticipant {
  id: number;
  name: string | null;
  course: string | null;
  photo_url: string | null;
  avg_rating: number;
  rating_count: number;
  role: "driver" | "passenger";
  match_id?: number | null;
  already_rated?: boolean;
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
