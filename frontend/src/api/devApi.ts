import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { differenceInYears, parseISO } from "date-fns";
import {
  MOCK_CONFIRMED_DETAILS,
  MOCK_DRIVER_REQUESTS,
  MOCK_HOME_ADDRESS,
  MOCK_RIDE_FROM_CAMPUS,
  MOCK_RIDE_STANDARD,
  MOCK_RIDE_WOMEN_ONLY,
} from "@/data/devMocks";
import { isDevSession } from "@/lib/devSession";
import { useAuthStore } from "@/store/authStore";
import type { AddressCreate, AddressPublic } from "@/types/address";
import type { MatchBatchRequest, MatchConfirmed, MatchRequest } from "@/types/match";
import type { RideCreate, RidePublic, SearchRidesParams, TripHistory } from "@/types/ride";
import type { ProfileUpdate, UserPrivate, UserPublic } from "@/types/user";
import { straightLineDistanceMeters } from "@/lib/geocoding";
import { devMessages } from "./devMessages";

let nextId = 10000;
const MAX_PICKUP_DELAY_MS = 2 * 60 * 60 * 1000;
const rides = new Map([MOCK_RIDE_STANDARD, MOCK_RIDE_WOMEN_ONLY, MOCK_RIDE_FROM_CAMPUS].map((ride) => [ride.id, ride]));
const matches: { passenger: UserPublic; details: MatchConfirmed; batchId?: string }[] =
  MOCK_DRIVER_REQUESTS.map(({ passenger, status, id }) => ({
    passenger,
    details: { ...MOCK_CONFIRMED_DETAILS[id], status },
  }));
const addresses = new Map<number, AddressPublic[]>();

function pickupBounds(after?: string, before?: string) {
  const start = Date.parse(after ?? "");
  const end = Date.parse(before ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("O fim do intervalo de saída deve ser posterior ao início.");
  }
  return { start, end };
}

function estimatePickupAt(ride: RidePublic, pickupLat?: number, pickupLng?: number): number {
  const { origin_lat: lat, origin_lng: lng } = ride;
  if (lat == null || lng == null || pickupLat == null || pickupLng == null) return NaN;
  const meters = straightLineDistanceMeters({ lat, lng }, { lat: pickupLat, lng: pickupLng });
  return Date.parse(ride.departure_at) + Math.round(meters / (30 / 3.6) * 1000);
}

function pickupFits(ride: RidePublic, estimated: number, start: number, end: number, now: number): boolean {
  const departure = Date.parse(ride.departure_at);
  return departure > now && Math.max(start, departure) <= estimated &&
    estimated <= Math.min(end, departure + MAX_PICKUP_DELAY_MS);
}

function addMatch(passenger: UserPrivate, body: MatchRequest, batchId?: string): MatchConfirmed {
  const ride = rides.get(body.ride_id);
  if (!ride || ride.driver.id === passenger.id || ride.status !== "active" || ride.available_seats < 1) {
    throw new Error("Esta carona simulada está indisponível.");
  }
  if (ride.women_only && passenger.gender !== "female") {
    throw new Error("Carona exclusiva para mulheres.");
  }
  const { start, end } = pickupBounds(body.pickup_after, body.pickup_before);
  const saved = addresses.get(passenger.id) ?? [{ ...MOCK_HOME_ADDRESS, user_id: passenger.id }];
  const pickup = saved.find((address) => address.id === body.pickup_address_id);
  const estimated = estimatePickupAt(ride, pickup?.lat ?? body.pickup_lat, pickup?.lng ?? body.pickup_lng);
  if (!pickupFits(ride, estimated, start, end, Date.now())) {
    throw new Error("O horário previsto de chegada à origem está fora do intervalo informado.");
  }
  const existing = matches.find(({ passenger: requester, details }) =>
    requester.id === passenger.id && details.ride_id === ride.id &&
    (details.status === "pending" || details.status === "accepted"),
  );
  if (existing) throw new Error("Você já solicitou esta carona.");

  const details: MatchConfirmed = {
    id: nextId++, ride_id: ride.id, status: "pending",
    detour_meters: ride.detour_meters ?? 0, detour_seconds: ride.detour_seconds ?? 0,
    pickup_label: body.pickup_label ?? "Ponto de origem", pickup_region: body.pickup_region ?? "Porto Alegre",
    pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng,
    dropoff_label: body.dropoff_label ?? null,
    dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng,
    passenger_phone: passenger.phone, driver_phone: ride.driver.phone,
    created_at: new Date().toISOString(), responded_at: null,
  };
  matches.push({ passenger, details, batchId });
  return details;
}

