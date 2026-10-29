/**
 * RideCard Component
 *
 * Combines BlaBlaCar/Uber route & detour clarity with Instagram/LinkedIn
 * academic social trust (clickable driver profile, course, rating, and vehicle badge).
 */

import React, { useState } from "react";
import type { RidePublic } from "@/types/ride";
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
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { UserProfileModal } from "@/components/users/UserProfileModal";

interface RideCardProps {
  ride: RidePublic;
  onRequestMatch?: (ride: RidePublic) => void;
  isRequesting?: boolean;
  existingMatchStatus?: MatchStatus | null;
  passengerPickup?: { lat: number; lng: number; label?: string } | null;
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
}) => {
  const [showMap, setShowMap] = useState(false);
  const [showDriverProfile, setShowDriverProfile] = useState(false);

  const campus = getCampusInfo(ride.campus_point);
  const isLowDetour = (ride.detour_meters ?? 0) <= 1200;

  return (
    <>
      <div
        className="rounded-3xl border p-5 transition-all hover:shadow-xl animate-fade-in"
        style={{
          background: "var(--gradient-card)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Top Row: Social Driver Header + Detour / Badges */}
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setShowDriverProfile(true)}
            title="Ver perfil completo do motorista"
          >
            <Avatar
              name={ride.driver.name}
              photoUrl={ride.driver.photo_url}
              size="md"
              ring
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="font-bold text-sm group-hover:text-indigo-400 transition-colors"
                  style={{ color: "var(--color-text)" }}
                >
                  {ride.driver.name ?? "Motorista UFRGS"}
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-400"
                  title={`${ride.driver.rating_count} avaliações`}
                >
                  <StarIcon size={13} filled />
                  {ride.driver.avg_rating.toFixed(1)}
                </span>
                <ShieldCheckIcon size={14} className="text-emerald-400" />
              </div>

              <p
                className="text-xs flex items-center gap-1 mt-0.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <GraduationCapIcon size={13} className="text-indigo-400 shrink-0" />
                <span className="truncate max-w-[210px]">
                  {ride.driver.course ?? "Estudante UFRGS"}
                </span>
              </p>
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
                +{formatDistance(ride.detour_meters)} · +{formatDuration(ride.detour_seconds ?? 0)}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              {ride.women_only && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  ♀ Só Mulheres
                </span>
              )}
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
                {formatDateShort(ride.departure_at)}
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
                  Partida
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
                  Destino
                </span>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {ride.destination_label}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Pills: Vehicle, Tolerance, Available Seats */}
        <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap text-xs" style={{ color: "var(--color-text-secondary)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={14} className="text-emerald-400" />
              <strong>{ride.available_seats}</strong> de {ride.total_seats} vagas livres
            </span>

            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
              <ClockIcon size={14} />
              Tolerância ±{ride.delay_tolerance_minutes} min
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
              onClick={() => setShowMap((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <MapPinIcon size={13} />
              <span>{showMap ? "Ocultar mapa" : "Ver rota no mapa"}</span>
            </button>
          )}
        </div>

        {/* Collapsible Map Preview */}
        {showMap && (
          <div className="mt-3">
            <InteractiveMap
              height="210px"
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
              pickupIsApproximate={true}
              routeGeoJson={ride.route_geojson}
            />
          </div>
        )}

        {/* Action Button / Existing Match Status */}
        {onRequestMatch && (
          <div className="mt-4 pt-3.5 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--color-border)" }}>
            <button
              type="button"
              onClick={() => setShowDriverProfile(true)}
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--color-text-muted)" }}
            >
              Ver perfil do motorista
            </button>

            {existingMatchStatus === "accepted" ? (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ✓ Carona Confirmada
              </span>
            ) : existingMatchStatus === "pending" ? (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                ⏳ Aguardando aprovação
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
