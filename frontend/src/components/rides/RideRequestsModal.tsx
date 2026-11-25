/**
 * RideRequestsModal Component
 *
 * Driver match management modal for pending and confirmed passengers.
 */

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RideDetail } from "@/types/ride";
import type { MatchConfirmed, MatchForDriver } from "@/types/match";
import type { UserPublic } from "@/types/user";
import { matchesApi } from "@/api/matches";
import { useToastStore } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errors";
import { buildWhatsAppUrl, formatDistance, formatDuration, getGenderLabel } from "@/lib/formatters";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  CheckCircleIcon,
  LockIcon,
  MapPinIcon,
  NavigationIcon,
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
}

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm", { locale: ptBR });
}

export const RideRequestsModal: React.FC<RideRequestsModalProps> = ({
  ride,
  onClose,
  onChanged,
}) => {
  const toast = useToastStore();
  const [requests, setRequests] = useState<MatchForDriver[]>([]);
  const [confirmedDetails, setConfirmedDetails] = useState<Record<number, MatchConfirmed>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);

  const load = useCallback(async () => {
    const { data } = await matchesApi.getRideMatches(ride.id);
    const acceptedList = data.filter((m) => m.status === "accepted");

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
    let active = true;
    load()
      .then(({ list, detailsMap }) => {
        if (active) {
          setRequests(list);
          setConfirmedDetails(detailsMap);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err, "Erro ao carregar solicitações."));
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
      const { data: confirmed } = await matchesApi.respond(matchId, action);
      if (action === "accept") {
        toast.success("Passageiro confirmado", "Embarque e contato liberados.");
        setConfirmedDetails((prev) => ({ ...prev, [matchId]: confirmed }));
      } else {
        toast.info("Solicitação recusada.");
      }
      onChanged();
      const refreshed = await load();
      setRequests(refreshed.list);
      setConfirmedDetails(refreshed.detailsMap);
    } catch (err: unknown) {
      toast.error("Erro ao processar solicitação", getErrorMessage(err));
    } finally {
      setActingId(null);
    }
  };

  const pending = requests.filter((m) => m.status === "pending");
  const accepted = requests.filter((m) => m.status === "accepted");
  const noSeats = ride.available_seats <= 0;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-950 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-[10px] p-5 sm:p-6 border border-border-strong bg-surface shadow-lg animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-border">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-text">Solicitações</h3>
              <p className="font-mono text-[11px] mt-0.5 text-text-muted truncate">
                {ride.origin_label} → {ride.destination_label} · {ride.available_seats}/
                {ride.total_seats} vagas
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              aria-label="Fechar"
            >
              <XIcon size={17} />
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-10 text-center font-mono text-xs text-text-muted animate-pulse">
              Carregando…
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm text-text-secondary">Nenhuma solicitação recebida.</p>
            </div>
          )}

          {/* Pending Requests */}
          {pending.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-warning-text">
                  Pendentes · {pending.length}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
                  <LockIcon size={11} /> Endereço oculto até aceite
                </span>
              </div>

              {pending.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-md border border-border bg-surface-2 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer group min-w-0"
                      onClick={() => setSelectedUser(m.passenger)}
                    >
                      <Avatar
                        name={m.passenger.name}
                        photoUrl={m.passenger.photo_url}
                        rating={m.passenger.avg_rating}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-text group-hover:text-accent-text truncate transition-colors">
                          {m.passenger.name ?? "Passageiro UFRGS"}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {[
                            m.passenger.course ?? "Curso não informado",
                            m.passenger.gender ? getGenderLabel(m.passenger.gender) : null,
                            m.passenger.age != null ? `${m.passenger.age} anos` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-[2px] font-mono text-[11px] font-bold bg-primary/15 text-accent-text border border-primary/30 shrink-0">
                      +{formatDistance(m.detour_meters)} · +{formatDuration(m.detour_seconds)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md border border-border bg-surface text-xs text-text-secondary flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon size={13} className="text-warning-text shrink-0" />
                      <span>
                        Bairro: <strong className="text-text">{m.pickup_region}</strong>
                      </span>
                    </span>
                    {m.offered_pickup_at && (
                      <span className="font-mono text-[11px] font-semibold text-accent-text">
                        Embarque: {formatTime(m.offered_pickup_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
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
                      Aceitar
                    </Button>
                  </div>

                  {noSeats && (
                    <p className="font-mono text-[11px] text-warning-text text-right">
                      Sem vagas disponíveis.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Confirmed Passengers */}
          {accepted.length > 0 && (
            <div className="mt-5 space-y-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary block">
                Confirmados · {accepted.length}
              </span>

              {accepted.map((m) => {
                const detail = confirmedDetails[m.id];
                const exactLat = detail?.pickup_lat;
                const exactLng = detail?.pickup_lng;
                const exactStreet = detail?.pickup_street ?? m.pickup_street;
                const exactNumber = detail?.pickup_number ?? m.pickup_number;
                const exactComplement = detail?.pickup_complement ?? m.pickup_complement;
                const exactNeighborhood = detail?.pickup_neighborhood ?? m.pickup_neighborhood;
                const structuredAddress = exactStreet
                  ? `${exactStreet}${exactNumber ? `, ${exactNumber}` : ""}${
                      exactComplement ? ` (${exactComplement})` : ""
                    }${exactNeighborhood ? ` — ${exactNeighborhood}` : ""}`
                  : null;
                const exactLabel = structuredAddress ?? detail?.pickup_label ?? m.pickup_region;
                const passengerPhone =
                  detail?.passenger_phone ?? m.passenger_phone ?? m.passenger.phone;
                const pickupEta = detail?.offered_pickup_at ?? m.offered_pickup_at;

                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-md border border-secondary/40 bg-surface-2 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex items-center gap-3 cursor-pointer group min-w-0"
                        onClick={() => setSelectedUser(m.passenger)}
                      >
                        <Avatar
                          name={m.passenger.name}
                          photoUrl={m.passenger.photo_url}
                          rating={m.passenger.avg_rating}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-text group-hover:text-accent-text truncate">
                              {m.passenger.name ?? "Passageiro"}
                            </p>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase bg-secondary/15 text-secondary">
                              <CheckCircleIcon size={10} /> OK
                            </span>
                          </div>
                          <p className="text-xs text-text-muted truncate">
                            {m.passenger.course ?? "Estudante UFRGS"}
                          </p>
                        </div>
                      </div>

                      {passengerPhone ? (
                        <a
                          href={buildWhatsAppUrl(
                            passengerPhone,
                            `Olá ${m.passenger.name ?? ""}! Confirmamos nossa carona no Carona Aí (ponto de encontro: ${exactLabel}${
                              pickupEta ? ` às ${formatTime(pickupEta)}` : ""
                            }).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold bg-secondary text-on-primary hover:opacity-90 transition-opacity no-underline shrink-0"
                        >
                          <WhatsAppIcon size={13} />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <span className="font-mono text-[10px] text-text-muted">Sem telefone</span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-md border border-border bg-surface text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px] text-secondary font-semibold flex-wrap gap-2">
                        <span className="flex items-center gap-1">
                          <NavigationIcon size={12} />
                          Embarque
                        </span>
                        <span>
                          {pickupEta ? `${formatTime(pickupEta)} · ` : ""}+
                          {formatDistance(m.detour_meters)}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-text">{exactLabel}</p>
                      {detail?.dropoff_label && (
                        <p className="text-text-secondary">
                          <strong className="text-text">Destino:</strong> {detail.dropoff_label}
                        </p>
                      )}
                      {passengerPhone && (
                        <p className="font-mono text-[11px] text-text-muted">{passengerPhone}</p>
                      )}
                    </div>

                    {exactLat != null && exactLng != null && (
                      <InteractiveMap
                        height="170px"
                        origin={
                          ride.origin_lat != null && ride.origin_lng != null
                            ? { lat: ride.origin_lat, lng: ride.origin_lng, label: ride.origin_label }
                            : null
                        }
                        destination={
                          ride.destination_lat != null && ride.destination_lng != null
                            ? {
                                lat: ride.destination_lat,
                                lng: ride.destination_lng,
                                label: ride.destination_label,
                              }
                            : null
                        }
                        pickup={{ lat: exactLat, lng: exactLng, label: exactLabel }}
                        dropoff={
                          detail?.dropoff_lat != null && detail.dropoff_lng != null
                            ? {
                                lat: detail.dropoff_lat,
                                lng: detail.dropoff_lng,
                                label: detail.dropoff_label ?? undefined,
                              }
                            : null
                        }
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
    </>,
    document.body
  );
};
