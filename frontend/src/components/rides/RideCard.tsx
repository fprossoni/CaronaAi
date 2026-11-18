/**
 * RideCard Component
 *
 * Combines BlaBlaCar/Uber route & detour clarity with Instagram/LinkedIn
 * academic social trust (clickable driver profile, course, rating, and vehicle badge).
 */

import React, { useState } from "react";
import type { RideSearchResult } from "@/types/ride";
import type { MatchStatus } from "@/types/match";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  GraduationCapIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { UserProfileModal } from "@/components/users/UserProfileModal";

interface RideCardProps {
  ride: RideSearchResult;
  onRequestMatch?: (ride: RideSearchResult) => void;
  isRequesting?: boolean;
  existingMatchStatus?: MatchStatus | null;
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

function formatPickupDifference(seconds: number): string {
  if (seconds === 0) return "Embarque no horário desejado";
  const difference = Math.abs(seconds) < 60 ? "Menos de 1 min" : `${Math.round(Math.abs(seconds) / 60)} min`;
  return `${difference} ${seconds < 0 ? "antes" : "depois"} do horário desejado`;
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onRequestMatch,
  isRequesting = false,
  existingMatchStatus = null,
  selectable = false,
  selected = false,
  onToggleSelect,
}) => {
  const [showDriverProfile, setShowDriverProfile] = useState(false);

  const driverName = ride.driver.name ?? "Motorista UFRGS";
  const completedRides = ride.driver_completed_ride_count;
  const rating = ride.driver.avg_rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const resolvedMatchStatus = existingMatchStatus ?? ride.my_match_status ?? null;
  const canSelectForBatch =
    selectable && !resolvedMatchStatus && ride.available_seats > 0 && Boolean(onToggleSelect);

  return (
    <>
      <div
        className={`rounded-3xl border bg-gradient-card p-5 transition-all hover:shadow-xl animate-fade-in ${
          selected
            ? "border-primary shadow-[0_0_0_2px_rgba(99,102,241,0.35),var(--shadow-sm)]"
            : "border-border shadow-sm"
        }`}
      >
        <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface-2 p-3 sm:p-4">
          {[
            { label: "Previsão no seu ponto de encontro", estimate: ride.estimated_pickup_at, color: "bg-emerald-400" },
            { label: "Previsão de chegada ao destino", estimate: ride.estimated_dropoff_at, color: "bg-indigo-400" },
          ].map(({ label, estimate, color }) => (
            <div key={label} className="min-w-0 space-y-1">
              <dt className="flex items-start gap-2 text-xs font-semibold text-text-secondary">
                <span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${color}`} />
                {label}
              </dt>
              <dd className="pl-4">
                {estimate ? (
                  <time dateTime={estimate} className="block tabular-nums">
                    <span className="block text-2xl font-extrabold text-text">{formatTime(estimate)}</span>
                    <span className="block text-xs text-text-muted">{formatDateShort(estimate)}</span>
                  </time>
                ) : <span className="text-xs text-text-muted">Sem previsão</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
          {ride.pickup_difference_seconds != null && <span>{formatPickupDifference(ride.pickup_difference_seconds)}</span>}
          {ride.detour_meters != null && (
            <span>Desvio do motorista · {(ride.detour_meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} km</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar
              name={ride.driver.name}
              photoUrl={ride.driver.photo_url}
              size="md"
              ring
            />
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-sm font-bold text-text">{driverName}</h3>
              <p className="flex items-start gap-1 text-xs text-text-muted">
                <GraduationCapIcon size={13} className="text-indigo-400 shrink-0" />
                <span className="break-words">{ride.driver.course || "Curso não informado"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1" title={`${ride.driver.rating_count} avaliações`}>
                  <StarIcon size={13} filled className="text-amber-400" />
                  {ride.driver.rating_count ? `Nota ${rating} de 5` : "Sem avaliações"}
                </span>
                <span>{completedRides} {completedRides === 1 ? "viagem concluída" : "viagens concluídas"}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDriverProfile(true)}
                aria-label={`Ver perfil de ${driverName}`}
                className="text-xs font-semibold text-primary-light hover:underline"
              >
                Ver perfil
              </button>
            </div>
          </div>

          {ride.women_only && (
            <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-xs font-semibold text-pink-400">
              Exclusiva para mulheres
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap text-xs text-text-secondary">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={14} className="text-emerald-400" />
              <strong>{ride.available_seats}</strong> de {ride.total_seats} vagas livres
            </span>

            {ride.driver.car_model && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border">
                <CarIcon size={13} className="text-indigo-400" />
                <span>
                  {ride.driver.car_model}
                  {ride.driver.car_color ? ` (${ride.driver.car_color})` : ""}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button / Existing Match Status / Multi-Match Selection */}
        {onRequestMatch && (
          <div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {canSelectForBatch && (
                <button
                  type="button"
                  onClick={() => onToggleSelect?.(ride.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    selected
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-surface-2 border-border text-text-secondary hover:border-indigo-500/50"
                  }`}
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
