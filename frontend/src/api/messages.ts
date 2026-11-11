import { apiClient } from "./client";
import type { ChatMessage, Conversation } from "@/types/chat";

export const messagesApi = {
  list: () => apiClient.get<Conversation[]>("/messages"),
  open: (rideId: number, passengerId?: number) =>
    apiClient.post<Conversation>("/messages", { ride_id: rideId, passenger_id: passengerId }),
  items: (id: number, params?: { after?: number; before?: number }) =>
    apiClient.get<ChatMessage[]>(`/messages/${id}/items`, { params }),
  send: (id: number, body: string) =>
    apiClient.post<ChatMessage>(`/messages/${id}/items`, { body }),
};
