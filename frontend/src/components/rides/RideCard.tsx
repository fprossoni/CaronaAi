/**
 * RideCard Component
 *
 * Technical Bento card with tabular pickup/dropoff times, telemetry delta,
 * vertical bar SeatMeter, and crisp driver identity.
 */

import React, { useState } from "react";
import type { RideSearchResult } from "@/types/ride";
import type { MatchStatus } from "@/types/match";
import { Avatar } from "@/components/ui/Avatar";
import { SeatMeter } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  GraduationCapIcon,
  StarIcon,
} from "@/components/ui/Icons";
import { UserProfileModal } from "@/components/users/UserProfileModal";

interface RideCardProps {
  ride: RideSearchResult;
  onRequestMatch?: (ride: RideSearchResult) => void;
  isRequesting?: boolean;
  requestDisabled?: boolean;
  existingMatchStatus?: MatchStatus | null;
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

function formatPickupDifference(seconds: number): string {
  if (seconds === 0) return "No horário";
  const absMin = Math.round(Math.abs(seconds) / 60);
  if (absMin === 0) return "< 1 min";
  return `${seconds < 0 ? "-" : "+"}${absMin} min`;
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onRequestMatch,
  isRequesting = false,
  requestDisabled = false,
  existingMatchStatus = null,
}) => {
  const [showDriverProfile, setShowDriverProfile] = useState(false);

  const driverName = ride.driver.name ?? "Motorista UFRGS";
  const completedRides = ride.driver_completed_ride_count;
  const rating = ride.driver.avg_rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const resolvedMatchStatus = existingMatchStatus ?? ride.my_match_status ?? null;

  return (
    <>
      <div className="rounded-[10px] border border-border bg-surface p-4 sm:p-5 transition-colors hover:border-border-strong animate-fade-in">
        {/* Top Bento Time Block */}
        <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-2 p-3 sm:p-3.5 relative">
          {[
            { label: "EMBARQUE", estimate: ride.estimated_pickup_at, color: "bg-primary" },
            { label: "CHEGADA", estimate: ride.estimated_dropoff_at, color: "bg-secondary" },
          ].map(({ label, estimate, color }) => (
            <div key={label} className="min-w-0 space-y-0.5">
              <dt className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-text-muted">
                <span aria-hidden="true" className={`size-1.5 rounded-full shrink-0 ${color}`} />
                {label}
              </dt>
              <dd className="pl-3">
                {estimate ? (
                  <time dateTime={estimate} className="block tabular-nums">
                    <span className="block font-mono text-xl sm:text-2xl font-bold text-text leading-tight">
                      {formatTime(estimate)}
                    </span>
                    <span className="block text-[11px] text-text-muted">
                      {formatDateShort(estimate)}
                    </span>
                  </time>
                ) : (
                  <span className="text-xs text-text-muted">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* Telemetry Strip */}
        {(ride.pickup_difference_seconds != null || ride.detour_meters != null) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-muted">
            {ride.pickup_difference_seconds != null && (
              <span className="text-text-secondary">
                {formatPickupDifference(ride.pickup_difference_seconds)}
              </span>
            )}
            {ride.detour_meters != null && (
              <span>
                Desvio{" "}
                <strong className="text-text-secondary">
                  +{(ride.detour_meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
                </strong>
              </span>
            )}
          </div>
        )}

        {/* Driver Row */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar
              name={ride.driver.name}
              photoUrl={ride.driver.photo_url}
              size="md"
              onClick={() => setShowDriverProfile(true)}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowDriverProfile(true)}
                  aria-label={`Ver perfil de ${driverName}`}
                  className="text-sm font-bold text-text hover:text-accent-text text-left break-words transition-colors"
                >
                  {driverName}
                </button>
                {ride.women_only && (
                  <span className="rounded-[2px] border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-accent-text">
                    Mulheres
                  </span>
                )}
              </div>

              <p className="flex items-center gap-1 text-xs text-text-muted">
                <GraduationCapIcon size={12} className="text-text-secondary shrink-0" />
                <span className="truncate">{ride.driver.course || "Curso não informado"}</span>
              </p>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-text-secondary">
                <span
                  className="inline-flex items-center gap-1"
                  title={`${ride.driver.rating_count} avaliações`}
                >
                  <StarIcon size={12} filled className="text-accent-text" />
                  {ride.driver.rating_count ? rating : "Novo"}
                </span>
                <span className="text-border-strong">·</span>
                <span>
                  {completedRides} {completedRides === 1 ? "viagem" : "viagens"}
                </span>
              </div>
            </div>
          </div>

          {/* SeatMeter + Vehicle Tag */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <SeatMeter available={ride.available_seats} total={ride.total_seats} />
            {ride.driver.car_model && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border border-border bg-surface-2 font-mono text-[10px] text-text-secondary">
                <CarIcon size={11} className="text-text-muted" />
                <span>
                  {[ride.driver.car_brand, ride.driver.car_model].filter(Boolean).join(" ")}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {onRequestMatch && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-end gap-3 flex-wrap">
            {resolvedMatchStatus === "accepted" ? (
              <span className="px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-bold uppercase bg-secondary/15 text-secondary border border-secondary/35">
                Confirmada
              </span>
            ) : resolvedMatchStatus === "pending" ? (
              <span className="px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-bold uppercase bg-warning-bg text-warning-text border border-warning/40">
                Aguardando
              </span>
            ) : resolvedMatchStatus === "superseded" ? (
              <span className="px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-semibold uppercase bg-surface-2 text-text-muted border border-border">
                Substituída
              </span>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={isRequesting}
                disabled={requestDisabled || ride.available_seats <= 0}
                onClick={() => onRequestMatch(ride)}
              >
                Solicitar
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
