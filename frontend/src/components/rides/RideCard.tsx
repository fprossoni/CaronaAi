/**
 * RideCard Component
 *
 * Combines BlaBlaCar/Uber route & detour clarity with Instagram/LinkedIn
 * academic social trust (clickable driver profile, course, rating, and vehicle badge).
 */

import React, { useState } from "react";
import type { RideSearchResult } from "@/types/ride";
import type { MatchStatus } from "@/types/match";
import { formatDistance, formatDuration, getCampusInfo } from "@/lib/formatters";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  ClockIcon,
  GraduationCapIcon,
  MapPinIcon,
  NavigationIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { InteractiveMap, type MapPoint } from "@/components/map/InteractiveMap";
import { UserProfileModal } from "@/components/users/UserProfileModal";

interface RideCardProps {
  ride: RideSearchResult;
  onRequestMatch?: (ride: RideSearchResult) => void;
  isRequesting?: boolean;
  existingMatchStatus?: MatchStatus | null;
  passengerPickup?: MapPoint | null;
  passengerDropoff?: MapPoint | null;
  /** Optional Multi-Matching batch selection support */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (rideId: number) => void;
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onRequestMatch,
  isRequesting = false,
  existingMatchStatus = null,
  passengerPickup = null,
  passengerDropoff = null,
  selectable = false,
  selected = false,
  onToggleSelect,
}) => {
  const [showMap, setShowMap] = useState(true);
  const [showDriverProfile, setShowDriverProfile] = useState(false);

  const campus = ride.campus_point ? getCampusInfo(ride.campus_point) : null;
  const driverName = ride.driver.name ?? "Motorista UFRGS";
  const completedRides = ride.driver_completed_ride_count;
  const rating = ride.driver.avg_rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const showDetour = !!(passengerPickup && passengerDropoff);
  const comparisonRoute = showDetour && (!ride.detour_geojson || ride.detour_meters || ride.detour_seconds) ? ride.route_geojson : null;
  const isLowDetour = (ride.detour_meters ?? 0) <= 1200;
  const resolvedMatchStatus = existingMatchStatus ?? ride.my_match_status ?? null;
  const canSelectForBatch =
    selectable && !resolvedMatchStatus && ride.available_seats > 0 && Boolean(onToggleSelect);

  return (
    <>
      <div
        className="rounded-3xl border p-5 transition-all hover:shadow-xl animate-fade-in"
        style={{
          background: "var(--gradient-card)",
          borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
          boxShadow: selected
            ? "0 0 0 2px rgba(99, 102, 241, 0.35), var(--shadow-sm)"
            : "var(--shadow-sm)",
        }}
      >
        {/* Top Row: Social Driver Header + Detour / Badges */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar
              name={ride.driver.name}
              photoUrl={ride.driver.photo_url}
              size="md"
              ring
            />
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-sm font-bold text-[var(--color-text)]">{driverName}</h3>
              <p className="flex items-start gap-1 text-xs text-[var(--color-text-muted)]">
                <GraduationCapIcon size={13} className="text-indigo-400 shrink-0" />
                <span className="break-words">{ride.driver.course || "Curso não informado"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-1" title={`${ride.driver.rating_count} avaliações`}>
                  <StarIcon size={13} filled className="text-amber-400" />
                  {ride.driver.rating_count ? `Nota ${rating} de 5` : "Sem avaliações"}
                </span>
                <span>{completedRides} {completedRides === 1 ? "viagem concluída" : "viagens concluídas"}</span>
              </div>
              <button type="button" onClick={() => setShowDriverProfile(true)}
                aria-label={`Ver perfil de ${driverName}`} className="text-xs font-semibold text-[var(--color-primary-light)] hover:underline">
                Ver perfil
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {ride.detour_meters !== undefined && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                  isLowDetour
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}
                title="Acréscimo estimado na rota original do motorista"
              >
                <NavigationIcon size={11} />
                ≈ +{formatDistance(ride.detour_meters)} · +{formatDuration(ride.detour_seconds ?? 0)}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              {ride.women_only && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  ♀ Só Mulheres
                </span>
              )}
              {campus && (
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
              )}
            </div>
          </div>
        </div>

        {/* Middle Section: BlaBlaCar / Uber Vertical Route Timeline */}
        <div
          className="mt-4 p-3.5 rounded-2xl border flex items-stretch gap-3.5"
          style={{
            backgroundColor: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Departure Time Column */}
          <div className="flex flex-col justify-between items-end pr-3 border-r min-w-[74px]" style={{ borderColor: "var(--color-border)" }}>
            <div className="text-right">
              <span className="text-base font-extrabold block leading-tight" style={{ color: "var(--color-text)" }}>
                {formatTime(ride.departure_at)}
              </span>
              <span className="text-[11px] capitalize block" style={{ color: "var(--color-text-muted)" }}>
                Saída · {formatDateShort(ride.departure_at)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium block text-indigo-400">
                ~{formatDuration(ride.route_duration_seconds)}
              </span>
              <span className="text-[10px] block" style={{ color: "var(--color-text-muted)" }}>
                {formatDistance(ride.route_distance_meters)}
              </span>
            </div>
          </div>

          {/* Timeline Dots & Labels */}
          <div className="flex-1 flex flex-col justify-between gap-3 min-w-0">
            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 ring-4 ring-emerald-500/20" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
                  Origem do motorista
                </span>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {ride.origin_label}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 ring-4 ring-indigo-500/20" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
                  Destino do motorista
                </span>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {ride.destination_label}
                </p>
              </div>
            </div>
          </div>
        </div>

        {ride.estimated_pickup_at && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
            <ClockIcon size={14} className="text-indigo-400" />
            Chegada prevista à sua origem às {formatTime(ride.estimated_pickup_at)} · {formatDateShort(ride.estimated_pickup_at)}
          </p>
        )}

        {ride.estimated_dropoff_at && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
            <ClockIcon size={14} className="text-indigo-400" />
            Chegada prevista ao seu destino às {formatTime(ride.estimated_dropoff_at)} · {formatDateShort(ride.estimated_dropoff_at)}
          </p>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap text-xs" style={{ color: "var(--color-text-secondary)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={14} className="text-emerald-400" />
              <strong>{ride.available_seats}</strong> de {ride.total_seats} vagas livres
            </span>

            {ride.driver.car_model && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
                <CarIcon size={13} className="text-indigo-400" />
                <span>
                  {ride.driver.car_model}
                  {ride.driver.car_color ? ` (${ride.driver.car_color})` : ""}
                </span>
              </span>
            )}
          </div>

          {(ride.origin_lat != null || ride.route_geojson) && (
            <button
              type="button"
              aria-expanded={showMap}
              onClick={() => setShowMap((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <MapPinIcon size={13} />
              <span>{showMap ? "Ocultar mapa" : "Ver trajeto no mapa"}</span>
            </button>
          )}
        </div>

        {/* Collapsible Map Preview */}
        {showMap && (
          <section aria-label="Trajeto previsto" className="mt-3 space-y-2">
            <h4 className="text-sm font-bold text-[var(--color-text)]">Trajeto previsto</h4>
            <InteractiveMap
              height="210px"
              scrollWheelZoom={!showDetour}
              origin={
                ride.origin_lat != null && ride.origin_lng != null
                  ? { lat: ride.origin_lat, lng: ride.origin_lng, label: ride.origin_label }
                  : null
              }
              destination={
                ride.destination_lat != null && ride.destination_lng != null
                  ? { lat: ride.destination_lat, lng: ride.destination_lng, label: ride.destination_label }
                  : null
              }
              pickup={passengerPickup}
              dropoff={passengerDropoff}
              pickupIsApproximate={!showDetour}
              routeGeoJson={showDetour ? ride.detour_geojson : ride.route_geojson}
              comparisonRoute={comparisonRoute}
              approximateRoute={showDetour && !ride.detour_geojson}
            />
            {showDetour && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1.5"><span className={ride.detour_geojson ? "w-4 border-t-2 border-indigo-500" : "w-4 border-t-2 border-dashed border-indigo-500"} />{ride.detour_geojson ? "Rota via sua origem e seu destino" : "Trajeto aproximado entre os pontos"}</span>
                {comparisonRoute && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-slate-500" />Rota original</span>}
                <span>P · Sua origem</span>
                <span>D · Seu destino</span>
              </div>
            )}
          </section>
        )}

        {/* Action Button / Existing Match Status / Multi-Match Selection */}
        {onRequestMatch && (
          <div className="mt-4 pt-3.5 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-3">
              {canSelectForBatch && (
                <button
                  type="button"
                  onClick={() => onToggleSelect?.(ride.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    selected
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "hover:border-indigo-500/50"
                  }`}
                  style={
                    selected
                      ? undefined
                      : {
                          backgroundColor: "var(--color-surface-2)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text-secondary)",
                        }
                  }
                  title="Selecionar carona para enviar pedido em lote (Multi-Matching)"
                >
                  <span>{selected ? "✓ No lote" : "+ Lote"}</span>
                </button>
              )}

            </div>

            {resolvedMatchStatus === "accepted" ? (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ✓ Carona Confirmada
              </span>
            ) : resolvedMatchStatus === "pending" ? (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                ⏳ Aguardando aprovação
              </span>
            ) : resolvedMatchStatus === "superseded" ? (
              <span className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                Substituída por outra carona
              </span>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={isRequesting}
                disabled={ride.available_seats <= 0}
                onClick={() => onRequestMatch(ride)}
              >
                Solicitar Carona
              </Button>
            )}
          </div>
        )}
      </div>

      {showDriverProfile && (
        <UserProfileModal
          user={ride.driver}
          onClose={() => setShowDriverProfile(false)}
        />
      )}
    </>
  );
};
