import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import { messagesApi } from "@/api/messages";
import type { RideDetail, RideStatus } from "@/types/ride";
import type { MatchConfirmed, MatchForDriver, MatchWithRide } from "@/types/match";
import type { UserPublic } from "@/types/user";
import { RideRequestsModal } from "@/components/rides/RideRequestsModal";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { Avatar } from "@/components/ui/Avatar";
import { SeatMeter } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";

import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import {
  buildWhatsAppUrl,
  formatDistance,
  formatDuration,
  getCampusInfo,
} from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTIVE_RIDE_STATUSES: RideStatus[] = ["active", "full", "in_progress"];

function isActiveRide(status: RideStatus): boolean {
  return ACTIVE_RIDE_STATUSES.includes(status);
}

function formatDate(iso: string): string {
  return format(new Date(iso), "dd MMM · HH:mm", { locale: ptBR });
}

function passengerPickup(match: MatchForDriver): string {
  return match.confirmed_pickup_label || [match.pickup_street, match.pickup_number, match.pickup_complement, match.pickup_neighborhood]
    .filter(Boolean).join(", ") || match.confirmed_pickup_label || match.pickup_region;
}

function RideRow({ to, time, origin, destination, status }: {
  to: string;
  time: string;
  origin: string;
  destination: string;
  status: string;
}) {
  return (
    <Link to={to} className="grid gap-2 rounded-md border border-border bg-surface p-4 text-text no-underline hover:border-primary sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center">
      <span className="font-mono text-sm font-semibold">{time}</span>
      <span className="wrap-anywhere font-semibold">{origin} → {destination}</span>
      <span className="text-sm text-accent-text">{status} <span aria-hidden="true">›</span></span>
    </Link>
  );
}