export async function handleDevRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const { user } = useAuthStore.getState();
  if (!isDevSession() || !user) throw new Error("Selecione uma sessão simulada em /dev.");

  const path = config.url?.replace(/\/$/, "") ?? "";
  const method = config.method;
  const respond = (data?: unknown): AxiosResponse => ({
    data, status: 200, statusText: "OK", headers: {}, config,
  });
  // Axios serializes JSON before invoking the adapter.
  const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  const userAddresses = addresses.get(user.id) ?? [{ ...MOCK_HOME_ADDRESS, user_id: user.id }];
  const ownRides = [...rides.values()].filter((ride) => ride.driver.id === user.id);
  const ownMatches = matches.filter(({ passenger }) => passenger.id === user.id);
  const chatResult = devMessages(config, user, rides, matches);
  if (chatResult !== undefined) return respond(chatResult);

  if (path === "/users/me" && method === "get") return respond(user);
  if (path === "/users/me" && method === "patch") {
    const updated = { ...user, ...(body as ProfileUpdate) };
    if (updated.birth_date) updated.age = differenceInYears(new Date(), parseISO(updated.birth_date));
    updated.profile_complete = Boolean(updated.name && updated.course && updated.gender && updated.birth_date);
    return respond(updated);
  }
  if (path === "/addresses" && method === "get") return respond(userAddresses);
  if (path === "/addresses" && method === "post") {
    const { lat, lng } = MOCK_HOME_ADDRESS;
    const address: AddressPublic = {
      ...(body as AddressCreate), id: nextId++, user_id: user.id, lat, lng, created_at: new Date().toISOString(),
    };
    addresses.set(user.id, [...userAddresses, address]);
    return respond(address);
  }
  if (path.startsWith("/addresses/") && method === "delete") {
    addresses.set(user.id, userAddresses.filter((address) => path !== `/addresses/${address.id}`));
    return respond();
  }
  if (path === `/addresses/cep/${MOCK_HOME_ADDRESS.postal_code.replace(/\D/g, "")}`) {
    return respond(MOCK_HOME_ADDRESS);
  }

  if (path === "/rides/search") {
    const params = (config.params ?? {}) as SearchRidesParams;
    const { women_only, pickup_after, pickup_before } = params;
    const { start, end } = pickupBounds(pickup_after, pickup_before);
    const now = Date.now();
    if (end <= now) throw new Error("Informe um fim posterior ao horário atual.");
    const pickupAddress = userAddresses.find(({ id }) => id === params.pickup_address_id);
    const dropoffAddress = userAddresses.find(({ id }) => id === params.dropoff_address_id);
    const pickup = { lat: pickupAddress?.lat ?? params.pickup_lat, lng: pickupAddress?.lng ?? params.pickup_lng };
    const dropoff = { lat: dropoffAddress?.lat ?? params.dropoff_lat, lng: dropoffAddress?.lng ?? params.dropoff_lng };
    if (pickup.lat == null || pickup.lng == null || dropoff.lat == null || dropoff.lng == null) {
      throw new Error("Informe os pontos de origem e destino.");
    }
    const passengerOrigin = { lat: pickup.lat, lng: pickup.lng };
    const passengerDestination = { lat: dropoff.lat, lng: dropoff.lng };
    const passengerDistance = straightLineDistanceMeters(passengerOrigin, passengerDestination);
    const results = [...rides.values()].flatMap((ride) => {
      const estimated = estimatePickupAt(ride, pickup.lat, pickup.lng);
      if (ride.driver.id === user.id || ride.status !== "active" || ride.available_seats < 1 ||
          (ride.women_only && user.gender !== "female") || (women_only && !ride.women_only) ||
          !pickupFits(ride, estimated, start, end, now)) return [];
      const { origin_lat, origin_lng, destination_lat, destination_lng } = ride;
      if (origin_lat == null || origin_lng == null || destination_lat == null || destination_lng == null) return [];
      const origin = { lat: origin_lat, lng: origin_lng };
      const destination = { lat: destination_lat, lng: destination_lng };
      const originalDistance = straightLineDistanceMeters(origin, destination);
      const adjustedDistance = straightLineDistanceMeters(origin, passengerOrigin) + passengerDistance +
        straightLineDistanceMeters(passengerDestination, destination);
      const detour = Math.max(0, adjustedDistance - originalDistance);
      if (detour > 3000) return [];
      const match = ownMatches.find(({ details }) => details.ride_id === ride.id &&
        (details.status === "pending" || details.status === "accepted"));
      return [{ ...ride, detour_meters: detour, detour_seconds: detour / (30 / 3.6),
        estimated_pickup_at: new Date(estimated).toISOString(),
        estimated_dropoff_at: new Date(estimated + passengerDistance / (30 / 3.6) * 1000).toISOString(),
        my_match_id: match?.details.id, my_match_status: match?.details.status,
      }];
    });
    return respond(results.sort((a, b) => a.detour_meters - b.detour_meters));
  }
  if (path === "/rides/my") return respond(ownRides);
  if (path === "/rides/history") {
    const history: TripHistory[] = ownRides.filter((ride) => ride.status === "cancelled" || ride.status === "completed").map((ride) => ({
      ride_id: ride.id, role: "driver", status: ride.status === "completed" ? "completed" : "cancelled", departure_at: ride.departure_at,
      origin_label: ride.origin_label, destination_label: ride.destination_label, participants: [],
    }));
    for (const { details } of ownMatches) {
      const ride = rides.get(details.ride_id);
      if (ride && (details.status === "cancelled" || (details.status === "accepted" && ["completed", "cancelled"].includes(ride.status)))) {
        history.push({ ride_id: ride.id, role: "passenger",
          status: details.status === "cancelled" || ride.status === "cancelled" ? "cancelled" : "completed",
          departure_at: ride.departure_at, origin_label: ride.origin_label, destination_label: ride.destination_label, participants: [] });
      }
    }
    return respond(history);
  }
  if (path === "/rides" && method === "post") {
    const { total_seats = 1, origin_label = "Origem", destination_label = "Destino", ...trip } = body as RideCreate;
    if (trip.women_only && user.gender !== "female") {
      throw new Error("Apenas motoristas mulheres podem oferecer caronas exclusivas para mulheres.");
    }
    const ride: RidePublic = {
      ...trip, id: nextId++, driver: user, status: "active", origin_label, destination_label,
      campus_point: trip.campus_point ?? null,
      total_seats, available_seats: total_seats,
      women_only: trip.women_only ?? false, route_distance_meters: 0, route_duration_seconds: 0,
    };
    rides.set(ride.id, ride);
    return respond(ride);
  }
  const rideToCancel = ownRides.find((ride) => path === `/rides/${ride.id}/cancel`);
  if (rideToCancel) {
    if (!["active", "full"].includes(rideToCancel.status)) throw new Error("Esta carona não pode ser cancelada.");
    rides.set(rideToCancel.id, { ...rideToCancel, status: "cancelled" });
    for (const { details } of matches) {
      if (details.ride_id === rideToCancel.id) details.status = "cancelled";
    }
    return respond();
  }
  const rideTransition = /^\/rides\/(\d+)\/(start|complete)$/.exec(path);
  if (rideTransition && method === "patch") {
    const ride = ownRides.find((r) => r.id === Number(rideTransition[1]));
    if (!ride) throw new Error("Apenas o motorista pode atualizar a carona.");
    const completing = rideTransition[2] === "complete";
    if (completing ? ride.status !== "in_progress" : !["active", "full"].includes(ride.status)) {
      throw new Error("Não é possível alterar a carona neste estado.");
    }
    rides.set(ride.id, { ...ride, status: completing ? "completed" : "in_progress" });
    return respond();
  }

  if (path === "/matches/my") {
    return respond(ownMatches.map(({ details }) => ({ ...details, ride: rides.get(details.ride_id) })));
  }
  if (path === "/matches" && method === "post") return respond(addMatch(user, body as MatchRequest));
  if (path === "/matches/batch") {
    const { ride_ids, ...pickup } = body as MatchBatchRequest;
    const batchId = String(nextId++);
    const created = [];
    const skipped = [];
    for (const ride_id of new Set(ride_ids)) {
      try {
        created.push(addMatch(user, { ...pickup, ride_id }, batchId));
      } catch (error) {
        skipped.push({ ride_id, reason: (error as Error).message });
      }
    }
    return respond({ batch_id: batchId, created, skipped });
  }

  const driverRide = ownRides.find((ride) => path === `/matches/ride/${ride.id}`);
  if (driverRide) {
    return respond(matches.filter(({ details }) => details.ride_id === driverRide.id)
      .map(({ passenger, details }) => ({ ...details, passenger })));
  }
  const matchRoute = /^\/matches\/(\d+)(?:\/(cancel|respond))?$/.exec(path);
  const match = matches.find(({ details }) => details.id === Number(matchRoute?.[1]));
  if (match && matchRoute) {
    const { details, passenger, batchId } = match;
    const ride = rides.get(details.ride_id)!;
    const action = matchRoute[2];
    if (action === "cancel" && passenger.id === user.id) {
      if (!["active", "full", "in_progress"].includes(ride.status)) throw new Error("Esta carona já foi encerrada.");
      if (details.status === "accepted") {
        rides.set(ride.id, { ...ride, available_seats: ride.available_seats + 1, status: ride.status === "full" ? "active" : ride.status });
      }
      details.status = "cancelled";
      return respond();
    }
    if (action === "respond" && ride.driver.id === user.id && details.status === "pending") {
      if (body.action === "accept") {
        if (ride.status !== "active" || ride.available_seats < 1) throw new Error("Não há vagas disponíveis.");
        const available_seats = ride.available_seats - 1;
        rides.set(ride.id, { ...ride, available_seats, status: available_seats ? "active" : "full" });
        details.status = "accepted";
        details.driver_phone = ride.driver.phone;
        if (batchId) {
          for (const sibling of matches) {
            if (sibling.batchId === batchId && sibling.details.status === "pending") {
              sibling.details.status = "superseded";
            }
          }
        }
      } else {
        details.status = "rejected";
      }
      details.responded_at = new Date().toISOString();
      return respond({ ...details });
    }
    if (!action && (ride.driver.id === user.id || passenger.id === user.id)) return respond({ ...details });
  }
  throw new Error("Operação indisponível na sessão simulada. Encerre a simulação para usar a API real.");
}
