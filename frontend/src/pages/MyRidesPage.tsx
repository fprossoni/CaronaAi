/**
 * MyRidesPage ("Minhas Caronas")
 *
 * Central dashboard for active rides (both as Driver and as Passenger):
 * - Driver View: Manage offered rides, inspect route on map, open `RideRequestsModal`
 *   to accept/reject requests, or cancel a ride.
 * - Passenger View: Track pending requests and confirmed rides (`status === "accepted"`),
 *   revealing the driver's WhatsApp contact, vehicle details, and exact pickup map point.
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
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  CheckCircleIcon,
  HistoryIcon,
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
  return format(new Date(iso), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
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
      toast.error("Não foi possível abrir as mensagens", getErrorMessage(err));
    } finally {
      setOpeningChat(null);
    }
  };

  const changeRideStatus = async (ride: RideDetail) => {
    const completing = ride.status === "in_progress";
    if (completing && !await toast.confirm({
      title: "Concluir esta carona?",
      description: "A viagem irá para o histórico e as conversas serão encerradas para todos os participantes.",
      confirmLabel: "Concluir carona",
    })) return;
    setChangingRide(ride.id);
    try {
      await (completing ? ridesApi.complete(ride.id) : ridesApi.start(ride.id));
      refresh();
      toast.info(completing ? "Carona concluída. Conversas encerradas." : "Carona iniciada.");
    } catch (err) {
      toast.error("Não foi possível atualizar a carona", getErrorMessage(err));
    } finally {
      setChangingRide(null);
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

    // Fetch confirmed details (driver phone + exact pickup coordinates) for accepted passenger matches
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

  const handleCancelRide = async (ride: RideDetail) => {
    const ok = await toast.confirm({
      title: "Cancelar esta oferta de carona?",
      description: `A viagem de ${formatDate(ride.departure_at)} (${ride.origin_label} → ${ride.destination_label}) será cancelada para todos os passageiros.`,
      confirmLabel: "Sim, cancelar carona",
      variant: "danger",
    });
    if (!ok) return;

    setCancellingId(ride.id);
    try {
      await ridesApi.cancel(ride.id);
      setRides((prev) =>
        prev.map((r) => (r.id === ride.id ? { ...r, status: "cancelled" } : r))
      );
      toast.info("Carona cancelada com sucesso.");
    } catch (err: unknown) {
      toast.error("Erro ao cancelar carona", getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelMatch = async (match: MatchWithRide) => {
    const ok = await toast.confirm({
      title: "Cancelar participação nesta carona?",
      description:
        match.status === "accepted"
          ? "Sua vaga confirmada será liberada de volta para o motorista."
          : "Sua solicitação pendente será retirada.",
      confirmLabel: "Cancelar solicitação",
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
      toast.error("Erro ao cancelar solicitação", getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-text-muted animate-pulse">
        Carregando seu painel de caronas...
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
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text">
            Minhas Caronas Ativas
          </h1>
          <p className="text-sm mt-0.5 text-text-muted">
            Acompanhe aprovações, pontos de encontro no mapa e contatos de WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/rides/history")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border border-border bg-surface text-text transition-all hover:border-indigo-500/50"
        >
          <HistoryIcon size={15} className="text-indigo-400" />
          <span>Ver Histórico & Avaliações</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!hasAnyActive && (
        <div className="rounded-3xl p-10 border border-border bg-gradient-card text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto">
            <CarIcon size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text">
              Você não tem viagens ativas no momento
            </h2>
            <p className="text-xs max-w-md mx-auto text-text-muted">
              Busque um motorista que passe perto de você ou ofereça os assentos livres do seu
              carro rumo à UFRGS.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            <Link to="/find" className="no-underline">
              <Button variant="primary" size="sm">
                Pedir Carona
              </Button>
            </Link>
            <Link to="/offer" className="no-underline">
              <Button variant="secondary" size="sm">
                Oferecer Carona
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Section 1: Active Rides as Driver */}
      {upcomingRides.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
              Como Motorista ({upcomingRides.length})
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
                  className={`rounded-3xl p-5 border bg-gradient-card flex flex-col justify-between gap-4 shadow-md ${
                    counts.pending > 0 ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ride.status === "full"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {ride.status === "full"
                            ? "Lotada"
                            : ride.status === "in_progress"
                            ? "Em andamento"
                            : "Ativa"}
                        </span>
                        {campus && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-border bg-surface-2 text-text-secondary">
                            {campus.shortName}
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-text">
                        {formatDate(ride.departure_at)}
                      </span>
                    </div>

                    {/* Route Timeline */}
                    <div className="p-3.5 rounded-2xl border border-border bg-surface-2 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block text-text-muted">
                            Saída
                          </span>
                          <p className="text-sm font-semibold truncate text-text">
                            {ride.origin_label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block text-text-muted">
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
                      <span className="inline-flex items-center gap-1.5">
                        <UsersIcon size={14} className="text-emerald-400" />
                        <strong>{ride.available_seats}</strong>/{ride.total_seats} livres
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <NavigationIcon size={13} className="text-indigo-400" />
                        {formatDistance(ride.route_distance_meters)} ·{" "}
                        {formatDuration(ride.route_duration_seconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedMapId(isMapOpen ? null : mapKey)}
                        className="text-indigo-400 font-semibold hover:underline"
                      >
                        {isMapOpen ? "Ocultar mapa" : "Ver mapa"}
                      </button>
                    </div>

                    {isMapOpen && (
                      <InteractiveMap
                        height="200px"
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
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={counts.accepted === 0}
                      title={counts.accepted === 0 ? "Confirme um passageiro para liberar as mensagens" : "Criar ou abrir o grupo da carona"}
                      loading={openingChat === ride.id} onClick={() => openChat(ride.id)}>
                      <MessageIcon size={16} /> Mensagens
                    </Button>
                    <Button variant="secondary" size="sm" loading={changingRide === ride.id} onClick={() => changeRideStatus(ride)}>
                      {ride.status === "in_progress" ? "Concluir carona" : "Iniciar carona"}
                    </Button>
                  </div>
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setModalRide(ride)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        counts.pending > 0
                          ? "bg-gradient-primary text-white"
                          : "bg-surface-2 text-text border border-border-strong"
                      }`}
                    >
                      <UsersIcon size={15} />
                      <span>
                        Solicitações ({counts.pending} pendentes • {counts.accepted} confirmados)
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
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Active Rides as Passenger */}
      {activeMatches.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              Como Passageiro ({activeMatches.length})
            </span>
            {supersededCount > 0 && (
              <span className="px-3 py-1 rounded-full text-[11px] font-medium border border-border bg-surface-2 text-text-muted">
                {supersededCount}{" "}
                {supersededCount === 1
                  ? "solicitação em lote encerrada automaticamente após confirmação"
                  : "solicitações em lote encerradas automaticamente após confirmação"}
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
                "dd 'de' MMM",
                { locale: ptBR }
              );
              const passengerDestinationLabel =
                match.dropoff_label || campus?.name || "Campus UFRGS";

              return (
                <div
                  key={match.id}
                  className={`rounded-3xl p-5 border bg-gradient-card flex flex-col justify-between gap-4 shadow-md ${
                    isAccepted ? "border-emerald-500/50" : "border-border"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircleIcon size={13} />{" "}
                          {isRideInProgress ? "Carona em andamento!" : "Carona Confirmada!"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          ⏳ Aguardando aprovação do motorista
                        </span>
                      )}

                      {campus && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-border bg-surface-2 text-text-secondary">
                          {campus.shortName}
                        </span>
                      )}
                    </div>

                    {/* Highlighted ETA at Meeting Point */}
                    <div className="p-3.5 rounded-2xl border border-border bg-surface-2 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                          Previsão no ponto de encontro
                        </span>
                        <p className="text-xs text-text-muted">
                          {isRideInProgress
                            ? "O motorista iniciou a viagem — fique atento às mensagens"
                            : isAccepted
                            ? "Horário estimado para o motorista chegar ao seu embarque"
                            : "Previsão calculada para o seu ponto de encontro"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-extrabold tabular-nums text-text block leading-none">
                          {estimatedPickupTime}
                        </span>
                        <span className="text-[11px] font-semibold text-text-muted block mt-1">
                          {estimatedPickupDate}
                        </span>
                      </div>
                    </div>

                    {/* Driver Profile Row + Vehicle Identification */}
                    <div className="p-3 rounded-2xl border border-border bg-surface-2 flex items-center justify-between gap-3 flex-wrap">
                      <div
                        className="flex items-center gap-3 cursor-pointer group min-w-0"
                        onClick={() => setSelectedUser(driver)}
                      >
                        <Avatar
                          name={driver.name}
                          photoUrl={driver.photo_url}
                          rating={driver.avg_rating}
                          size="md"
                          ring
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-text group-hover:text-indigo-400 truncate">
                            {driver.name ?? "Motorista UFRGS"}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {driver.course ?? "Estudante UFRGS"}
                          </p>
                          {(carModel || carColor) && (
                            <p className="text-[11px] font-medium text-indigo-400 mt-0.5 flex items-center gap-1 flex-wrap">
                              <CarIcon size={12} />
                              <span>
                                {carModel ?? "Veículo"}
                                {carColor ? ` • ${carColor}` : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {isAccepted && carPlate && (
                        <div className="px-2.5 py-1 rounded-lg border border-border-strong bg-surface text-right shrink-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted block">
                            Placa
                          </span>
                          <span className="font-mono text-xs font-extrabold tracking-widest text-text">
                            {carPlate}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Passenger's Own Pickup & Dropoff Summary (Driver's origin is never exposed) */}
                    <div className="p-3.5 rounded-2xl border border-border bg-surface-2 space-y-2.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <MapPinIcon size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block text-text-muted">
                            Seu ponto de encontro (Embarque)
                          </span>
                          <p className="text-sm font-semibold text-text wrap-anywhere">
                            {match.pickup_label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <NavigationIcon size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block text-text-muted">
                            Seu destino (Desembarque)
                          </span>
                          <p className="text-sm font-semibold text-text wrap-anywhere">
                            {passengerDestinationLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Communication & Messages Panel (Replaces Map View) */}
                    {isAccepted ? (
                      <div className="p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-text flex items-center gap-1.5">
                            <MessageIcon size={15} className="text-indigo-400 shrink-0" />
                            Combine o embarque com o motorista
                          </span>
                          {driverPhone && (
                            <span className="text-[11px] text-text-muted">
                              Tel.: <strong className="text-text-secondary">{driverPhone}</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          Por privacidade, a rota e o endereço de origem do motorista não são exibidos. Use o chat da carona para combinar detalhes do ponto de encontro.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={openingChat === match.ride.id}
                            onClick={() => openChat(match.ride.id)}
                          >
                            <MessageIcon size={15} />
                            <span>Abrir Mensagens da Carona</span>
                          </Button>

                          {driverPhone && (
                            <a
                              href={buildWhatsAppUrl(
                                driverPhone,
                                `Olá ${driver.name ?? ""}! Tudo certo para o nosso encontro em "${match.pickup_label}" às ${estimatedPickupTime} pelo Carona Aí?`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md no-underline"
                            >
                              <WhatsAppIcon size={14} />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl border border-border bg-surface-2 text-xs text-text-muted leading-relaxed">
                        🔒 O chat de mensagens da carona, a placa do veículo e o contato do motorista serão liberados assim que sua solicitação for aceita.
                      </div>
                    )}
                  </div>

                  {/* Passenger Footer Actions */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(driver)}
                      className="text-xs font-semibold text-text-muted hover:underline"
                    >
                      Ver perfil do motorista
                    </button>

                    <Button
                      variant="danger"
                      size="sm"
                      loading={cancellingId === match.id}
                      onClick={() => handleCancelMatch(match)}
                    >
                      {isAccepted ? "Cancelar participação" : "Retirar solicitação"}
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
