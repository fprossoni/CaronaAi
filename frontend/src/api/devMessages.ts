import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ChatMessage, Conversation } from "@/types/chat";
import type { MatchConfirmed } from "@/types/match";
import type { RidePublic } from "@/types/ride";
import type { UserPublic } from "@/types/user";

const conversations: { id: number; rideId: number; passengerId: number | null }[] = [];
const messages: ChatMessage[] = [];
let nextConversationId = 1;
let nextMessageId = 1;

export function devMessages(config: InternalAxiosRequestConfig, user: UserPublic, rides: Map<number, RidePublic>,
  matches: { passenger: UserPublic; details: MatchConfirmed }[]) {
  const path = config.url?.replace(/\/$/, "") ?? "";
  if (!path.startsWith("/messages")) return undefined;
  const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  const fail = (status: number, detail: string): never => {
    throw new AxiosError(detail, "ERR_BAD_REQUEST", config, undefined,
      { data: { detail }, status, statusText: detail, headers: {}, config });
  };
  const describe = (c: typeof conversations[number]): Conversation => {
    const ride = rides.get(c.rideId);
    if (!ride) return fail(404, "Carona não encontrada");
    const accepted = matches.filter((m) => m.details.ride_id === ride.id && m.details.status === "accepted").map((m) => m.passenger);
    if (!accepted.length || (user.id !== ride.driver.id && !accepted.some((p) => p.id === user.id))) {
      return fail(403, "Mensagens disponíveis apenas para participantes confirmados");
    }
    if (c.passengerId !== null && (!accepted.some((p) => p.id === c.passengerId) || ![ride.driver.id, c.passengerId].includes(user.id))) {
      return fail(403, "Você não participa desta conversa");
    }
    if (!["active", "full", "in_progress"].includes(ride.status)) return fail(409, "Esta carona foi encerrada");
    return {
      id: c.id, ride_id: ride.id, kind: c.passengerId === null ? "group" : "private",
      driver_id: ride.driver.id, passenger_id: c.passengerId,
      origin_label: ride.origin_label, destination_label: ride.destination_label, departure_at: ride.departure_at,
      participants: [ride.driver, ...accepted.filter((p) => c.passengerId === null || p.id === c.passengerId)].map((p) => ({ id: p.id, name: p.name })),
    };
  };
  if (path === "/messages" && config.method === "get") {
    return conversations.flatMap((c) => {
      try { return [describe(c)]; } catch { return []; }
    }).reverse();
  }
  if (path === "/messages" && config.method === "post") {
    const passengerId = body.passenger_id ?? null;
    const existing = conversations.find((c) => c.rideId === body.ride_id && c.passengerId === passengerId);
    const conversation = existing ?? { id: nextConversationId, rideId: body.ride_id, passengerId };
    const result = describe(conversation);
    if (!existing) { conversations.push(conversation); nextConversationId++; }
    return result;
  }
  const route = /^\/messages\/(\d+)\/items$/.exec(path);
  const conversation = conversations.find((c) => c.id === Number(route?.[1]));
  if (!conversation) return fail(404, "Conversa indisponível");
  describe(conversation);
  if (config.method === "get") {
    const { after, before } = config.params ?? {};
    const selected = messages.filter((m) => m.conversation_id === conversation.id &&
      (after == null || m.id > after) && (before == null || m.id < before));
    return after == null ? selected.slice(-50) : selected.slice(0, 50);
  }
  if (config.method === "post") {
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 2000) return fail(422, "A mensagem deve conter de 1 a 2000 caracteres");
    const message: ChatMessage = {
      id: nextMessageId++, conversation_id: conversation.id, sender_id: user.id,
      sender: { id: user.id, name: user.name }, body: text, created_at: new Date().toISOString(),
    };
    messages.push(message);
    return message;
  }
  return fail(405, "Operação indisponível");
}
