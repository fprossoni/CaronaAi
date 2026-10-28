import { apiClient } from "./client";
import type {
  MatchBatchRequest,
  MatchBatchResult,
  MatchConfirmed,
  MatchForDriver,
  MatchPublic,
  MatchRequest,
  MatchWithRide,
} from "@/types/match";

export const matchesApi = {
  request: (data: MatchRequest) => apiClient.post<MatchPublic>("/matches/", data),

  /** Send a "matching" to several rides at once. */
  requestBatch: (data: MatchBatchRequest) => apiClient.post<MatchBatchResult>("/matches/batch", data),

  getMyMatches: () => apiClient.get<MatchWithRide[]>("/matches/my"),

  getRideMatches: (rideId: number) =>
    apiClient.get<MatchForDriver[]>(`/matches/ride/${rideId}`),

  respond: (matchId: number, action: "accept" | "reject") =>
    apiClient.patch<MatchConfirmed>(`/matches/${matchId}/respond`, { action }),

  cancel: (matchId: number) => apiClient.patch(`/matches/${matchId}/cancel`),

  getById: (matchId: number) => apiClient.get<MatchConfirmed>(`/matches/${matchId}`),
};
