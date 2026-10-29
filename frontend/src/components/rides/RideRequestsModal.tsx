/**
 * RideRequestsModal Component
 *
 * Driver's match management modal for a specific ride:
 * - Pending Requests: Displays passenger social profile, approximate region (`pickup_region`),
 *   and detour (`+km` / `+min`) while keeping exact coordinates confidential.
 * - Confirmed Passengers (`accepted`): Fetches `MatchConfirmed` (`GET /matches/{id}`) to reveal
 *   the passenger's exact pickup point on the interactive map and direct WhatsApp contact button.
 */

import React, { useCallback, useEffect, useState } from "react";
import type { RideDetail } from "@/types/ride";
import type { MatchConfirmed, MatchForDriver } from "@/types/match";
import type { UserPublic } from "@/types/user";
import { matchesApi } from "@/api/matches";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { buildWhatsAppUrl, formatDistance, formatDuration } from "@/lib/formatters";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  CheckCircleIcon,
  MapPinIcon,
  NavigationIcon,
  ShieldCheckIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/ui/Icons";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RideRequestsModalProps {
  ride: RideDetail;
  onClose: () => void;
  onChanged: () => void;
  /** Optional mock data for isolated testing in the `/dev` playground */
  mockRequests?: MatchForDriver[];
  mockConfirmedDetails?: Record<number, MatchConfirmed>;
}

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm", { locale: ptBR });
}

