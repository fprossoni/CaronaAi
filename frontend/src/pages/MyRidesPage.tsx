import React, { useEffect, useState } from "react";
import { ridesApi } from "@/api/rides";
import type { RideDetail } from "@/types/ride";
import styles from "./MyRidesPage.module.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const MyRidesPage: React.FC = () => {
  const [rides, setRides] = useState<RideDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRides = async () => {
      try {
        // Utilizando o endpoint específico para as caronas do usuário logado
        const response = await ridesApi.getMyRides();
        setRides(response.data);
      } catch (err: unknown) {
        setError((err as Error).message || "Erro ao carregar as caronas.");
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  if (loading) return <div className={styles.loading}>Carregando caronas...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Minhas Caronas</h2>
      {rides.length === 0 ? (
        <p className={styles.emptyState}>Você ainda não possui caronas ativas.</p>
      ) : (
        <div className={styles.rideList}>
          {rides.map((ride) => (
            <div key={ride.id} className={styles.rideCard}>
              <div className={styles.rideHeader}>
                <span className={styles.rideStatus}>Ativa</span>
                <span className={styles.rideDate}>
                  {format(new Date(ride.departure_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                </span>
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
                <div>Assentos: {ride.total_seats}</div>
                <div>Tolerância: {ride.delay_tolerance_minutes} min</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
