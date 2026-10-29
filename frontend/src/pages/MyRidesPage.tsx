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
  ClockIcon,
  HistoryIcon,
  MapPinIcon,
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
      <div className="py-16 text-center text-sm animate-pulse" style={{ color: "var(--color-text-muted)" }}>
        Carregando seu painel de caronas...
      </div>
    );
  }

  const upcomingRides = rides
    .filter((r) => isActiveRide(r.status))
    .sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());

  const activeMatches = matches
    .filter((m) => m.status === "pending" || m.status === "accepted")
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
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Minhas Caronas Ativas
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Acompanhe aprovações, pontos de encontro no mapa e contatos de WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/rides/history")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all hover:border-indigo-500/50"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
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
        <div
          className="rounded-3xl p-10 border text-center space-y-4"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto">
            <CarIcon size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Você não tem viagens ativas no momento
            </h2>
            <p className="text-xs max-w-md mx-auto" style={{ color: "var(--color-text-muted)" }}>
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
              const campus = getCampusInfo(ride.campus_point);
              const mapKey = `driver-${ride.id}`;
              const isMapOpen = expandedMapId === mapKey;

              return (
                <div
                  key={ride.id}
                  className="rounded-3xl p-5 border flex flex-col justify-between gap-4 shadow-md"
                  style={{
                    background: "var(--gradient-card)",
                    borderColor:
                      counts.pending > 0 ? "var(--color-primary)" : "var(--color-border)",
                  }}
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
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                          style={{
                            backgroundColor: "var(--color-surface-2)",
                            borderColor: "var(--color-border)",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {campus.shortName}
                        </span>
                      </div>

                      <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                        {formatDate(ride.departure_at)}
                      </span>
                    </div>

                    {/* Route Timeline */}
                    <div
                      className="p-3.5 rounded-2xl border space-y-2.5"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block" style={{ color: "var(--color-text-muted)" }}>
                            Saída
                          </span>
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                            {ride.origin_label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase block" style={{ color: "var(--color-text-muted)" }}>
                            Destino
                          </span>
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                            {ride.destination_label}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2" style={{ color: "var(--color-text-secondary)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        <UsersIcon size={14} className="text-emerald-400" />
                        <strong>{ride.available_seats}</strong>/{ride.total_seats} livres
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon size={14} /> ±{ride.delay_tolerance_minutes} min
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
                  <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--color-border)" }}>
                    <button
                      type="button"
                      onClick={() => setModalRide(ride)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background:
                          counts.pending > 0 ? "var(--gradient-primary)" : "var(--color-surface-2)",
                        color: counts.pending > 0 ? "#ffffff" : "var(--color-text)",
                        border:
                          counts.pending > 0 ? "none" : "1px solid var(--color-border-strong)",
                      }}
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
              <span
                className="px-3 py-1 rounded-full text-[11px] font-medium border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
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
              const driver = match.ride.driver;
              const driverPhone = confirmed?.driver_phone;
              const mapKey = `passenger-${match.id}`;
              const isMapOpen = expandedMapId === mapKey || isAccepted;

              return (
                <div
                  key={match.id}
                  className="rounded-3xl p-5 border flex flex-col justify-between gap-4 shadow-md"
                  style={{
                    background: "var(--gradient-card)",
                    borderColor: isAccepted
                      ? "rgba(16, 185, 129, 0.5)"
                      : "var(--color-border)",
                  }}
                >
                  <div className="space-y-3.5">
                    {/* Status & Departure */}
                    <div className="flex items-center justify-between gap-2">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircleIcon size={13} /> Carona Confirmada!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          ⏳ Aguardando aprovação do motorista
                        </span>
                      )}

                      <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                        {formatDate(match.ride.departure_at)}
                      </span>
                    </div>

                    {/* Driver Profile Row + Direct WhatsApp Button */}
                    <div
                      className="p-3 rounded-2xl border flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setSelectedUser(driver)}
                      >
                        <Avatar
                          name={driver.name}
                          photoUrl={driver.photo_url}
                          rating={driver.avg_rating}
                          size="md"
                          ring
                        />
                        <div>
                          <p className="font-bold text-sm group-hover:text-indigo-400" style={{ color: "var(--color-text)" }}>
                            {driver.name ?? "Motorista UFRGS"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {driver.course ?? "Estudante UFRGS"}
                          </p>
                          {driver.car_model && (
                            <p className="text-[11px] font-medium text-indigo-400 mt-0.5 flex items-center gap-1">
                              <CarIcon size={12} />
                              {driver.car_model}
                              {driver.car_color ? ` • ${driver.car_color}` : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      {isAccepted && driverPhone && (
                        <a
                          href={buildWhatsAppUrl(
                            driverPhone,
                            `Olá ${driver.name ?? ""}! Tudo certo para a nossa carona no Carona Aí (${match.ride.origin_label} → ${match.ride.destination_label})?`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md shrink-0"
                        >
                          <WhatsAppIcon size={15} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {/* Route & Pickup Point Summary */}
                    <div
                      className="p-3.5 rounded-2xl border space-y-2 text-xs"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate" style={{ color: "var(--color-text)" }}>
                          <strong>Rota do motorista:</strong> {match.ride.origin_label} →{" "}
                          {match.ride.destination_label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon size={14} className="text-amber-400 shrink-0" />
                        <span className="truncate" style={{ color: "var(--color-text)" }}>
                          <strong>Seu ponto de encontro:</strong> {match.pickup_label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1" style={{ color: "var(--color-text-muted)" }}>
                        <span>
                          Desvio calculado: <strong>+{formatDistance(match.detour_meters)}</strong>
                        </span>
                        {isAccepted && driverPhone && (
                          <span>
                            Tel. Motorista: <strong>{driverPhone}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Map showing exact pickup point once confirmed */}
                    {isMapOpen && confirmed?.pickup_lat != null && confirmed?.pickup_lng != null && (
                      <InteractiveMap
                        height="190px"
                        origin={
                          match.ride.origin_lat != null && match.ride.origin_lng != null
                            ? {
                                lat: match.ride.origin_lat,
                                lng: match.ride.origin_lng,
                                label: match.ride.origin_label,
                              }
                            : null
                        }
                        destination={
                          match.ride.destination_lat != null && match.ride.destination_lng != null
                            ? {
                                lat: match.ride.destination_lat,
                                lng: match.ride.destination_lng,
                                label: match.ride.destination_label,
                              }
                            : null
                        }
                        pickup={{
                          lat: confirmed.pickup_lat,
                          lng: confirmed.pickup_lng,
                          label: match.pickup_label,
                        }}
                        pickupIsApproximate={false}
                        routeGeoJson={match.ride.route_geojson}
                      />
                    )}
                  </div>

                  {/* Passenger Actions */}
                  <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--color-border)" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(driver)}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: "var(--color-text-muted)" }}
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