export const MyRidesPage: React.FC = () => {
  const navigate = useNavigate();
  const { tripRole, tripId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDetail = tripId !== undefined;
  const isDriver = (isDetail ? tripRole : searchParams.get("papel")) === "driver";
  const role = isDriver ? "driver" : "passenger";
  const toast = useToastStore();

  const [rides, setRides] = useState<RideDetail[]>([]);
  const [matches, setMatches] = useState<MatchWithRide[]>([]);
  const [confirmedByMatchId, setConfirmedByMatchId] = useState<Record<number, MatchConfirmed>>({});
  const [rideMatchCounts, setRideMatchCounts] = useState<
    Record<number, { pending: number; accepted: number; passengers: MatchForDriver[] }>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [removingMatchId, setRemovingMatchId] = useState<number | null>(null);
  const [modalRide, setModalRide] = useState<RideDetail | null>(null);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [openingChat, setOpeningChat] = useState<number | null>(null);
  const [changingRide, setChangingRide] = useState<number | null>(null);

  const openChat = async (rideId: number) => {
    setOpeningChat(rideId);
    try {
      const { data } = await messagesApi.open(rideId);
      navigate(`/messages?conversation=${data.id}`);
    } catch (err) {
      toast.error("Não foi possível abrir mensagens", getErrorMessage(err));
    } finally {
      setOpeningChat(null);
    }
  };

  const loadData = useCallback(async () => {
    const [ridesRes, matchesRes] = await Promise.all([
      ridesApi.getMyRides(),
      matchesApi.getMyMatches(),
    ]);

    const upcoming = ridesRes.data.filter((r) =>
      isActiveRide(r.status) && (!tripId || (tripRole === "driver" && String(r.id) === tripId))
    );
    const countsEntries = await Promise.all(
      upcoming.map(async (r) => {
        try {
          const { data } = await matchesApi.getRideMatches(r.id);
          return [
            r.id,
            {
              pending: data.filter((m) => m.status === "pending").length,
              accepted: data.filter((m) => m.status === "accepted").length,
              passengers: data,
            },
          ] as const;
        } catch {
          throw new Error("Não foi possível carregar as solicitações da viagem.");
        }
      })
    );

    const acceptedPassengerMatches = matchesRes.data.filter(
      (m) => tripRole === "passenger" && String(m.id) === tripId && m.status === "accepted"
    );
    const confirmedEntries = await Promise.all(
      acceptedPassengerMatches.map(async (m) => {
        try {
          const { data } = await matchesApi.getById(m.id);
          return [m.id, data] as const;
        } catch {
          return null;
        }
      })
    );

    const confirmedMap: Record<number, MatchConfirmed> = {};
    for (const entry of confirmedEntries) {
      if (entry) confirmedMap[entry[0]] = entry[1];
    }

    return {
      rides: ridesRes.data,
      matches: matchesRes.data,
      rideMatchCounts: Object.fromEntries(countsEntries),
      confirmedMap,
    };
  }, [tripId, tripRole]);

  const commit = useCallback((data: Awaited<ReturnType<typeof loadData>>) => {
    setRides(data.rides);
    setError("");
    setMatches(data.matches);
    setRideMatchCounts(data.rideMatchCounts);
    setConfirmedByMatchId(data.confirmedMap);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadData()
      .then((data) => {
        if (active) commit(data);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err, "Erro ao carregar suas caronas."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadData, commit]);

  const refresh = useCallback(() => {
    void loadData()
      .then(commit)
      .catch((err: unknown) => {
        setError(getErrorMessage(err, "Erro ao atualizar as caronas."));
      });
  }, [loadData, commit]);

  const changeRideStatus = async (ride: RideDetail) => {
    const completing = ride.status === "in_progress";
    if (
      completing &&
      !(await toast.confirm({
        title: "Concluir esta carona?",
        description: "A viagem irá para o histórico e as conversas serão encerradas.",
        confirmLabel: "Concluir",
      }))
    )
      return;
    setChangingRide(ride.id);
    try {
      await (completing ? ridesApi.complete(ride.id) : ridesApi.start(ride.id));
      refresh();
      toast.info(completing ? "Carona concluída." : "Carona iniciada.");
    } catch (err) {
      toast.error("Erro ao atualizar carona", getErrorMessage(err));
    } finally {
      setChangingRide(null);
    }
  };

  const handleCancelRide = async (ride: RideDetail) => {
    const ok = await toast.confirm({
      title: "Cancelar carona?",
      description: `${formatDate(ride.departure_at)} · ${ride.origin_label} → ${ride.destination_label}`,
      confirmLabel: "Cancelar carona",
      variant: "danger",
    });
    if (!ok) return;

    setCancellingId(ride.id);
    try {
      await ridesApi.cancel(ride.id);
      setRides((prev) =>
        prev.map((r) => (r.id === ride.id ? { ...r, status: "cancelled" } : r))
      );
      toast.info("Carona cancelada.");
    } catch (err: unknown) {
      toast.error("Erro ao cancelar carona", getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelMatch = async (match: MatchWithRide) => {
    const ok = await toast.confirm({
      title: match.status === "accepted" ? "Desistir da viagem?" : "Retirar pedido?",
      description:
        match.status === "accepted"
          ? "Sua vaga será liberada para o motorista."
          : "Sua solicitação pendente será retirada.",
      confirmLabel: "Confirmar",
      variant: "danger",
    });
    if (!ok) return;

    setCancellingId(match.id);
    try {
      await matchesApi.cancel(match.id);
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, status: "cancelled" } : m))
      );
      refresh();
      toast.info(match.status === "accepted" ? "Você desistiu da viagem. Sua vaga foi liberada." : "Solicitação retirada.");
    } catch (err: unknown) {
      toast.error("Erro ao cancelar", getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const handleRemovePassenger = async (match: MatchForDriver) => {
    if (removingMatchId !== null) return;
    const ok = await toast.confirm({
      title: "Remover passageiro?",
      description: `${match.passenger.name ?? "O passageiro"} sairá desta viagem e a vaga será liberada.`,
      confirmLabel: "Remover passageiro",
      variant: "danger",
    });
    if (!ok) return;
    setRemovingMatchId(match.id);
    try {
      await matchesApi.cancel(match.id);
      refresh();
      toast.info("Passageiro removido. A vaga foi liberada.");
    } catch (err: unknown) {
      toast.error("Não foi possível remover o passageiro", getErrorMessage(err));
    } finally {
      setRemovingMatchId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center font-mono text-xs text-text-muted animate-pulse">
        Carregando caronas…
      </div>
    );
  }

  const upcomingRides = rides
    .filter((r) => isActiveRide(r.status))
    .sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());

  const activeMatches = matches
    .filter((m) => (m.status === "pending" || m.status === "accepted") && isActiveRide(m.ride.status))
    .sort(
      (a, b) =>
        Date.parse(a.offered_pickup_at ?? a.ride.departure_at) - Date.parse(b.offered_pickup_at ?? b.ride.departure_at)
    );

  const hasAnyActive = role === "driver" ? upcomingRides.length > 0 : activeMatches.length > 0;
  const selectedRide = isDriver ? upcomingRides.find((ride) => String(ride.id) === tripId) : undefined;
  const selectedMatch = tripRole === "passenger"
    ? activeMatches.find((match) => String(match.id) === tripId)
    : undefined;
  const pending = upcomingRides.flatMap((ride) => (rideMatchCounts[ride.id]?.passengers ?? [])
    .filter((match) => match.status === "pending").map((match) => ({ ride, match })));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">
          {isDetail ? "Detalhes da carona" : "Minhas caronas"}
        </h1>

        {isDetail ? (
          <Link to={isDriver ? "/rides?papel=driver" : "/rides"} className="font-semibold text-accent-text hover:underline">
            Voltar para Minhas caronas
          </Link>
        ) : <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate("/rides/history")}
        >

          <span>Histórico</span>
        </Button>}
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">
          {error}
        </div>
      )}

      {!isDetail && <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher papel na viagem">
        {(["passenger", "driver"] as const).map((value) => (
          <Button key={value} variant={role === value ? "primary" : "secondary"}
            aria-pressed={role === value} onClick={() => setSearchParams(value === "driver" ? { papel: "driver" } : {})}>
            {value === "driver" ? "Como motorista" : "Como passageiro"}
          </Button>
        ))}
      </div>}
      {!isDetail && pending.length > 0 && (
        <section className="space-y-2 rounded-md border border-primary bg-surface p-4">
          <h2 className="font-bold">Solicitações aguardando sua confirmação</h2>
          {pending.map(({ ride, match }) => (
            <button key={match.id} type="button" onClick={() => setModalRide(ride)}
              className="block w-full rounded-md bg-surface-2 p-3 text-left hover:underline">
              <strong>{match.passenger.name ?? "Passageiro"}</strong> · {formatDate(ride.departure_at)}
              <span className="block text-sm">{ride.origin_label} → {ride.destination_label} · Ver solicitação</span>
            </button>
          ))}
        </section>
      )}
      {!isDetail && !error && !hasAnyActive && (
        <div className="rounded-[10px] p-10 border border-border bg-surface bg-dot-matrix text-center space-y-4">

          <p className="text-sm font-medium text-text-secondary">
            Nenhuma viagem ativa como {role === "driver" ? "motorista" : "passageiro"}.
          </p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <Link to="/find" className="no-underline">
              <Button variant="primary" size="sm">
                Pedir carona
              </Button>
            </Link>
            <Link to="/offer" className="no-underline">
              <Button variant="secondary" size="sm">
                Oferecer carona
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!isDetail && hasAnyActive && (
        <div className="space-y-2">
          {isDriver ? upcomingRides.map((ride) => (
            <RideRow key={ride.id} to={`/rides/driver/${ride.id}`} time={formatDate(ride.departure_at)}
              origin={ride.origin_label} destination={ride.destination_label}
              status={ride.status === "in_progress" ? "Em andamento" : "Ver viagem"} />
          )) : activeMatches.map((match) => (
            <RideRow key={match.id} to={`/rides/passenger/${match.id}`}
              time={match.offered_pickup_at ? formatDate(match.offered_pickup_at) : "Embarque a confirmar"}
              origin={match.pickup_label} destination={match.dropoff_label ?? match.ride.destination_label}
              status={match.status === "pending" ? "Aguardando confirmação" : "Confirmada"} />
          ))}
        </div>
      )}

      {isDetail && !error && !selectedRide && !selectedMatch && (
        <p className="text-text-muted">Esta carona não está disponível entre suas viagens ativas.</p>
      )}

      {selectedRide && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-text">
              Como motorista
            </span>
          </div>

          <div>
            {[selectedRide].map((ride) => {
              const counts = rideMatchCounts[ride.id] ?? { pending: 0, accepted: 0, passengers: [] };
              const campus = ride.campus_point ? getCampusInfo(ride.campus_point) : null;
              const mapKey = `driver-${ride.id}`;
              const isMapOpen = expandedMapId === mapKey;
              const confirmedPassengers = counts.passengers.filter((m) => m.status === "accepted")
                .sort((a, b) => Date.parse(a.estimated_pickup_at ?? a.offered_pickup_at ?? ride.departure_at)
                  - Date.parse(b.estimated_pickup_at ?? b.offered_pickup_at ?? ride.departure_at));
              const pickupStops = confirmedPassengers.flatMap((match, index) =>
                match.pickup_lat == null || match.pickup_lng == null ? [] : [{
                  id: match.id, number: index + 1, lat: match.pickup_lat, lng: match.pickup_lng,
                  label: passengerPickup(match),
                }]
              );
              const arrival = new Date(Date.parse(ride.departure_at) + ride.route_duration_seconds * 1000);

              return (
                <article
                  key={ride.id}
                  className={`rounded-[10px] p-4 sm:p-5 border bg-surface flex flex-col justify-between gap-4 ${
                    counts.pending > 0 ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase ${
                            ride.status === "full"
                              ? "bg-warning-bg text-warning-text border border-warning/40"
                              : ride.status === "in_progress"
                              ? "bg-primary/15 text-accent-text border border-primary/40"
                              : "bg-secondary/15 text-secondary border border-secondary/35"
                          }`}
                        >
                          {ride.status === "full"
                            ? "Lotada"
                            : ride.status === "in_progress"
                            ? "Em andamento"
                            : "Ativa"}
                        </span>
                        {campus && (
                          <span className="px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold border border-border bg-surface-2 text-text-secondary">
                            {campus.shortName}
                          </span>
                        )}
                      </div>

                    </div>
                    <div className="p-3 rounded-md border border-border bg-surface-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Partida · {formatDate(ride.departure_at)}
                          </span>
                          <p className="text-sm font-semibold wrap-anywhere text-text">
                            {ride.origin_label}
                          </p>
                        </div>
                      </div>
                      {confirmedPassengers.map((m, index) => {
                        const pickupAt = m.estimated_pickup_at ?? m.offered_pickup_at;
                        return (
                          <div key={m.id} className="rounded-md border border-border p-3 text-sm">
                            <p className="font-mono text-xs font-bold text-text-muted">
                              Embarque {index + 1} · {pickupAt ? formatDate(pickupAt) : "Horário a confirmar"}
                            </p>
                            <strong>{m.passenger.name ?? "Passageiro"}</strong>
                            <p>Embarque: {passengerPickup(m)}</p>
                            <p>Desembarque: {m.confirmed_dropoff_label || ride.destination_label}</p>
                            <div className="mt-2 flex flex-wrap gap-3">
                              <button type="button" className="text-accent-text underline" onClick={() => setSelectedUser(m.passenger)}>Ver perfil</button>
                              {m.passenger_phone && <a className="text-accent-text underline" href={buildWhatsAppUrl(m.passenger_phone)} target="_blank" rel="noopener noreferrer">WhatsApp · {m.passenger_phone}</a>}
                            </div>
                            <Button type="button" variant="danger" size="sm"
                              className="mt-3"
                              loading={removingMatchId === m.id}
                              disabled={removingMatchId !== null}
                              onClick={() => handleRemovePassenger(m)}>
                              Remover passageiro
                            </Button>
                          </div>
                        );
                      })}
                      <div className="flex items-start gap-2">
                        <span className="size-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Chegada prevista · {ride.route_duration_seconds > 0 ? formatDate(arrival.toISOString()) : "Horário a confirmar"}
                          </span>
                          <p className="text-sm font-semibold wrap-anywhere text-text">{ride.destination_label}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-secondary flex-wrap gap-2">
                      <SeatMeter available={ride.available_seats} total={ride.total_seats} />
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted">

                        {formatDistance(ride.route_distance_meters)} ·{" "}
                        {formatDuration(ride.route_duration_seconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedMapId(isMapOpen ? null : mapKey)}
                        className="text-xs font-semibold text-accent-text hover:underline"
                      >
                        {isMapOpen ? "Ocultar mapa" : "Ver mapa do trajeto"}
                      </button>
                    </div>

                    {isMapOpen && (
                      <div className="space-y-2">
                        {(ride.route_is_approximate || !ride.route_geojson) && (
                          <p className="text-xs text-text-muted">Trajeto aproximado</p>
                        )}
                        <InteractiveMap
                          height="360px"
                          scrollWheelZoom={false}
                          stops={pickupStops}
                          approximateRoute={ride.route_is_approximate || !ride.route_geojson}
                          origin={
                            ride.origin_lat != null && ride.origin_lng != null
                              ? { lat: ride.origin_lat, lng: ride.origin_lng, label: ride.origin_label }
                              : null
                          }
                          destination={
                            ride.destination_lat != null && ride.destination_lng != null
                              ? {
                                  lat: ride.destination_lat,
                                  lng: ride.destination_lng,
                                  label: ride.destination_label,
                                }
                              : null
                          }
                          routeGeoJson={ride.route_geojson}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={counts.accepted === 0}
                        title={
                          counts.accepted === 0
                            ? "Confirme um passageiro para liberar mensagens"
                            : "Abrir grupo da carona"
                        }
                        loading={openingChat === ride.id}
                        onClick={() => openChat(ride.id)}
                      >
                         Mensagens
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={changingRide === ride.id}
                        onClick={() => changeRideStatus(ride)}
                      >
                        {ride.status === "in_progress" ? "Concluir carona" : "Iniciar carona"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setModalRide(ride)}
                        className={`flex-1 inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition-colors ${
                          counts.pending > 0
                            ? "border-primary bg-primary/10 text-text hover:bg-primary/15"
                            : "border-border bg-surface-2 text-text-secondary hover:border-border-strong"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">

                          <span>Solicitações</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                          {counts.pending > 0 && (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-primary text-on-primary font-bold">
                              {counts.pending}
                            </span>
                          )}
                          <span className="text-text-muted">{counts.accepted} conf.</span>
                        </span>
                      </button>

                      <Button
                        variant="danger"
                        size="sm"
                        loading={cancellingId === ride.id}
                        disabled={ride.status === "in_progress"}
                        onClick={() => handleCancelRide(ride)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {selectedMatch && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-secondary">
              Como passageiro
            </span>
          </div>

          <div>
            {[selectedMatch].map((match) => {
              const confirmed = confirmedByMatchId[match.id];
              const isAccepted = match.status === "accepted";
              const isRideInProgress = match.ride.status === "in_progress";
              const driver = match.ride.driver;
              const driverPhone = confirmed?.driver_phone;
              const carModel = [confirmed?.driver_car_brand ?? driver.car_brand, confirmed?.driver_car_model ?? driver.car_model].filter(Boolean).join(" ");
              const carColor = isAccepted ? confirmed?.driver_car_color : undefined;
              const carPlate = confirmed?.driver_car_plate;
              const campus = match.ride.campus_point ? getCampusInfo(match.ride.campus_point) : null;
              const estimatedPickupIso =
                confirmed?.estimated_pickup_at ??
                confirmed?.offered_pickup_at ??
                match.offered_pickup_at;
              const estimatedPickupTime = estimatedPickupIso ? format(new Date(estimatedPickupIso), "HH:mm", {
                locale: ptBR,
              }) : "A confirmar";
              const estimatedPickupDate = estimatedPickupIso ? format(
                new Date(estimatedPickupIso),
                "dd MMM",
                { locale: ptBR }
              ) : "";
              const passengerDestinationLabel =
                match.dropoff_label || match.ride.destination_label;

              return (
                <article
                  key={match.id}
                  className={`rounded-[10px] p-4 sm:p-5 border bg-surface flex flex-col justify-between gap-4 ${
                    isAccepted ? "border-secondary/50" : "border-border"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase bg-secondary/15 text-secondary border border-secondary/35">

                          <span>{isRideInProgress ? "Em andamento" : "Confirmada"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase bg-warning-bg text-warning-text border border-warning/40">
                          Pendente
                        </span>
                      )}

                      {campus && (
                        <span className="px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold border border-border bg-surface-2 text-text-secondary">
                          {campus.shortName}
                        </span>
                      )}
                    </div>
                    <div className="p-3 rounded-md border border-border bg-surface-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
                        Embarque previsto
                      </span>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-2xl font-bold tabular-nums text-text block leading-none">
                          {estimatedPickupTime}
                        </span>
                        <span className="font-mono text-[11px] text-text-muted block mt-1">
                          {estimatedPickupDate}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-surface-2 flex items-center justify-between gap-3 flex-wrap">
                      <div
                        className="flex items-center gap-3 cursor-pointer group min-w-0"
                        onClick={() => setSelectedUser(driver)}
                      >
                        <Avatar
                          name={driver.name}
                          photoUrl={driver.photo_url}
                          rating={driver.avg_rating}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-text group-hover:text-accent-text truncate transition-colors">
                            {driver.name ?? "Motorista UFRGS"}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {driver.course ?? "Estudante UFRGS"}
                          </p>
                          {(carModel || carColor) && (
                            <p className="font-mono text-[11px] text-text-secondary mt-0.5 flex items-center gap-1">

                              <span className="truncate">
                                {carModel ?? "Veículo"}
                                {carColor ? ` · ${carColor}` : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {isAccepted && carPlate && (
                        <div className="px-2 py-1 rounded-[2px] border border-border-strong bg-surface text-right shrink-0">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-text-muted block">
                            Placa
                          </span>
                          <span className="font-mono text-xs font-bold tracking-widest text-text">
                            {carPlate}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-md border border-border bg-surface-2 space-y-2 text-xs">
                      <div className="flex items-start gap-2">

                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Embarque
                          </span>
                          <p className="text-sm font-semibold text-text wrap-anywhere">
                            {match.pickup_label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">

                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Desembarque {confirmed?.estimated_dropoff_at && <>· {formatDate(confirmed.estimated_dropoff_at)}</>}
                          </span>
                          <p className="text-sm font-semibold text-text wrap-anywhere">
                            {passengerDestinationLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isAccepted ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="primary"
                          size="sm"
                          loading={openingChat === match.ride.id}
                          onClick={() => openChat(match.ride.id)}
                        >

                          <span>Mensagens</span>
                        </Button>

                        {driverPhone && (
                          <a
                            href={buildWhatsAppUrl(
                              driverPhone,
                              `Olá ${driver.name ?? ""}! Tudo certo para o nosso encontro em "${match.pickup_label}" pelo Carona Aí?`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-secondary text-on-primary hover:opacity-90 transition-opacity no-underline"
                          >

                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-md border border-border bg-surface-2 flex items-center gap-2 text-xs text-text-muted">

                        <span>Chat e placa liberados após aceite.</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(driver)}
                      className="text-xs font-semibold text-text-muted hover:text-text hover:underline"
                    >
                      Ver perfil
                    </button>

                    <Button
                      variant="danger"
                      size="sm"
                      loading={cancellingId === match.id}
                      onClick={() => handleCancelMatch(match)}
                    >
                      {isAccepted ? "Desistir da viagem" : "Retirar pedido"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {modalRide && (
        <RideRequestsModal
          ride={modalRide}
          onClose={() => {
            setModalRide(null);
            refresh();
          }}
          onChanged={refresh}
        />
      )}

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};
