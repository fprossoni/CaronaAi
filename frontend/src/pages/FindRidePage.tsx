/**
 * FindRidePage ("Pedir Carona")
 *
 * Uber/BlaBlaCar-inspired ride discovery experience:
 * - Smart address autocomplete, UFRGS Campus quick pills, GPS, and click-on-map selection
 *   (replacing manual latitude/longitude entry).
 * - Optional destination (`dropoff`), departure time filter (`departure_after`), and
 *   "Só Mulheres" (`women_only`) filter.
 * - Automatic extraction of `pickup_region` (neighborhood/zone) so the passenger's exact
 *   street address remains confidential until the driver accepts the match.
 */

import React, { useEffect, useState } from "react";
import { ridesApi } from "@/api/rides";
import { matchesApi } from "@/api/matches";
import type { RidePublic } from "@/types/ride";
import type { MatchStatus } from "@/types/match";
import {
  campusToLocation,
  fetchRoutePreview,
  geocodingService,
  type LocationValue,
} from "@/lib/geocoding";
import { getErrorMessage } from "@/lib/errors";
import { useToastStore } from "@/store/toastStore";
import { RideCard } from "@/components/rides/RideCard";
import { Button } from "@/components/ui/Button";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import {
  ArrowRightLeftIcon,
  FilterIcon,
  NavigationIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/Icons";

export const FindRidePage: React.FC = () => {
  const toast = useToastStore();

  // Default pickup: Campus Centro; Default destination: Campus do Vale (easy 1-click start)
  const [pickup, setPickup] = useState<LocationValue | null>(() =>
    campusToLocation("campus_centro")
  );
  const [dropoff, setDropoff] = useState<LocationValue | null>(() =>
    campusToLocation("campus_vale")
  );
  const [includeDropoff, setIncludeDropoff] = useState<boolean>(true);
  const [womenOnly, setWomenOnly] = useState<boolean>(false);
  const [departureAfter, setDepartureAfter] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Map interaction mode ("pickup" | "destination" | null)
  const [pickMode, setPickMode] = useState<"pickup" | "destination" | null>(null);
  const [previewGeoJson, setPreviewGeoJson] = useState<GeoJSON.LineString | null>(null);

  // Search results & existing match statuses
  const [rides, setRides] = useState<RidePublic[]>([]);
  const [myMatchesByRide, setMyMatchesByRide] = useState<Record<number, MatchStatus>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  // Load passenger's existing match requests so cards show real-time status
  useEffect(() => {
    matchesApi
      .getMyMatches()
      .then(({ data }) => {
        const map: Record<number, MatchStatus> = {};
        for (const m of data) {
          if (m.status === "pending" || m.status === "accepted") {
            map[m.ride_id] = m.status;
          }
        }
        setMyMatchesByRide(map);
      })
      .catch(() => {
        // Ignore silently
      });
  }, []);

  // Update route preview line on map when both pickup and dropoff are set
  useEffect(() => {
    if (!pickup || !includeDropoff || !dropoff) {
      return;
    }
    let active = true;
    fetchRoutePreview(
      { lat: pickup.lat, lng: pickup.lng },
      { lat: dropoff.lat, lng: dropoff.lng }
    ).then((res) => {
      if (active) setPreviewGeoJson(res.geometry);
    });
    return () => {
      active = false;
    };
  }, [pickup, dropoff, includeDropoff]);

  const activeRouteGeoJson = pickup && includeDropoff && dropoff ? previewGeoJson : null;

  const handleMapClick = async (lat: number, lng: number) => {
    const target = pickMode ?? "pickup";
    const resolved = await geocodingService.reverseGeocode(lat, lng);
    if (target === "destination") {
      setIncludeDropoff(true);
      setDropoff(resolved);
      toast.info("Destino atualizado pelo mapa", resolved.label);
    } else {
      setPickup(resolved);
      toast.info("Local de embarque atualizado pelo mapa", resolved.label);
    }
    setPickMode(null);
  };

  const handleSwapLocations = () => {
    if (!pickup || !dropoff) return;
    const prevPickup = pickup;
    setPickup(dropoff);
    setDropoff(prevPickup);
    setIncludeDropoff(true);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !pickup.label.trim()) {
      toast.error("Informe seu local de embarque", "Digite um endereço, use seu GPS ou selecione um campus.");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data } = await ridesApi.search({
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_label: pickup.label,
        dropoff_lat: includeDropoff && dropoff ? dropoff.lat : undefined,
        dropoff_lng: includeDropoff && dropoff ? dropoff.lng : undefined,
        women_only: womenOnly,
        departure_after: departureAfter ? new Date(departureAfter).toISOString() : undefined,
      });
      setRides(data);
    } catch (err: unknown) {
      toast.error("Erro ao buscar caronas", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMatch = async (ride: RidePublic) => {
    if (!pickup) return;
    setRequestingId(ride.id);
    try {
      await matchesApi.request({
        ride_id: ride.id,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_label: pickup.label,
        pickup_region: pickup.region || pickup.label,
        dropoff_lat: includeDropoff && dropoff ? dropoff.lat : undefined,
        dropoff_lng: includeDropoff && dropoff ? dropoff.lng : undefined,
        dropoff_label: includeDropoff && dropoff ? dropoff.label : undefined,
      });
      setMyMatchesByRide((prev) => ({ ...prev, [ride.id]: "pending" }));
      toast.success(
        "Solicitação enviada ao motorista!",
        `Apenas a região "${pickup.region}" foi compartilhada. Seu endereço exato só será revelado quando o motorista aceitar.`
      );
    } catch (err: unknown) {
      toast.error("Não foi possível solicitar a carona", getErrorMessage(err));
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Para onde vamos hoje?
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Encontre motoristas da UFRGS ordenados pelo menor desvio de rota até você.
          </p>
        </div>
      </div>

      {/* Main Split Grid: Search Panel + Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search Form Card */}
        <form
          onSubmit={handleSearch}
          className="lg:col-span-7 rounded-3xl p-5 md:p-6 border space-y-5 shadow-xl"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Pickup Location Field */}
          <LocationField
            label="Onde você quer embarcar?"
            placeholder="Digite sua rua, bairro ou selecione um campus..."
            value={pickup}
            onChange={setPickup}
            dotColor="#10b981"
            isPickingOnMap={pickMode === "pickup"}
            onTogglePickOnMap={() =>
              setPickMode((prev) => (prev === "pickup" ? null : "pickup"))
            }
          />

          {/* Swap / Optional Destination Toggle Bar */}
          <div className="flex items-center justify-between gap-2 py-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
              <input
                type="checkbox"
                checked={includeDropoff}
                onChange={(e) => setIncludeDropoff(e.target.checked)}
                className="accent-indigo-500 rounded"
              />
              <span>Especificar destino / desembarque</span>
            </label>

            {includeDropoff && pickup && dropoff && (
              <button
                type="button"
                onClick={handleSwapLocations}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors hover:border-indigo-500/50"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-primary-light)",
                }}
              >
                <ArrowRightLeftIcon size={13} />
                <span>Inverter origem e destino</span>
              </button>
            )}
          </div>

          {/* Optional Dropoff Location Field */}
          {includeDropoff && (
            <LocationField
              label="Para qual destino ou campus?"
              placeholder="Ex.: UFRGS Campus do Vale, Campus Centro..."
              value={dropoff}
              onChange={setDropoff}
              dotColor="#6366f1"
              allowGps={false}
              isPickingOnMap={pickMode === "destination"}
              onTogglePickOnMap={() =>
                setPickMode((prev) => (prev === "destination" ? null : "destination"))
              }
            />
          )}

          {/* Filters Bar */}
          <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                style={{
                  backgroundColor: showFilters ? "rgba(99, 102, 241, 0.15)" : "var(--color-surface-2)",
                  borderColor: showFilters ? "var(--color-primary)" : "var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <FilterIcon size={13} className="text-indigo-400" />
                <span>Filtros de horário e preferência</span>
              </button>

              <label
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  backgroundColor: womenOnly ? "rgba(236, 72, 153, 0.15)" : "var(--color-surface-2)",
                  borderColor: womenOnly ? "#ec4899" : "var(--color-border)",
                  color: womenOnly ? "#f472b6" : "var(--color-text-secondary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={womenOnly}
                  onChange={(e) => setWomenOnly(e.target.checked)}
                  className="accent-pink-500"
                />
                <span>♀ Só Mulheres</span>
              </label>
            </div>

            {showFilters && (
              <div
                className="p-3.5 rounded-2xl border animate-fade-in"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Partida a partir de (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={departureAfter}
                    onChange={(e) => setDepartureAfter(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                  {departureAfter && (
                    <button
                      type="button"
                      onClick={() => setDepartureAfter("")}
                      className="text-xs font-semibold text-indigo-400 hover:underline px-2"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            <SearchIcon size={18} />
            <span>Buscar Caronas Compatíveis</span>
          </Button>
        </form>

        {/* Right Column: Interactive Map Preview + Privacy Explainer */}
        <div className="lg:col-span-5 space-y-3">
          <InteractiveMap
            height="340px"
            pickup={
              pickup
                ? { lat: pickup.lat, lng: pickup.lng, label: `${pickup.region} (Região aproximada)` }
                : null
            }
            pickupIsApproximate={true}
            destination={
              includeDropoff && dropoff
                ? { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.label }
                : null
            }
            routeGeoJson={activeRouteGeoJson}
            interactivePickMode={pickMode}
            onMapClick={handleMapClick}
          />

          <div
            className="p-3.5 rounded-2xl border text-xs flex items-start gap-2.5"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <ShieldCheckIcon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong style={{ color: "var(--color-text-secondary)" }}>
                Sua localização exata está protegida:
              </strong>{" "}
              O círculo laranja no mapa mostra como o motorista vê seu pedido antes de aceitar
              (apenas a região <strong>{pickup?.region ?? "do seu bairro"}</strong>). O endereço exato só é
              revelado se a carona for confirmada.
            </div>
          </div>
        </div>
      </div>

      {/* Results Feed */}
      {searched && !loading && (
        <section className="space-y-4 pt-2 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: "var(--color-text)" }}>
              <NavigationIcon size={18} className="text-indigo-400" />
              <span>
                {rides.length === 0
                  ? "Nenhuma carona compatível encontrada"
                  : `${rides.length} ${
                      rides.length === 1 ? "carona encontrada" : "caronas encontradas"
                    }`}
              </span>
            </h2>
            {rides.length > 0 && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-400">
                Ordenadas pelo menor desvio de rota (máx. 3 km)
              </span>
            )}
          </div>

          {rides.length === 0 ? (
            <div
              className="rounded-3xl p-10 border text-center space-y-2"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <p className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                Nenhum motorista passa a menos de 3 km deste ponto no momento.
              </p>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--color-text-muted)" }}>
                Experimente selecionar um ponto de embarque próximo a uma avenida principal ou
                ajuste o filtro de destino/horário.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onRequestMatch={handleRequestMatch}
                  isRequesting={requestingId === ride.id}
                  existingMatchStatus={myMatchesByRide[ride.id] ?? null}
                  passengerPickup={
                    pickup ? { lat: pickup.lat, lng: pickup.lng, label: pickup.label } : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
