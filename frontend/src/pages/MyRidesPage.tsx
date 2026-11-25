/**
 * MyRidesPage ("Minhas Caronas")
 *
 * Active rides dashboard for Driver and Passenger roles with telemetry ETA,
 * vertical bar SeatMeter, and quick access to ride requests and messages.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import { messagesApi } from "@/api/messages";
import type { RideDetail, RideStatus } from "@/types/ride";
import type { MatchConfirmed, MatchWithRide } from "@/types/match";
import type { UserPublic } from "@/types/user";
import { RideRequestsModal } from "@/components/rides/RideRequestsModal";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { Avatar } from "@/components/ui/Avatar";
import { SeatMeter } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  CheckCircleIcon,
  HistoryIcon,
  LockIcon,
  MapPinIcon,
  MessageIcon,
  NavigationIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/ui/Icons";
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

export const MyRidesPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();

  const [rides, setRides] = useState<RideDetail[]>([]);
  const [matches, setMatches] = useState<MatchWithRide[]>([]);
  const [confirmedByMatchId, setConfirmedByMatchId] = useState<Record<number, MatchConfirmed>>({});
  const [rideMatchCounts, setRideMatchCounts] = useState<
    Record<number, { pending: number; accepted: number }>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
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

    const upcoming = ridesRes.data.filter((r) => isActiveRide(r.status));
    const countsEntries = await Promise.all(
      upcoming.map(async (r) => {
        try {
          const { data } = await matchesApi.getRideMatches(r.id);
          return [
            r.id,
            {
              pending: data.filter((m) => m.status === "pending").length,
              accepted: data.filter((m) => m.status === "accepted").length,
            },
          ] as const;
        } catch {
          return [r.id, { pending: 0, accepted: 0 }] as const;
        }
      })
    );

    const acceptedPassengerMatches = matchesRes.data.filter((m) => m.status === "accepted");
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
  }, []);

  const commit = useCallback((data: Awaited<ReturnType<typeof loadData>>) => {
    setRides(data.rides);
    setMatches(data.matches);
    setRideMatchCounts(data.rideMatchCounts);
    setConfirmedByMatchId(data.confirmedMap);
  }, []);

  useEffect(() => {
    let active = true;
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
      title: "Cancelar participação?",
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
      toast.info("Solicitação cancelada.");
    } catch (err: unknown) {
      toast.error("Erro ao cancelar", getErrorMessage(err));
    } finally {
      setCancellingId(null);
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
        new Date(a.ride.departure_at).getTime() - new Date(b.ride.departure_at).getTime()
    );

  const supersededCount = matches.filter((m) => m.status === "superseded").length;
  const hasAnyActive = upcomingRides.length > 0 || activeMatches.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">
          Minhas Caronas
        </h1>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate("/rides/history")}
        >
          <HistoryIcon size={14} className="text-accent-text" />
          <span>Histórico</span>
        </Button>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!hasAnyActive && (
        <div className="rounded-[10px] p-10 border border-border bg-surface bg-dot-matrix text-center space-y-4">
          <div className="w-12 h-12 rounded-md border border-border-strong bg-surface-2 text-accent-text flex items-center justify-center mx-auto">
            <CarIcon size={22} />
          </div>
          <p className="text-sm font-medium text-text-secondary">
            Nenhuma viagem ativa no momento.
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

      {/* Section 1: Active Rides as Driver */}
      {upcomingRides.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-text">
              Como motorista · {upcomingRides.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingRides.map((ride) => {
              const counts = rideMatchCounts[ride.id] ?? { pending: 0, accepted: 0 };
              const campus = ride.campus_point ? getCampusInfo(ride.campus_point) : null;
              const mapKey = `driver-${ride.id}`;
              const isMapOpen = expandedMapId === mapKey;

              return (
                <div
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

                      <span className="font-mono text-xs font-semibold text-text">
                        {formatDate(ride.departure_at)}
                      </span>
                    </div>

                    {/* Route Block */}
                    <div className="p-3 rounded-md border border-border bg-surface-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Saída
                          </span>
                          <p className="text-sm font-semibold truncate text-text">
                            {ride.origin_label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="size-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Destino
                          </span>
                          <p className="text-sm font-semibold truncate text-text">
                            {ride.destination_label}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between text-xs text-text-secondary flex-wrap gap-2">
                      <SeatMeter available={ride.available_seats} total={ride.total_seats} />
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted">
                        <NavigationIcon size={12} className="text-accent-text" />
                        {formatDistance(ride.route_distance_meters)} ·{" "}
                        {formatDuration(ride.route_duration_seconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedMapId(isMapOpen ? null : mapKey)}
                        className="text-xs font-semibold text-accent-text hover:underline"
                      >
                        {isMapOpen ? "Ocultar mapa" : "Ver mapa"}
                      </button>
                    </div>

                    {isMapOpen && (
                      <InteractiveMap
                        height="190px"
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
                    )}
                  </div>

                  {/* Driver Actions */}
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
                        <MessageIcon size={14} /> Mensagens
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
                          <UsersIcon size={14} />
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Active Rides as Passenger */}
      {activeMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-secondary">
              Como passageiro · {activeMatches.length}
            </span>
            {supersededCount > 0 && (
              <span className="px-2 py-0.5 rounded-[2px] font-mono text-[11px] border border-border bg-surface-2 text-text-muted">
                {supersededCount} encerrada(s) no lote
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMatches.map((match) => {
              const confirmed = confirmedByMatchId[match.id];
              const isAccepted = match.status === "accepted";
              const isRideInProgress = match.ride.status === "in_progress";
              const driver = match.ride.driver;
              const driverPhone = confirmed?.driver_phone;
              const carModel = confirmed?.driver_car_model ?? driver.car_model;
              const carColor = confirmed?.driver_car_color ?? driver.car_color;
              const carPlate = confirmed?.driver_car_plate;
              const campus = match.ride.campus_point ? getCampusInfo(match.ride.campus_point) : null;
              const estimatedPickupIso =
                confirmed?.offered_pickup_at ??
                match.offered_pickup_at ??
                match.desired_pickup_at ??
                match.ride.departure_at;
              const estimatedPickupTime = format(new Date(estimatedPickupIso), "HH:mm", {
                locale: ptBR,
              });
              const estimatedPickupDate = format(
                new Date(estimatedPickupIso),
                "dd MMM",
                { locale: ptBR }
              );
              const passengerDestinationLabel =
                match.dropoff_label || campus?.name || "Campus UFRGS";

              return (
                <div
                  key={match.id}
                  className={`rounded-[10px] p-4 sm:p-5 border bg-surface flex flex-col justify-between gap-4 ${
                    isAccepted ? "border-secondary/50" : "border-border"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase bg-secondary/15 text-secondary border border-secondary/35">
                          <CheckCircleIcon size={12} />
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

                    {/* Telemetry ETA Block */}
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

                    {/* Driver Profile Row */}
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
                              <CarIcon size={11} className="text-accent-text shrink-0" />
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

                    {/* Pickup & Dropoff */}
                    <div className="p-3 rounded-md border border-border bg-surface-2 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <MapPinIcon size={14} className="text-primary shrink-0 mt-0.5" />
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
                        <NavigationIcon size={14} className="text-secondary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold uppercase block text-text-muted">
                            Destino
                          </span>
                          <p className="text-sm font-semibold text-text wrap-anywhere">
                            {passengerDestinationLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Communication */}
                    {isAccepted ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="primary"
                          size="sm"
                          loading={openingChat === match.ride.id}
                          onClick={() => openChat(match.ride.id)}
                        >
                          <MessageIcon size={14} />
                          <span>Mensagens</span>
                        </Button>

                        {driverPhone && (
                          <a
                            href={buildWhatsAppUrl(
                              driverPhone,
                              `Olá ${driver.name ?? ""}! Tudo certo para o nosso encontro em "${match.pickup_label}" às ${estimatedPickupTime} pelo Carona Aí?`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-secondary text-on-primary hover:opacity-90 transition-opacity no-underline"
                          >
                            <WhatsAppIcon size={13} />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-md border border-border bg-surface-2 flex items-center gap-2 text-xs text-text-muted">
                        <LockIcon size={13} className="shrink-0" />
                        <span>Chat e placa liberados após aceite.</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
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
                      {isAccepted ? "Cancelar vaga" : "Retirar pedido"}
                    </Button>
                  </div>
                </div>
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
