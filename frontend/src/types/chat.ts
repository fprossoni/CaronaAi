export interface ChatParticipant {
  id: number;
  name: string | null;
}

export interface Conversation {
  id: number;
  ride_id: number;
  kind: "group" | "private";
  driver_id: number;
  passenger_id: number | null;
  origin_label: string;
  destination_label: string;
  departure_at: string;
  participants: ChatParticipant[];
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender: ChatParticipant;
  body: string;
  created_at: string;
}
