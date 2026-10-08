import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import type { TripHistory } from "@/types/ride";
import { Avatar } from "@/components/ui/Avatar";
import { getErrorMessage } from "@/lib/errors";
import styles from "./HistoryPage.module.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(iso: string): string {
  return format(new Date(iso), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    ridesApi
      .getHistory()
      .then(({ data }) => {
        if (active) setTrips(data);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err, "Erro ao carregar o histórico."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleReport = (person: string) => {
    alert(`Denúncia contra "${person}": em breve você poderá registrar com detalhes.`);
  };

  if (loading) return <div className={styles.loading}>Carregando histórico...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const asDriver = trips.filter((t) => t.role === "driver");
  const asPassenger = trips.filter((t) => t.role === "passenger");
  const hasAny = asDriver.length > 0 || asPassenger.length > 0;

  return (
    <div className={styles.page}>
      <button type="button" className={styles.backBtn} onClick={() => navigate("/rides")}>
        ← Voltar para Caronas
      </button>

      <h2 className={styles.title}>Histórico de Caronas</h2>

      {!hasAny && <p className={styles.emptyState}>Nenhuma carona no histórico ainda.</p>}

      {asDriver.length > 0 && (
        <>
          <p className={styles.groupLabel}>Caronas como Motorista</p>
          <div className={styles.tripList}>
            {asDriver.map((trip) => (
              <TripCard key={`d-${trip.ride_id}`} trip={trip} onReport={handleReport} />
            ))}
          </div>
        </>
      )}

      {asPassenger.length > 0 && (
        <>
          <p className={styles.groupLabel}>Caronas como Passageiro</p>
          <div className={styles.tripList}>
            {asPassenger.map((trip) => (
              <TripCard key={`p-${trip.ride_id}`} trip={trip} onReport={handleReport} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface TripCardProps {
  trip: TripHistory;
  onReport: (person: string) => void;
}

const TripCard: React.FC<TripCardProps> = ({ trip, onReport }) => {
  const statusLabel = trip.status === "completed" ? "Concluída" : "Cancelada";

  return (
    <div className={styles.tripCard}>
      <div className={styles.tripHeader}>
        <span className={trip.status === "completed" ? styles.badgeCompleted : styles.badgeCancelled}>
          {statusLabel}
        </span>
        <span className={styles.tripDate}>{formatDate(trip.departure_at)}</span>
      </div>

      <div className={styles.tripRoute}>
        <div className={styles.routeItem}>
          <div className={styles.routeIcon}>🔵</div>
          <div className={styles.routeText}>{trip.origin_label}</div>
        </div>
        <div className={styles.routeLine} />
        <div className={styles.routeItem}>
          <div className={styles.routeIcon}>📍</div>
          <div className={styles.routeText}>{trip.destination_label}</div>
        </div>
      </div>

      <div className={styles.participants}>
        <p className={styles.participantsLabel}>Participantes nesta carona</p>
        {trip.participants.length === 0 ? (
          <p className={styles.noParticipants}>Nenhum outro participante registrado.</p>
        ) : (
          trip.participants.map((p) => (
            <div key={p.id} className={styles.participantRow}>
              <Avatar
                name={p.name}
                photoUrl={p.photo_url}
                rating={p.avg_rating}
                size="sm"
              />
              <div className={styles.participantInfo}>
                <p className={styles.participantName}>
                  {p.name ?? "Usuário"}
                  <span className={p.role === "driver" ? styles.roleDriver : styles.rolePassenger}>
                    {p.role === "driver" ? "Motorista" : "Passageiro"}
                  </span>
                </p>
                <p className={styles.participantMeta}>{p.course ?? "Curso não informado"}</p>
              </div>
              <button
                type="button"
                className={styles.reportBtn}
                onClick={() => onReport(p.name ?? "usuário")}
              >
                Denunciar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};