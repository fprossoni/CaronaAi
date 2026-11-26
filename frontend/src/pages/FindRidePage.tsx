import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import type { RideSearchResult, SearchRidesParams } from "@/types/ride";
import type { MatchPublic } from "@/types/match";
import { getInitialTripRoute, hasTripCampus, type TripPrefill, type TripRoute } from "@/lib/tripRoute";
import { hasCompleteLocation } from "@/lib/geocoding";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { RideCard } from "@/components/rides/RideCard";
import { TripRouteFields } from "@/components/rides/TripRouteFields";
import { KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";


type SearchResult = { params: SearchRidesParams } & ({ rides: RideSearchResult[] } | { error: string });

type SubmittedSearch = {
  batchId: string;
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
  const [myMatches, setMyMatches] = useState<MatchPublic[]>([]);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const { origin: pickup, destination: dropoff } = route;
  const hasCampus = hasTripCampus(route);
  const startAt = date && startTime ? Date.parse(date + "T" + startTime) : NaN;
  const validWindow = Number.isFinite(startAt);
  const params = submittedSearch?.params ?? null;
  const canSearch = Boolean(hasCompleteLocation(pickup) && hasCompleteLocation(dropoff) && hasCampus && validWindow);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSearch || !pickup || !dropoff) return;

    setSubmittedSearch({
      batchId: window.crypto.randomUUID(),
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
  }

  const result = params && searchResult?.params === params ? searchResult : null;
  const searched = result !== null && "rides" in result;
  const confirmedMatch = submittedSearch && myMatches.find(
    (match) => match.batch_id === submittedSearch.batchId && match.status === "accepted",
  );
  const rides = result && "rides" in result
    ? result.rides.filter((ride) => !confirmedMatch || ride.id === confirmedMatch.ride_id)
    : NO_RIDES;
  const searchError = result && "error" in result ? result.error : null;
  const loading = params !== null && result === null;
  const matchPoints =
    searched && submittedSearch
      ? {
          batch_id: submittedSearch.batchId,
          pickup_campus_id: submittedSearch.params.pickup_campus_id,
          dropoff_campus_id: submittedSearch.params.dropoff_campus_id,
          desired_pickup_at: submittedSearch.params.desired_pickup_at,
          pickup_address_id: submittedSearch.params.pickup_address_id,
          pickup_lat: submittedSearch.params.pickup_lat,
          pickup_lng: submittedSearch.params.pickup_lng,
          pickup_label: submittedSearch.pickup.label,
          pickup_street: submittedSearch.pickup.mapAddress?.street,
          pickup_number: submittedSearch.pickup.mapAddress?.number,
          pickup_neighborhood: submittedSearch.pickup.mapAddress?.neighborhood,
          pickup_region: submittedSearch.pickup.region || "Região próxima",
          dropoff_address_id: submittedSearch.params.dropoff_address_id,
          dropoff_lat: submittedSearch.params.dropoff_lat,
          dropoff_lng: submittedSearch.params.dropoff_lng,
          dropoff_label: submittedSearch.dropoff.label,
        }
      : null;

  useEffect(() => {
    if (requestingId !== null) return;
    let active = true;
    let timer: number | undefined;
    async function refreshMatches() {
      try {
        const { data } = await matchesApi.getMyMatches();
        if (active) setMyMatches(data);
      } catch {
        // Preserve the last status while the connection is unavailable.
      } finally {
        if (active && params) timer = window.setTimeout(refreshMatches, 5000);
      }
    }
    void refreshMatches();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params, requestingId]);

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

  const handleRequestMatch = async (ride: RideSearchResult) => {
    if (!matchPoints || confirmedMatch || requestingId !== null) return;
    setRequestingId(ride.id);
    try {
      const { data } = await matchesApi.request({
        ride_id: ride.id,
        ...matchPoints,
      });
      setMyMatches((previous) => [data, ...previous]);
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
          {confirmedMatch
            ? "Carona confirmada"
            : rides.length === 0
            ? "Nenhuma carona compatível"
            : `${rides.length} ${rides.length === 1 ? "carona" : "caronas"}`}
        </h2>
        {rides.length > 1 && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Por relevância
          </span>
        )}
      </div>

      {rides.length > 0 && (
        <div className="grid gap-3.5">
          {rides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              onRequestMatch={handleRequestMatch}
              isRequesting={requestingId === ride.id}
              requestDisabled={requestingId !== null}
              existingMatchStatus={myMatches.find(
                (match) => match.ride_id === ride.id && (match.status === "pending" || match.status === "accepted"),
              )?.status ?? null}
            />
          ))}
        </div>
      )}
    </section>
  ) : null;

  return (
    <section className="mx-auto w-full min-w-0 space-y-5 animate-fade-in">
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
            disabled={requestingId !== null}
            onClick={() => {
              setSubmittedSearch(null);
              setSearchResult(null);
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
          disabled={requestingId !== null}
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
