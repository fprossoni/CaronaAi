import { apiClient } from "./client";
import type { MatchConfirmed, MatchForDriver, MatchPublic, MatchRequest } from "@/types/match";

export const matchesApi = {
  request: (data: MatchRequest) => apiClient.post<MatchPublic>("/matches/", data),

  getMyMatches: () => apiClient.get<MatchPublic[]>("/matches/my"),

  getRideMatches: (rideId: number) =>
    apiClient.get<MatchForDriver[]>(`/matches/ride/${rideId}`),

  respond: (matchId: number, action: "accept" | "reject") =>
    apiClient.patch<MatchConfirmed>(`/matches/${matchId}/respond`, { action }),

  cancel: (matchId: number) => apiClient.patch(`/matches/${matchId}/cancel`),

  getById: (matchId: number) => apiClient.get<MatchConfirmed>(`/matches/${matchId}`),
};
