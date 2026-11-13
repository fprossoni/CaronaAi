import { apiClient } from "./client";
import type { RideCreate, RideDetail, RideSearchResult, SearchRidesParams, TripHistory } from "@/types/ride";

type Coordinates = { lat: number; lng: number };

export const ridesApi = {
  create: (data: RideCreate) => apiClient.post<RideDetail>("/rides/", data),

  previewRoute: (origin: Coordinates, destination: Coordinates, signal: AbortSignal) =>
    apiClient.post<{ route_geojson: GeoJSON.LineString | null }>("/rides/preview", { origin, destination }, { signal }),

  search: (params: SearchRidesParams, signal?: AbortSignal) =>
    apiClient.get<RideSearchResult[]>("/rides/search", { params, signal }),

  getMyRides: () => apiClient.get<RideDetail[]>("/rides/my"),

  getHistory: () => apiClient.get<TripHistory[]>("/rides/history"),

  getById: (id: number) => apiClient.get<RideDetail>(`/rides/${id}`),

  cancel: (id: number) => apiClient.patch(`/rides/${id}/cancel`),
  start: (id: number) => apiClient.patch(`/rides/${id}/start`),
  complete: (id: number) => apiClient.patch(`/rides/${id}/complete`),
};
