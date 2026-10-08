import { apiClient } from "./client";
import type { RideCreate, RideDetail, RidePublic, SearchRidesParams, TripHistory } from "@/types/ride";

export const ridesApi = {
  create: (data: RideCreate) => apiClient.post<RideDetail>("/rides/", data),

  search: (params: SearchRidesParams) =>
    apiClient.get<RidePublic[]>("/rides/search", { params }),

  getMyRides: () => apiClient.get<RideDetail[]>("/rides/my"),

  getHistory: () => apiClient.get<TripHistory[]>("/rides/history"),

  getById: (id: number) => apiClient.get<RideDetail>(`/rides/${id}`),

  cancel: (id: number) => apiClient.patch(`/rides/${id}/cancel`),
};
