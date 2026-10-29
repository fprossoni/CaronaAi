/**
 * HistoryPage ("Histórico de Caronas")
 *
 * Displays past completed and cancelled trips (as Driver or Passenger),
 * enabling post-trip 1–5 star ratings (`RatingModal`), public profile inspection
 * (`UserProfileModal`), and structured safety reporting/blocking (`ReportUserModal`).
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import type { TripHistory, TripParticipant } from "@/types/ride";
import type { UserPublic } from "@/types/user";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  HistoryIcon,
  StarIcon,
} from "@/components/ui/Icons";
import { RatingModal } from "@/components/rides/RatingModal";
import { ReportUserModal } from "@/components/rides/ReportUserModal";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { getErrorMessage } from "@/lib/errors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(iso: string): string {
  return format(new Date(iso), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

type RoleFilter = "all" | "driver" | "passenger";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // Modals state
  const [ratingTarget, setRatingTarget] = useState<{
    matchId: number;
    participant: TripParticipant;
  } | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    rideId: number;
    participant: TripParticipant;
  } | null>(null);
  const [profileUser, setProfileUser] = useState<UserPublic | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await ridesApi.getHistory();
    setTrips(data);
  }, []);

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

  if (loading) {
    return (
      <div className="py-16 text-center text-sm animate-pulse" style={{ color: "var(--color-text-muted)" }}>
        Carregando histórico de viagens...
      </div>
    );
  }

  const filteredTrips = trips.filter((t) =>
    roleFilter === "all" ? true : t.role === roleFilter
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate("/rides")}
            className="text-xs font-semibold text-indigo-400 hover:underline mb-1 inline-block"
          >
            ← Voltar para Caronas Ativas
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Histórico e Avaliações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Avalie seus colegas de viagem com 1 a 5 estrelas para fortalecer a confiança na comunidade UFRGS.
          </p>
        </div>

        {/* Role Filter Pills */}
        <div
          className="inline-flex p-1 rounded-2xl border"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {(
            [
              { id: "all", label: "Todas" },
              { id: "driver", label: "Motorista" },
              { id: "passenger", label: "Passageiro" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                backgroundColor:
                  roleFilter === tab.id ? "var(--color-primary)" : "transparent",
                color: roleFilter === tab.id ? "#ffffff" : "var(--color-text-secondary)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {filteredTrips.length === 0 ? (
        <div
          className="rounded-3xl p-10 border text-center space-y-2"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto mb-2">
            <HistoryIcon size={24} />
          </div>
          <p className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            Nenhuma viagem encontrada neste filtro
          </p>
          <p className="text-xs max-w-md mx-auto" style={{ color: "var(--color-text-muted)" }}>
            Assim que suas caronas forem concluídas, elas aparecerão aqui para avaliação.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => {
            const isCompleted = trip.status === "completed";
            return (
              <div
                key={`${trip.role}-${trip.ride_id}`}
                className="rounded-3xl p-5 md:p-6 border space-y-4 shadow-md"
                style={{
                  background: "var(--gradient-card)",
                  borderColor: "var(--color-border)",
                }}
              >
                {/* Trip Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isCompleted
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {isCompleted ? "✓ Concluída" : "✕ Cancelada"}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Você foi {trip.role === "driver" ? "Motorista" : "Passageiro"}
                    </span>
                  </div>

                  <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                    {formatDate(trip.departure_at)}
                  </span>
                </div>

                {/* Route Summary */}
                <div
                  className="p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>{trip.origin_label}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>→</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                    <span>{trip.destination_label}</span>
                  </div>
                </div>

                {/* Participants & Rating Actions */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Participantes desta viagem
                  </p>

                  {trip.participants.length === 0 ? (
                    <p className="text-xs italic" style={{ color: "var(--color-text-muted)" }}>
                      Nenhum outro participante confirmado nesta viagem.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {trip.participants.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: "var(--color-surface-2)",
                            borderColor: "var(--color-border)",
                          }}
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer group min-w-0"
                            onClick={() =>
                              setProfileUser({
                                id: p.id,
                                name: p.name,
                                email: "",
                                course: p.course,
                                age: null,
                                phone: null,
                                photo_url: p.photo_url,
                                social_link: null,
                                instagram: null,
                                bio: null,
                                campuses: null,
                                avg_rating: p.avg_rating,
                                rating_count: p.rating_count,
                                is_driver: p.role === "driver",
                              })
                            }
                          >
                            <Avatar
                              name={p.name}
                              photoUrl={p.photo_url}
                              rating={p.avg_rating}
                              size="md"
                              ring
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className="text-sm font-bold truncate group-hover:text-indigo-400"
                                  style={{ color: "var(--color-text)" }}
                                >
                                  {p.name ?? "Estudante UFRGS"}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.role === "driver"
                                      ? "bg-indigo-500/20 text-indigo-400"
                                      : "bg-emerald-500/20 text-emerald-400"
                                  }`}
                                >
                                  {p.role === "driver" ? "Motorista" : "Passageiro"}
                                </span>
                              </div>
                              <p
                                className="text-xs truncate flex items-center gap-1 mt-0.5"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                <GraduationCapIcon size={12} className="shrink-0" />
                                {p.course ?? "Curso não informado"}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons: Rate + Report */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCompleted && p.match_id && !p.already_rated && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  setRatingTarget({
                                    matchId: p.match_id!,
                                    participant: p,
                                  })
                                }
                              >
                                <StarIcon size={13} filled />
                                <span>Avaliar</span>
                              </Button>
                            )}

                            {p.already_rated && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400">
                                <CheckCircleIcon size={13} /> Avaliado
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setReportTarget({
                                  rideId: trip.ride_id,
                                  participant: p,
                                })
                              }
                              className="p-2 rounded-xl border text-red-400 hover:bg-red-500/10 transition-colors"
                              style={{ borderColor: "var(--color-border)" }}
                              title="Reportar ou bloquear usuário"
                              aria-label="Reportar usuário"
                            >
                              <AlertTriangleIcon size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ratingTarget && (
        <RatingModal
          matchId={ratingTarget.matchId}
          ratedUser={ratingTarget.participant}
          onClose={() => setRatingTarget(null)}
          onSuccess={loadHistory}
        />
      )}

      {reportTarget && (
        <ReportUserModal
          rideId={reportTarget.rideId}
          targetUser={reportTarget.participant}
          onClose={() => setReportTarget(null)}
        />
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
        />
      )}
    </div>
  );
};