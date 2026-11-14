import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import type { RideSearchResult, SearchRidesParams } from "@/types/ride";
import type { MatchStatus } from "@/types/match";
import { getInitialTripRoute, hasTripCampus, type TripPrefill, type TripRoute } from "@/lib/tripRoute";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { RideCard } from "@/components/rides/RideCard";
import { TripRouteFields } from "@/components/rides/TripRouteFields";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircleIcon } from "@/components/ui/Icons";

type SearchResult = { params: SearchRidesParams } & ({ rides: RideSearchResult[] } | { error: string });

const NO_RIDES: RideSearchResult[] = [];

export const FindRidePage: React.FC = () => {
  const location = useLocation();
  const prefill = location.state as TripPrefill | null;
  const toast = useToastStore();
  const canSearchWomenOnly = useAuthStore((state) => state.user?.gender === "female");
  const [route, setRoute] = useState<TripRoute>(() => getInitialTripRoute(prefill));
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [womenOnly, setWomenOnly] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [myMatchesByRide, setMyMatchesByRide] = useState<Record<number, MatchStatus>>({});
  const [selection, setSelection] = useState<{ params: SearchRidesParams | null; ids: number[] }>({ params: null, ids: [] });
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [batchRequesting, setBatchRequesting] = useState(false);

  const { origin: pickup, destination: dropoff } = route;
  const hasCampus = hasTripCampus(route);
  const startAt = date && startTime ? Date.parse(date + "T" + startTime) : NaN;
  const validWindow = Number.isFinite(startAt);
  const params = useMemo<SearchRidesParams | null>(() => {
    if (!pickup || !dropoff || !hasCampus || !validWindow) return null;
    return {
      pickup_campus_id: pickup.campusId,
      dropoff_campus_id: dropoff.campusId,
      pickup_address_id: pickup.addressId,
      dropoff_address_id: dropoff.addressId,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      women_only: canSearchWomenOnly && womenOnly,
      desired_pickup_at: new Date(startAt).toISOString(),
    };
  }, [pickup, dropoff, hasCampus, validWindow, startAt, canSearchWomenOnly, womenOnly]);

  const result = params && searchResult?.params === params ? searchResult : null;
  const searched = result !== null && "rides" in result;
  const rides = result && "rides" in result ? result.rides : NO_RIDES;
  const searchError = result && "error" in result ? result.error : null;
  const loading = params !== null && result === null;
  const selectedRideIds = selection.params === params ? selection.ids : [];
  const matchPoints = searched && params && pickup && dropoff ? {
    pickup_campus_id: pickup.campusId,
    dropoff_campus_id: dropoff.campusId,
    desired_pickup_at: params.desired_pickup_at,
    pickup_address_id: pickup.addressId,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_label: pickup.label,
    pickup_region: pickup.region || "Região próxima",
    dropoff_address_id: dropoff.addressId,
    dropoff_lat: dropoff.lat,
    dropoff_lng: dropoff.lng,
    dropoff_label: dropoff.label,
  } : null;

  // Load passenger's existing match requests so cards show real-time status
  useEffect(() => {
    matchesApi
      .getMyMatches()
      .then(({ data }) => {
        const map: Record<number, MatchStatus> = {};
        for (const m of data) {
          if (m.status === "pending" || m.status === "accepted" || m.status === "superseded") {
            map[m.ride_id] = m.status;
          }
        }
        setMyMatchesByRide(map);
      })
      .catch(() => {
        // Ignore silently
      });
  }, []);

  useEffect(() => {
    if (!params) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await ridesApi.search(params, controller.signal);
        if (controller.signal.aborted) return;
        setSearchResult({ params, rides: data });
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setSearchResult({ params, error: getErrorMessage(err, "Não foi possível buscar caronas.") });
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [params, retryCount]);

  function setSelectedRideIds(update: number[] | ((previous: number[]) => number[])) {
    setSelection((current) => ({
      params,
      ids: typeof update === "function" ? update(current.params === params ? current.ids : []) : update,
    }));
  }

  const eligibleBatchRides = useMemo(
    () =>
      rides.filter((r) => {
        const st = myMatchesByRide[r.id] ?? r.my_match_status ?? null;
        return r.available_seats > 0 && !st;
      }),
    [rides, myMatchesByRide]
  );

  const handleToggleSelectRide = (rideId: number) => {
    setSelectedRideIds((prev) =>
      prev.includes(rideId) ? prev.filter((id) => id !== rideId) : [...prev, rideId]
    );
  };

  const handleToggleSelectAll = () => {
    const eligibleIds = eligibleBatchRides.map((r) => r.id);
    const allSelected =
      eligibleIds.length > 0 && eligibleIds.every((id) => selectedRideIds.includes(id));
    setSelectedRideIds(allSelected ? [] : eligibleIds);
  };

  const handleRequestMatch = async (ride: RideSearchResult) => {
    if (!matchPoints) return;
    setRequestingId(ride.id);
    try {
      await matchesApi.request({
        ride_id: ride.id,
        ...matchPoints,
      });
      setMyMatchesByRide((prev) => ({ ...prev, [ride.id]: "pending" }));
      setSelectedRideIds((prev) => prev.filter((id) => id !== ride.id));
      toast.success(
        "Solicitação enviada ao motorista!",
        `Apenas a região "${matchPoints.pickup_region}" foi compartilhada. Seu endereço exato só será revelado quando o motorista aceitar.`
      );
    } catch (err: unknown) {
      toast.error("Não foi possível solicitar a carona", getErrorMessage(err));
    } finally {
      setRequestingId(null);
    }
  };

  const handleRequestBatch = async () => {
    if (!matchPoints || selectedRideIds.length === 0) return;
    setBatchRequesting(true);
    try {
      const { data } = await matchesApi.requestBatch({
        ride_ids: selectedRideIds,
        ...matchPoints,
      });

      setMyMatchesByRide((prev) => {
        const next = { ...prev };
        for (const created of data.created) {
          next[created.ride_id] = "pending";
        }
        return next;
      });
      setSelectedRideIds([]);

      const createdCount = data.created.length;
      const skippedCount = data.skipped.length;
      if (createdCount > 0) {
        toast.success(
          `Multi-Matching enviado (${createdCount} ${createdCount === 1 ? "carona" : "caronas"})!`,
          skippedCount > 0
            ? `Assim que 1 motorista aceitar, as demais são encerradas automaticamente. (${skippedCount} ignorada(s)).`
            : "Assim que o primeiro motorista aceitar sua vaga, as demais solicitações do lote são encerradas automaticamente."
        );
      } else {
        toast.info(
          "Nenhuma nova solicitação criada",
          data.skipped[0]?.reason ?? "As caronas selecionadas não puderam receber o pedido."
        );
      }
    } catch (err: unknown) {
      toast.error("Erro ao enviar Multi-Matching", getErrorMessage(err));
    } finally {
      setBatchRequesting(false);
    }
  };

  const results = loading ? (
    <p role="status" className="text-sm text-[var(--color-text-muted)]">Buscando caronas compatíveis…</p>
  ) : searchError ? (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-red-400">{searchError}</p>
      <Button type="button" size="sm" variant="secondary" onClick={() => {
        setSearchResult(null);
        setRetryCount((current) => current + 1);
      }}>Tentar novamente</Button>
    </div>
  ) : searched ? (
    <section className="space-y-4 pt-2 animate-fade-in" aria-label="Resultados da busca">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
          <span>
            {rides.length === 0
              ? "Nenhuma carona disponível para esse trajeto e horário"
              : `${rides.length} ${
                  rides.length === 1 ? "carona encontrada" : "caronas encontradas"
                }`}
          </span>
        </h2>
        {rides.length > 1 && (
          <p className="text-sm text-[var(--color-text-muted)]">Melhor combinação de horário e desvio</p>
        )}
      </div>

      {/* Multi-Matching Batch Bar (shown when 2+ eligible rides exist) */}
      {(eligibleBatchRides.length >= 2 || selectedRideIds.length > 0) && (
        <div
          className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor:
              selectedRideIds.length > 0 ? "var(--color-primary)" : "var(--color-border)",
          }}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-extrabold" style={{ color: "var(--color-text)" }}>
              <CheckCircleIcon size={15} className="text-indigo-400 shrink-0" />
              <span>Solicitar várias caronas</span>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              As outras solicitações são encerradas quando um motorista aceita.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleToggleSelectAll}
            >
              {eligibleBatchRides.length > 0 &&
              eligibleBatchRides.every((r) => selectedRideIds.includes(r.id))
                ? "Limpar seleção"
                : `Selecionar todas (${eligibleBatchRides.length})`}
            </Button>

            {selectedRideIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={batchRequesting}
                onClick={handleRequestBatch}
              >
                Solicitar em Lote ({selectedRideIds.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {rides.length > 0 && (
        <div className="grid gap-4">
          {rides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              onRequestMatch={handleRequestMatch}
              isRequesting={requestingId === ride.id}
              existingMatchStatus={myMatchesByRide[ride.id] ?? null}
              selectable={eligibleBatchRides.length >= 2}
              selected={selectedRideIds.includes(ride.id)}
              onToggleSelect={handleToggleSelectRide}
              passengerPickup={pickup}
              passengerDropoff={dropoff}
            />
          ))}
        </div>
      )}
    </section>
  ) : null;

  return (
    <section className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Pedir carona</h1>
      <TripRouteFields
        route={route}
        onChange={setRoute}
        onSubmit={(event) => event.preventDefault()}
        disabled={batchRequesting || requestingId !== null}
        initialQueries={{
          origin: prefill?.originQuery ?? (prefill?.direction !== "from_campus" ? prefill?.addressQuery : undefined),
          destination: prefill?.destinationQuery ?? (prefill?.direction === "from_campus" ? prefill.addressQuery : undefined),
        }}
      >
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-2 text-sm font-bold text-[var(--color-text)]">Quando você quer embarcar?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Data" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            <Input label="Horário desejado" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Confira o embarque previsto de cada opção; ele pode ser antes ou depois do horário desejado.</p>
        </fieldset>
        {canSearchWomenOnly && (
          <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="mt-0.5 accent-indigo-500" checked={womenOnly} onChange={(event) => setWomenOnly(event.target.checked)} />
            Mostrar apenas caronas exclusivas para mulheres
          </label>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">O endereço exato da origem só é compartilhado após o aceite.</p>
      </TripRouteFields>
      {results}
    </section>
  );
};
