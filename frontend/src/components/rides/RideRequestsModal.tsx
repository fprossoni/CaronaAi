import React, { useCallback, useEffect, useState } from "react";
import type { RideDetail } from "@/types/ride";
import type { MatchForDriver } from "@/types/match";
import { matchesApi } from "@/api/matches";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { getErrorMessage } from "@/lib/errors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import styles from "./RideRequestsModal.module.css";

interface RideRequestsModalProps {
  ride: RideDetail;
  onClose: () => void;
  onChanged: () => void;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `+${(meters / 1000).toFixed(1)} km` : `+${Math.round(meters)} m`;
}

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm", { locale: ptBR });
}

export const RideRequestsModal: React.FC<RideRequestsModalProps> = ({ ride, onClose, onChanged }) => {
  const [requests, setRequests] = useState<MatchForDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await matchesApi.getRideMatches(ride.id);
    return data;
  }, [ride.id]);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setRequests(data);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err, "Erro ao carregar as solicitações."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const handleRespond = async (matchId: number, action: "accept" | "reject") => {
    setActingId(matchId);
    try {
      await matchesApi.respond(matchId, action);
      onChanged();
      const data = await load();
      setRequests(data);
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Erro ao processar a solicitação."));
    } finally {
      setActingId(null);
    }
  };

  const pending = requests.filter((m) => m.status === "pending");
  const accepted = requests.filter((m) => m.status === "accepted");
  const noSeats = ride.available_seats <= 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Solicitações</h3>
            <p className={styles.subtitle}>
              {ride.origin_label} → {ride.destination_label}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {loading && <p className={styles.message}>Carregando solicitações...</p>}

        {!loading && requests.length === 0 && (
          <p className={styles.message}>Nenhuma solicitação para esta carona.</p>
        )}

        {pending.length > 0 && (
          <>
            <p className={styles.groupLabel}>Aguardando resposta</p>
            <div className={styles.list}>
              {pending.map((m) => (
                <div key={m.id} className={styles.requestCard}>
                  <div className={styles.requestRow}>
                    <Avatar
                      name={m.passenger.name}
                      photoUrl={m.passenger.photo_url}
                      rating={m.passenger.avg_rating}
                      size="md"
                    />
                    <div className={styles.requestInfo}>
                      <p className={styles.passengerName}>{m.passenger.name ?? "Passageiro"}</p>
                      <p className={styles.passengerMeta}>
                        {m.passenger.course ?? "Curso não informado"}
                      </p>
                      <p className={styles.passengerMeta}>
                        📍 {m.pickup_region} · {formatDistance(m.detour_meters)} de desvio
                      </p>
                      <p className={styles.passengerMeta}>
                        Solicitou às {formatTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={actingId === m.id}
                      disabled={noSeats || actingId !== null}
                      onClick={() => handleRespond(m.id, "accept")}
                    >
                      Aceitar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actingId !== null}
                      onClick={() => handleRespond(m.id, "reject")}
                    >
                      Recusar
                    </Button>
                  </div>
                  {noSeats && <p className={styles.hint}>Carona com todos os assentos preenchidos.</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {accepted.length > 0 && (
          <>
            <p className={styles.groupLabel}>Confirmados</p>
            <div className={styles.list}>
              {accepted.map((m) => (
                <div key={m.id} className={[styles.requestCard, styles.acceptedCard].join(" ")}>
                  <div className={styles.requestRow}>
                    <Avatar
                      name={m.passenger.name}
                      photoUrl={m.passenger.photo_url}
                      rating={m.passenger.avg_rating}
                      size="md"
                    />
                    <div className={styles.requestInfo}>
                      <p className={styles.passengerName}>
                        {m.passenger.name ?? "Passageiro"}
                        <span className={styles.confirmedBadge}>✓ Confirmado</span>
                      </p>
                      <p className={styles.passengerMeta}>
                        {m.passenger.course ?? "Curso não informado"}
                      </p>
                      <p className={styles.passengerMeta}>📍 {m.pickup_region}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};