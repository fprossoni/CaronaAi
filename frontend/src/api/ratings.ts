/**
 * Ratings API module — /ratings/*
 *
 * Encapsulates post-trip evaluations (1 to 5 stars + optional comment)
 * between drivers and passengers of confirmed matches.
 */

import { apiClient } from "./client";

export interface CreateRatingPayload {
  match_id: number;
  rated_user_id: number;
  stars: number;
  comment?: string;
}

export const ratingsApi = {
  /**
   * Submit a 1–5 star rating for a participant of an accepted match.
   */
  create: (payload: CreateRatingPayload) =>
    apiClient.post<{ message: string }>("/ratings/", payload),
};
