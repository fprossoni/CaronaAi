import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import type { TripHistory, TripParticipant } from "@/types/ride";
import type { UserPublic } from "@/types/user";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StarIcon } from "@/components/ui/Icons";
import { RatingModal } from "@/components/rides/RatingModal";
import { ReportUserModal } from "@/components/rides/ReportUserModal";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { getErrorMessage } from "@/lib/errors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(iso: string): string {
  return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: ptBR });
}

type RoleFilter = "all" | "driver" | "passenger";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

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
        if (active) setError(getErrorMessage(err, "Erro ao carregar histórico."));
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
      <div className="py-16 text-center font-mono text-xs text-text-muted animate-pulse">
        Carregando histórico…
      </div>
    );
  }

  const filteredTrips = trips.filter((t) =>
    roleFilter === "all" ? true : t.role === roleFilter
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate("/rides")}
            className="font-mono text-xs font-semibold text-accent-text hover:underline mb-1 inline-block"
          >
            ← Caronas ativas
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">Histórico</h1>
        </div>

        <div className="inline-flex p-1 rounded-md border border-border bg-surface">
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
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                roleFilter === tab.id
                  ? "bg-primary text-on-primary font-bold"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">
          {error}
        </div>
      )}

      {filteredTrips.length === 0 ? (
        <div className="rounded-[10px] p-10 border border-border bg-surface bg-dot-matrix text-center space-y-2">

          <p className="text-sm font-medium text-text-secondary">
            Nenhuma viagem encontrada.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTrips.map((trip) => {
            const isCompleted = trip.status === "completed";
            return (
              <div
                key={`${trip.role}-${trip.ride_id}`}
                className="rounded-[10px] p-4 sm:p-5 border border-border bg-surface space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase ${
                        isCompleted
                          ? "bg-secondary/15 text-secondary border border-secondary/35"
                          : "bg-danger/15 text-danger border border-danger/35"
                      }`}
                    >
                      {isCompleted ? "Concluída" : "Cancelada"}
                    </span>
                    <span className="px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold border border-border bg-surface-2 text-text-secondary uppercase">
                      {trip.role === "driver" ? "Motorista" : "Passageiro"}
                    </span>
                  </div>

                  <span className="font-mono text-xs text-text-muted">
                    {formatDate(trip.departure_at)}
                  </span>
                </div>
                <div className="p-3 rounded-md border border-border bg-surface-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                  <span className="size-2 rounded-full bg-primary shrink-0" />
                  <span>{trip.origin_label}</span>
                  <span className="font-mono text-text-muted">→</span>
                  <span className="size-2 rounded-full bg-secondary shrink-0" />
                  <span>{trip.destination_label}</span>
                </div>
                <div className="space-y-2">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Participantes
                  </p>

                  {trip.participants.length === 0 ? (
                    <p className="text-xs text-text-muted">Nenhum participante confirmado.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {trip.participants.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-md border border-border bg-surface-2 flex items-center justify-between gap-2.5"
                        >
                          <div
                            className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                            onClick={() =>
                              setProfileUser({
                                id: p.id,
                                name: p.name,
                                course: p.course,
                                gender: null,
                                age: null,
                                photo_url: p.photo_url,
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
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold truncate text-text group-hover:text-accent-text transition-colors">
                                  {p.name ?? "Estudante UFRGS"}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[9px] font-bold uppercase ${
                                    p.role === "driver"
                                      ? "bg-primary/15 text-accent-text"
                                      : "bg-secondary/15 text-secondary"
                                  }`}
                                >
                                  {p.role === "driver" ? "Motorista" : "Passageiro"}
                                </span>
                              </div>
                              <p className="text-xs truncate flex items-center gap-1 mt-0.5 text-text-muted">

                                {p.course ?? "Curso não informado"}
                              </p>
                            </div>
                          </div>

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
                                <StarIcon size={12} filled />
                                <span>Avaliar</span>
                              </Button>
                            )}

                            {p.already_rated && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] font-mono text-[10px] font-bold uppercase bg-secondary/15 text-secondary">
                                 Avaliado
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
                              className="p-2 rounded-md border border-border text-danger hover:bg-danger/10 transition-colors"
                              title="Reportar ou bloquear usuário"
                              aria-label="Reportar usuário"
                            >
                              Denunciar
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