export const RideRequestsModal: React.FC<RideRequestsModalProps> = ({
  ride,
  onClose,
  onChanged,
  mockRequests,
  mockConfirmedDetails,
}) => {
  const toast = useToastStore();
  const [requests, setRequests] = useState<MatchForDriver[]>(() => mockRequests ?? []);
  const [confirmedDetails, setConfirmedDetails] = useState<Record<number, MatchConfirmed>>(
    () => mockConfirmedDetails ?? {}
  );
  const [loading, setLoading] = useState(() => !mockRequests);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);

  const load = useCallback(async () => {
    const { data } = await matchesApi.getRideMatches(ride.id);
    const acceptedList = data.filter((m) => m.status === "accepted");

    // Fetch MatchConfirmed details (exact coordinates & phone) for accepted matches
    const detailEntries = await Promise.all(
      acceptedList.map(async (m) => {
        try {
          const res = await matchesApi.getById(m.id);
          return [m.id, res.data] as const;
        } catch {
          return null;
        }
      })
    );

    const detailsMap: Record<number, MatchConfirmed> = {};
    for (const entry of detailEntries) {
      if (entry) detailsMap[entry[0]] = entry[1];
    }

    return { list: data, detailsMap };
  }, [ride.id]);

  useEffect(() => {
    if (mockRequests) return;
    let active = true;
    load()
      .then(({ list, detailsMap }) => {
        if (active) {
          setRequests(list);
          setConfirmedDetails(detailsMap);
        }
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
  }, [load, mockRequests]);

  const handleRespond = async (matchId: number, action: "accept" | "reject") => {
    setActingId(matchId);

    if (mockRequests) {
      setRequests((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, status: action === "accept" ? "accepted" : "rejected" } : m
        )
      );
      if (action === "accept") {
        toast.success(
          "Passageiro confirmado!",
          "O ponto exato de embarque e o contato de WhatsApp foram liberados."
        );
      } else {
        toast.info("Solicitação recusada.");
      }
      setActingId(null);
      onChanged();
      return;
    }

    try {
      const { data: confirmed } = await matchesApi.respond(matchId, action);
      if (action === "accept") {
        toast.success(
          "Passageiro confirmado!",
          "O ponto exato de embarque e o contato de WhatsApp foram liberados."
        );
        setConfirmedDetails((prev) => ({ ...prev, [matchId]: confirmed }));
      } else {
        toast.info("Solicitação recusada.");
      }
      onChanged();
      const refreshed = await load();
      setRequests(refreshed.list);
      setConfirmedDetails(refreshed.detailsMap);
    } catch (err: unknown) {
      toast.error("Erro ao processar a solicitação", getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  };

  const pending = requests.filter((m) => m.status === "pending");
  const accepted = requests.filter((m) => m.status === "accepted");
  const noSeats = ride.available_seats <= 0;

  return (
    <>
      <div
        className="fixed inset-0 z-[950] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-6 border shadow-2xl animate-slide-up"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                Passageiros & Solicitações
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {ride.origin_label} → {ride.destination_label} • {ride.available_seats}/{ride.total_seats} vagas livres
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Fechar"
            >
              <XIcon size={18} />
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-10 text-center text-sm animate-pulse" style={{ color: "var(--color-text-muted)" }}>
              Carregando solicitações...
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Nenhuma solicitação recebida para esta carona ainda.
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Quando colegas solicitarem vaga, eles aparecerão aqui com o desvio calculado.
              </p>
            </div>
          )}

          {/* Pending Requests Section */}
          {pending.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Aguardando sua resposta ({pending.length})
                </span>
                <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                  <ShieldCheckIcon size={12} className="text-indigo-400" />
                  Endereço exato oculto até aceitar
                </span>
              </div>

              {pending.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => setSelectedUser(m.passenger)}
                    >
                      <Avatar
                        name={m.passenger.name}
                        photoUrl={m.passenger.photo_url}
                        rating={m.passenger.avg_rating}
                        size="md"
                        ring
                      />
                      <div>
                        <p className="font-bold text-sm group-hover:text-indigo-400 transition-colors" style={{ color: "var(--color-text)" }}>
                          {m.passenger.name ?? "Passageiro UFRGS"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {m.passenger.course ?? "Curso não informado"}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          Solicitado às {formatTime(m.created_at)} • Toque para ver perfil
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
                      +{formatDistance(m.detour_meters)} · +{formatDuration(m.detour_seconds)}
                    </span>
                  </div>

                  <div
                    className="p-2.5 rounded-xl border text-xs flex items-center gap-2"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <MapPinIcon size={14} className="text-amber-400 shrink-0" />
                    <span>
                      Região aproximada de embarque: <strong>{m.pickup_region}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actingId !== null}
                      onClick={() => handleRespond(m.id, "reject")}
                    >
                      Recusar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={actingId === m.id}
                      disabled={noSeats || actingId !== null}
                      onClick={() => handleRespond(m.id, "accept")}
                    >
                      Aceitar Passageiro
                    </Button>
                  </div>

                  {noSeats && (
                    <p className="text-xs text-amber-400 text-right">
                      Todos os assentos desta carona já foram preenchidos.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Confirmed Passengers Section (Reveals exact pickup location + WhatsApp) */}
          {accepted.length > 0 && (
            <div className="mt-6 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                Passageiros Confirmados ({accepted.length})
              </span>

              {accepted.map((m) => {
                const detail = confirmedDetails[m.id];
                const exactLat = detail?.pickup_lat;
                const exactLng = detail?.pickup_lng;
                const exactLabel = detail?.pickup_label ?? m.pickup_region;
                const passengerPhone = detail?.passenger_phone;

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-2xl border space-y-3"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      borderColor: "rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setSelectedUser(m.passenger)}
                      >
                        <Avatar
                          name={m.passenger.name}
                          photoUrl={m.passenger.photo_url}
                          rating={m.passenger.avg_rating}
                          size="md"
                          ring
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm group-hover:text-indigo-400" style={{ color: "var(--color-text)" }}>
                              {m.passenger.name ?? "Passageiro"}
                            </p>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                              <CheckCircleIcon size={11} /> Confirmado
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {m.passenger.course ?? "Estudante UFRGS"}
                          </p>
                        </div>
                      </div>

                      {passengerPhone ? (
                        <a
                          href={buildWhatsAppUrl(
                            passengerPhone,
                            `Olá ${m.passenger.name ?? ""}! Confirmamos nossa carona no Carona Aí (${ride.origin_label} → ${ride.destination_label}).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md"
                        >
                          <WhatsAppIcon size={14} />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          Sem telefone cadastrado
                        </span>
                      )}
                    </div>

                    {/* Exact Pickup Point Revealed */}
                    <div
                      className="p-3 rounded-xl border text-xs space-y-1"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-center justify-between text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <NavigationIcon size={13} />
                          Ponto de encontro liberado:
                        </span>
                        <span>+{formatDistance(m.detour_meters)}</span>
                      </div>
                      <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
                        {exactLabel}
                      </p>
                      {passengerPhone && (
                        <p style={{ color: "var(--color-text-muted)" }}>
                          Telefone: <strong>{passengerPhone}</strong>
                        </p>
                      )}
                    </div>

                    {exactLat != null && exactLng != null && (
                      <InteractiveMap
                        height="180px"
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
                        pickup={{ lat: exactLat, lng: exactLng, label: exactLabel }}
                        pickupIsApproximate={false}
                        routeGeoJson={ride.route_geojson}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
};