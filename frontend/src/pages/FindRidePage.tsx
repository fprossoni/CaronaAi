import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
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
import { KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircleIcon, LockIcon } from "@/components/ui/Icons";

type SearchResult = { params: SearchRidesParams } & ({ rides: RideSearchResult[] } | { error: string });

type SubmittedSearch = {
  params: SearchRidesParams;
  pickup: NonNullable<TripRoute["origin"]>;
  dropoff: NonNullable<TripRoute["destination"]>;
};

const NO_RIDES: RideSearchResult[] = [];

export const FindRidePage: React.FC = () => {
  const location = useLocation();
  const prefill = location.state as TripPrefill | null;
  const toast = useToastStore();
  const canSearchWomenOnly = useAuthStore((state) => state.user?.gender === "female");
  const [route, setRoute] = useState<TripRoute>(() => getInitialTripRoute(prefill));
  const [{ date, startTime }, setSchedule] = useState(() => {
    const now = new Date();
    return { date: format(now, "yyyy-MM-dd"), startTime: format(now, "HH:mm") };
  });
  const [womenOnly, setWomenOnly] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<SubmittedSearch | null>(null);
  const [myMatchesByRide, setMyMatchesByRide] = useState<Record<number, MatchStatus>>({});
  const [selection, setSelection] = useState<{ params: SearchRidesParams | null; ids: number[] }>({
    params: null,
    ids: [],
  });
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [batchRequesting, setBatchRequesting] = useState(false);

  const { origin: pickup, destination: dropoff } = route;
  const hasCampus = hasTripCampus(route);
  const startAt = date && startTime ? Date.parse(date + "T" + startTime) : NaN;
  const validWindow = Number.isFinite(startAt);
  const params = submittedSearch?.params ?? null;
  const canSearch = Boolean(pickup && dropoff && hasCampus && validWindow);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSearch || !pickup || !dropoff) return;

    setSubmittedSearch({
      pickup,
      dropoff,
      params: {
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
      },
    });
    setSearchResult(null);
    setSelection({ params: null, ids: [] });
  }

  const result = params && searchResult?.params === params ? searchResult : null;
  const searched = result !== null && "rides" in result;
  const rides = result && "rides" in result ? result.rides : NO_RIDES;
  const searchError = result && "error" in result ? result.error : null;
  const loading = params !== null && result === null;
  const selectedRideIds = selection.params === params ? selection.ids : [];
  const matchPoints =
    searched && submittedSearch
      ? {
          pickup_campus_id: submittedSearch.params.pickup_campus_id,
          dropoff_campus_id: submittedSearch.params.dropoff_campus_id,
          desired_pickup_at: submittedSearch.params.desired_pickup_at,
          pickup_address_id: submittedSearch.params.pickup_address_id,
          pickup_lat: submittedSearch.params.pickup_lat,
          pickup_lng: submittedSearch.params.pickup_lng,
          pickup_label: submittedSearch.pickup.label,
          pickup_region: submittedSearch.pickup.region || "Região próxima",
          dropoff_address_id: submittedSearch.params.dropoff_address_id,
          dropoff_lat: submittedSearch.params.dropoff_lat,
          dropoff_lng: submittedSearch.params.dropoff_lng,
          dropoff_label: submittedSearch.dropoff.label,
        }
      : null;

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
    ridesApi
      .search(params, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) setSearchResult({ params, rides: data });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setSearchResult({
            params,
            error: getErrorMessage(err, "Não foi possível buscar caronas."),
          });
        }
      });
    return () => controller.abort();
  }, [params]);

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
        "Solicitação enviada",
        `Bairro "${matchPoints.pickup_region}" compartilhado.`
      );
    } catch (err: unknown) {
      toast.error("Não foi possível solicitar", getErrorMessage(err));
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
      if (createdCount > 0) {
        toast.success(
          `Lote enviado (${createdCount})`,
          "O primeiro aceite encerra as demais solicitações."
        );
      } else {
        toast.info(
          "Nenhuma solicitação criada",
          data.skipped[0]?.reason ?? "Caronas indisponíveis."
        );
      }
    } catch (err: unknown) {
      toast.error("Erro no Multi-Matching", getErrorMessage(err));
    } finally {
      setBatchRequesting(false);
    }
  };

  const results = loading ? (
    <p role="status" className="font-mono text-xs text-text-muted py-6">
      Buscando caronas…
    </p>
  ) : searchError !== null ? (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-danger">
        {searchError}
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          setSearchResult(null);
          setSubmittedSearch((current) => current && { ...current, params: { ...current.params } });
        }}
      >
        Tentar novamente
      </Button>
    </div>
  ) : searched ? (
    <section className="space-y-4 pt-1 animate-fade-in" aria-label="Resultados da busca">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-bold text-text">
          {rides.length === 0
            ? "Nenhuma carona compatível"
            : `${rides.length} ${rides.length === 1 ? "carona" : "caronas"}`}
        </h2>
        {rides.length > 1 && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Por relevância
          </span>
        )}
      </div>

      {/* Multi-Matching Batch Bar */}
      {(eligibleBatchRides.length >= 2 || selectedRideIds.length > 0) && (
        <div
          className={`p-3.5 rounded-[10px] border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            selectedRideIds.length > 0 ? "border-primary" : "border-border"
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <CheckCircleIcon size={15} className="text-accent-text shrink-0" />
            <span>
              <strong className="text-text">Multi-Matching</strong> · O primeiro aceite cancela os
              demais pedidos
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={handleToggleSelectAll}>
              {eligibleBatchRides.length > 0 &&
              eligibleBatchRides.every((r) => selectedRideIds.includes(r.id))
                ? "Limpar"
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
                Solicitar lote ({selectedRideIds.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {rides.length > 0 && (
        <div className="grid gap-3.5">
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
            />
          ))}
        </div>
      )}
    </section>
  ) : null;

  return (
    <section className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold tracking-tight text-text">Pedir carona</h1>
      {submittedSearch && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-surface px-4 py-3">
          <dl className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary wrap-anywhere">
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Origem</dt>
              <span className="size-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <dd className="font-semibold text-text">{submittedSearch.pickup.label}</dd>
            </div>
            <span className="font-mono text-text-muted" aria-hidden="true">
              →
            </span>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Destino</dt>
              <span className="size-2 rounded-full bg-secondary shrink-0" aria-hidden="true" />
              <dd className="font-semibold text-text">{submittedSearch.dropoff.label}</dd>
            </div>
          </dl>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={batchRequesting || requestingId !== null}
            onClick={() => {
              setSubmittedSearch(null);
              setSearchResult(null);
              setSelection({ params: null, ids: [] });
            }}
          >
            Alterar
          </Button>
        </div>
      )}
      <div hidden={submittedSearch !== null}>
        <TripRouteFields
          route={route}
          onChange={setRoute}
          onSubmit={handleSearch}
          disabled={batchRequesting || requestingId !== null}
          showRoutePreview={false}
          allowMeetingPoint
          initialQueries={{
            origin:
              prefill?.originQuery ??
              (prefill?.direction !== "from_campus" ? prefill?.addressQuery : undefined),
            destination:
              prefill?.destinationQuery ??
              (prefill?.direction === "from_campus" ? prefill.addressQuery : undefined),
          }}
        >
          <div className="space-y-3">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
              Horário
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Data"
                type="date"
                value={date}
                onChange={(event) => setSchedule({ date: event.target.value, startTime })}
                required
              />
              <Input
                label="Horário desejado"
                type="time"
                value={startTime}
                onChange={(event) => setSchedule({ date, startTime: event.target.value })}
                required
              />
            </div>
          </div>
          {canSearchWomenOnly && (
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary w-4 h-4 rounded-[2px]"
                checked={womenOnly}
                onChange={(event) => setWomenOnly(event.target.checked)}
              />
              <span>Apenas caronas exclusivas para mulheres</span>
            </label>
          )}
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <LockIcon size={13} className="shrink-0 text-text-secondary" />
            <span>Apenas seu bairro fica visível antes do aceite.</span>
          </p>
          <Button type="submit" fullWidth size="lg" disabled={!canSearch}>
            <span>Procurar caronas</span>
            <KineticChevrons />
          </Button>
        </TripRouteFields>
      </div>
      {results}
    </section>
  );
};
