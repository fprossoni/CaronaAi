import type { UserPublic } from "./user";

export type RideStatus = "active" | "full" | "in_progress" | "completed" | "cancelled";

export const UFRGS_CAMPUS = [
  { id: "campus_vale", name: "Campus do Vale", lat: -30.0734, lng: -51.1201 },
  { id: "campus_centro", name: "Campus Centro", lat: -30.0349, lng: -51.2177 },
  { id: "campus_saude", name: "Campus Saúde", lat: -30.0395, lng: -51.2089 },
  { id: "campus_agronomia_esefid", name: "Campus Agronomia / ESEFID", lat: -30.0608, lng: -51.1734 },
  { id: "campus_litoral_norte", name: "Campus Litoral Norte", lat: -29.9794, lng: -50.133 },
] as const;

export type CampusId = (typeof UFRGS_CAMPUS)[number]["id"];

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
}

export interface RideDetail extends RidePublic {
  route_geojson?: GeoJSON.LineString | null;
}

export interface RideCreate {
  origin_label: string;
  origin_lat: number;
  origin_lng: number;
  destination_label: string;
  destination_lat: number;
  destination_lng: number;
  campus_point: CampusId;
  departure_at: string;
  delay_tolerance_minutes?: number;
  total_seats?: number;
  women_only?: boolean;
}

export interface SearchRidesParams {
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string;
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
