import React from "react";
import type { RidePublic } from "@/types/ride";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PublicProfileInfo } from "@/components/profile/PublicProfileInfo";
import { UFRGS_CAMPUS } from "@/types/ride";
import styles from "./RideCard.module.css";

interface RideCardProps {
  ride: RidePublic;
  onRequestMatch?: (ride: RidePublic) => void;
  onViewDetails?: (ride: RidePublic) => void;
  /** Multi-select "matching" mode (passenger search list). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (ride: RidePublic) => void;
  /** Position in the list ordered by smallest detour (1-based). */
  rank?: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onRequestMatch,
  onViewDetails,
  selectable,
  selected,
  onToggleSelect,
  rank,
}) => {
  const campusLabel = UFRGS_CAMPUS.find((c) => c.id === ride.campus_point)?.name ?? ride.campus_point;
  void campusLabel; // used in future map tooltip

  const requested = ride.my_match_status ?? null;
  const canSelect = selectable && !requested && !!onToggleSelect;
  const cardClass = [
    styles.card,
    selected ? styles.selected : "",
    requested === "pending" ? styles.requested : "",
    requested === "accepted" ? styles.confirmed : "",
  ].join(" ");

  const handleCardClick = canSelect
    ? () => onToggleSelect?.(ride)
    : onViewDetails
      ? () => onViewDetails(ride)
      : undefined;

  return (
    <Card className={cardClass} onClick={handleCardClick}>
      <CardBody>
        {/* Driver info */}
        <div className={styles.driverRow}>
          {canSelect && (
            <span className={[styles.checkbox, selected ? styles.checkboxOn : ""].join(" ")} aria-hidden>
              {selected ? "✓" : ""}
            </span>
          )}
          <Avatar
            name={ride.driver.name}
            photoUrl={ride.driver.photo_url}
            rating={ride.driver.avg_rating}
            size="md"
          />
          <div className={styles.driverText}>
            <p className={styles.driverName}>
              {ride.driver.name ?? "Motorista"}
              {ride.driver.age != null && <span className={styles.driverAge}>, {ride.driver.age}</span>}
            </p>
            <p className={styles.driverCourse}>{ride.driver.course ?? ""}</p>
          </div>
          <div className={styles.badges}>
            {rank === 1 && <span className={styles.bestBadge}>✦ Menor desvio</span>}
            {ride.women_only && (
              <span className={styles.badge}>♀ Só Mulheres</span>
            )}
          </div>
        </div>

        <div className={styles.profileInfo}>
          <PublicProfileInfo user={ride.driver} />
        </div>

        {/* Route */}
        <div className={styles.route}>
          <div className={styles.routePoint}>
            <span className={styles.dot} style={{ background: "var(--color-secondary)" }} />
            <span className={styles.routeLabel}>{ride.origin_label}</span>
          </div>
          <div className={styles.routeLine} />
          <div className={styles.routePoint}>
            <span className={styles.dot} style={{ background: "var(--color-primary)" }} />
            <span className={styles.routeLabel}>{ride.destination_label}</span>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statIcon}>🕐</span>
            <div>
              <p className={styles.statLabel}>Partida</p>
              <p className={styles.statValue}>{formatDate(ride.departure_at)} às {formatTime(ride.departure_at)}</p>
            </div>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>💺</span>
            <div>
              <p className={styles.statLabel}>Vagas</p>
              <p className={styles.statValue}>{ride.available_seats} de {ride.total_seats}</p>
            </div>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>🗺️</span>
            <div>
              <p className={styles.statLabel}>Rota</p>
              <p className={styles.statValue}>{formatDistance(ride.route_distance_meters)} · {formatDuration(ride.route_duration_seconds)}</p>
            </div>
          </div>
          {ride.detour_meters !== undefined && (
            <div className={styles.stat}>
              <span className={styles.statIcon}>↪️</span>
              <div>
                <p className={styles.statLabel}>Desvio</p>
                <p className={styles.statValue} style={{ color: ride.detour_meters < 1000 ? "var(--color-secondary)" : "var(--color-warning)" }}>
                  +{formatDistance(ride.detour_meters)} · +{formatDuration(ride.detour_seconds ?? 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardBody>

      {requested && (
        <CardFooter>
          <div className={requested === "accepted" ? styles.statusConfirmed : styles.statusPending}>
            {requested === "accepted"
              ? "✓ Match confirmado com este motorista"
              : "⏳ Matching enviado — aguardando o motorista"}
          </div>
        </CardFooter>
      )}

      {!requested && canSelect && (
        <CardFooter>
          <Button
            variant={selected ? "secondary" : "primary"}
            size="sm"
            fullWidth
            id={`ride-${ride.id}-toggle-match`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(ride);
            }}
          >
            {selected ? "✓ Selecionada — toque para remover" : "💜 Dar matching"}
          </Button>
        </CardFooter>
      )}

      {!requested && !selectable && onRequestMatch && (
        <CardFooter>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              onRequestMatch(ride);
            }}
          >
            Solicitar Carona
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
