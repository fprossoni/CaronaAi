import React, { useCallback, useEffect, useState } from "react";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import type { RideDetail, RideStatus } from "@/types/ride";
import type { MatchWithRide } from "@/types/match";
import { RideRequestsModal } from "@/components/rides/RideRequestsModal";
import { getErrorMessage } from "@/lib/errors";
import styles from "./MyRidesPage.module.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTIVE_RIDE_STATUSES: RideStatus[] = ["active", "full", "in_progress"];

function isActiveRide(status: RideStatus): boolean {
  return ACTIVE_RIDE_STATUSES.includes(status);
}

const MATCH_STATUS_INFO: Record<string, { label: string; badge: string }> = {
  pending: { label: "Aguardando resposta", badge: styles.badgePending },
  accepted: { label: "Confirmada", badge: styles.badgeConfirmed },
  rejected: { label: "Recusada", badge: styles.badgeRejected },
  cancelled: { label: "Cancelada", badge: styles.badgeRejected },
};

function formatDate(iso: string): string {
  return format(new Date(iso), "dd 'de' MMMM, HH:mm", { locale: ptBR });
}

export const MyRidesPage: React.FC = () => {
  const [rides, setRides] = useState<RideDetail[]>([]);
  const [matches, setMatches] = useState<MatchWithRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({});
  const [modalRide, setModalRide] = useState<RideDetail | null>(null);

  const loadData = useCallback(async () => {
    const [ridesRes, matchesRes] = await Promise.all([
      ridesApi.getMyRides(),
      matchesApi.getMyMatches(),
    ]);

    const upcoming = ridesRes.data.filter((r) => isActiveRide(r.status));
    const counts = await Promise.all(
      upcoming.map(async (r) => {
        try {
          const { data } = await matchesApi.getRideMatches(r.id);
          return [r.id, data.filter((m) => m.status === "pending").length] as const;
        } catch {
          return [r.id, 0] as const;
        }
      })
    );

    return {
      rides: ridesRes.data,
      matches: matchesRes.data,
      pendingCounts: Object.fromEntries(counts),
    };
  }, []);

  const commit = useCallback(
    (data: Awaited<ReturnType<typeof loadData>>) => {
      setRides(data.rides);
      setMatches(data.matches);
      setPendingCounts(data.pendingCounts);
    },
    []
  );

  useEffect(() => {
    let active = true;
    loadData()
      .then((data) => {
        if (active) commit(data);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err, "Erro ao carregar as caronas."));
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
        setError(getErrorMessage(err, "Erro ao carregar as caronas."));
      });
  }, [loadData, commit]);

  const handleCancelRide = async (ride: RideDetail) => {
    if (!window.confirm(`Cancelar a carona de ${formatDate(ride.departure_at)}?`)) return;
    setCancellingId(ride.id);
    try {
      await ridesApi.cancel(ride.id);
      setRides((prev) => prev.map((r) => (r.id === ride.id ? { ...r, status: "cancelled" } : r)));
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Erro ao cancelar a carona."));
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelMatch = async (match: MatchWithRide) => {
    if (!window.confirm("Cancelar esta solicitação/carona como passageiro?")) return;
    setCancellingId(match.id);
    try {
      await matchesApi.cancel(match.id);
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, status: "cancelled" } : m)));
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Erro ao cancelar a solicitação."));
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>Carregando caronas...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const upcomingRides = rides
    .filter((r) => isActiveRide(r.status))
    .sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());

  const activeMatches = matches
    .filter((m) => m.status === "pending" || m.status === "accepted")
    .sort((a, b) => new Date(a.ride.departure_at).getTime() - new Date(b.ride.departure_at).getTime());

  const hasAnyActive = upcomingRides.length > 0 || activeMatches.length > 0;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Caronas</h2>

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Ativas</span>
      </div>

      {!hasAnyActive && (
        <p className={styles.emptyState}>Você ainda não possui caronas ativas.</p>
      )}

      {upcomingRides.length > 0 && (
        <>
          <p className={styles.groupLabel}>🚗 Dirigindo</p>
          <div className={styles.rideList}>
            {upcomingRides.map((ride) => (
              <div key={ride.id} className={styles.rideCard}>
                <div className={styles.rideHeader}>
                  <span className={styles.badgeActive}>
                    {ride.status === "in_progress" ? "Em andamento" : "Ativa"}
                  </span>
                  <span className={styles.rideDate}>{formatDate(ride.departure_at)}</span>
                </div>
                <div className={styles.rideRoute}>
                  <div className={styles.routeItem}>
                    <div className={styles.routeIcon}>🔵</div>
                    <div className={styles.routeText}>{ride.origin_label}</div>
                  </div>
                  <div className={styles.routeLine} />
                  <div className={styles.routeItem}>
                    <div className={styles.routeIcon}>📍</div>
                    <div className={styles.routeText}>{ride.destination_label}</div>
                  </div>
                </div>
                <div className={styles.rideDetails}>
                  <div>Assentos: {ride.available_seats}/{ride.total_seats}</div>
                  <div>Tolerância: {ride.delay_tolerance_minutes} min</div>
                </div>
                <div className={styles.rideActions}>
                  <button
                    type="button"
                    className={styles.requestsBtn}
                    onClick={() => setModalRide(ride)}
                  >
                    👥 Solicitações ({pendingCounts[ride.id] ?? 0})
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    disabled={cancellingId === ride.id}
                    onClick={() => handleCancelRide(ride)}
                  >
                    {cancellingId === ride.id ? "Cancelando..." : "Cancelar carona"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeMatches.length > 0 && (
        <>
          <p className={styles.groupLabel}>🧑‍🤝‍🧑 Como passageiro</p>
          <div className={styles.rideList}>
            {activeMatches.map((match) => {
              const info = MATCH_STATUS_INFO[match.status] ?? MATCH_STATUS_INFO.pending;
              return (
                <div key={match.id} className={styles.rideCard}>
                  <div className={styles.rideHeader}>
                    <span className={info.badge}>{info.label}</span>
                    <span className={styles.rideDate}>{formatDate(match.ride.departure_at)}</span>
                  </div>
                  <div className={styles.rideRoute}>
                    <div className={styles.routeItem}>
                      <div className={styles.routeIcon}>🔵</div>
                      <div className={styles.routeText}>{match.ride.origin_label}</div>
                    </div>
                    <div className={styles.routeLine} />
                    <div className={styles.routeItem}>
                      <div className={styles.routeIcon}>📍</div>
                      <div className={styles.routeText}>{match.ride.destination_label}</div>
                    </div>
                  </div>
                  <div className={styles.rideDetails}>
                    <div>Motorista: {match.ride.driver.name ?? "Anônimo"}</div>
                    <div>Desvio: {(match.detour_meters / 1000).toFixed(1)} km</div>
                  </div>
                  <div className={styles.rideActions}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      disabled={cancellingId === match.id}
                      onClick={() => handleCancelMatch(match)}
                    >
                      {cancellingId === match.id ? "Cancelando..." : "Cancelar solicitação"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
    </div>
  );
};