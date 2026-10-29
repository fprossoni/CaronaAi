/**
 * OfferRidePage ("Oferecer Carona")
 *
 * Guided driver ride creation flow inspired by BlaBlaCar & Uber:
 * - Verifies `user.is_driver` upfront and allows instant driver activation if needed
 *   (preventing unexpected 403 Forbidden errors on submit).
 * - Enforces the UFRGS Campus rule (Origin OR Destination must be an official campus)
 *   with intuitive trip direction tabs ("Indo para o Campus" / "Saindo do Campus").
 * - Computes and renders a live OSRM route preview on the interactive map before publishing.
 */

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import {
  campusToLocation,
  fetchRoutePreview,
  geocodingService,
  type LocationValue,
  type RoutePreviewResult,
} from "@/lib/geocoding";
import { formatCarPlate, formatDistance, formatDuration, isValidCarPlate } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import {
  CarIcon,
  ClockIcon,
  NavigationIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/ui/Icons";

type TripDirection = "to_campus" | "from_campus";

function getDefaultDepartureTime(): string {
  const d = new Date(Date.now() + 45 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const OfferRidePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillCampus = (location.state as { campus?: CampusId } | null)?.campus;

  const { user, setUser } = useAuthStore();
  const toast = useToastStore();

  // Quick driver activation state (if user registered as passenger-only)
  const [carModel, setCarModel] = useState(user?.car_model ?? "");
  const [carColor, setCarColor] = useState(user?.car_color ?? "");
  const [carPlate, setCarPlate] = useState(user?.car_plate ?? "");
  const [activatingDriver, setActivatingDriver] = useState(false);

  // Ride Creation State
  const [direction, setDirection] = useState<TripDirection>("to_campus");
  const [campusId, setCampusId] = useState<CampusId>(prefillCampus ?? "campus_vale");
  const [customPoint, setCustomPoint] = useState<LocationValue | null>(() => ({
    label: "Av. Osvaldo Aranha — Bom Fim",
    region: "Bom Fim, Porto Alegre",
    lat: -30.0338,
    lng: -51.2145,
  }));
  const [pickOnMap, setPickOnMap] = useState(false);

  const [departureAt, setDepartureAt] = useState<string>(getDefaultDepartureTime);
  const [delayTolerance, setDelayTolerance] = useState<number>(15);
  const [totalSeats, setTotalSeats] = useState<number>(3);
  const [womenOnly, setWomenOnly] = useState<boolean>(false);

  const [routePreview, setRoutePreview] = useState<RoutePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const campusLocation = campusToLocation(campusId)!;
  const originLocation = direction === "to_campus" ? customPoint : campusLocation;
  const destinationLocation = direction === "to_campus" ? campusLocation : customPoint;

  // Live Route Preview Calculation
  const originLat = originLocation?.lat;
  const originLng = originLocation?.lng;
  const destLat = destinationLocation?.lat;
  const destLng = destinationLocation?.lng;

  useEffect(() => {
    if (originLat == null || originLng == null || destLat == null || destLng == null) {
      return;
    }
    let active = true;
    fetchRoutePreview(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng }
    ).then((res) => {
      if (active) setRoutePreview(res);
    });
    return () => {
      active = false;
    };
  }, [originLat, originLng, destLat, destLng]);

  const handleActivateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carPlate.trim() && !isValidCarPlate(carPlate)) {
      toast.error(
        "Placa inválida",
        "Use o formato ABC1234 ou padrão Mercosul ABC1C34."
      );
      return;
    }

    setActivatingDriver(true);
    try {
      const { data } = await usersApi.updateMe({
        is_driver: true,
        car_model: carModel.trim() || undefined,
        car_color: carColor.trim() || undefined,
        car_plate: carPlate.trim() ? formatCarPlate(carPlate) : undefined,
      });
      setUser(data);
      toast.success(
        "Modo Motorista ativado!",
        "Agora você já pode publicar caronas para a comunidade UFRGS."
      );
    } catch (err: unknown) {
      toast.error("Erro ao ativar perfil de motorista", getErrorMessage(err));
    } finally {
      setActivatingDriver(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const resolved = await geocodingService.reverseGeocode(lat, lng);
    setCustomPoint(resolved);
    setPickOnMap(false);
    toast.info(
      direction === "to_campus" ? "Ponto de partida definido" : "Ponto de chegada definido",
      resolved.label
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!originLocation || !destinationLocation) {
      setError("Defina os endereços de origem e destino da viagem.");
      return;
    }

    if (!departureAt) {
      setError("Informe a data e o horário de saída.");
      return;
    }

    setLoading(true);
    try {
      await ridesApi.create({
        campus_point: campusId,
        direction,
        address_id: customPoint?.addressId ?? undefined,
        origin_label: originLocation.label,
        origin_lat: originLocation.lat,
        origin_lng: originLocation.lng,
        destination_label: destinationLocation.label,
        destination_lat: destinationLocation.lat,
        destination_lng: destinationLocation.lng,
        departure_at: new Date(departureAt).toISOString(),
        delay_tolerance_minutes: Number(delayTolerance),
        total_seats: Number(totalSeats),
        women_only: womenOnly,
      });
      toast.success(
        "Carona publicada com sucesso!",
        "Os estudantes que compartilham seu trajeto já podem enviar solicitações."
      );
      navigate("/rides");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao publicar carona. Verifique os dados."));
    } finally {
      setLoading(false);
    }
  };

  // Guard: If user is not registered as a driver yet, show instant activation card
  if (user && !user.is_driver) {
    return (
      <div className="max-w-xl mx-auto py-6 animate-fade-in">
        <div
          className="rounded-3xl p-6 md:p-8 border shadow-xl space-y-5"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <CarIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold" style={{ color: "var(--color-text)" }}>
              Ative seu Perfil de Motorista
            </h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              No momento sua conta está configurada apenas como <strong>Passageiro</strong>.
              Ative o modo motorista abaixo (e opcionalmente informe seu veículo) para oferecer
              caronas.
            </p>
          </div>

          <form onSubmit={handleActivateDriver} className="space-y-4">
            <Input
              label="Modelo do veículo (opcional)"
              placeholder="Ex.: Chevrolet Onix 2021"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Cor (opcional)"
                placeholder="Ex.: Prata"
                value={carColor}
                onChange={(e) => setCarColor(e.target.value)}
              />
              <Input
                label="Placa (opcional)"
                placeholder="ABC1234 ou ABC1C34"
                maxLength={7}
                value={carPlate}
                onChange={(e) => setCarPlate(formatCarPlate(e.target.value))}
              />
            </div>

            <Button type="submit" fullWidth loading={activatingDriver}>
              Habilitar Modo Motorista e Continuar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mb-2">
          <CarIcon size={13} /> Compartilhe seu trajeto UFRGS
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
          Oferecer Carona
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Defina seu campus e endereço, confira a rota sugerida no mapa e escolha quantas vagas deseja abrir.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-3xl p-5 md:p-6 border space-y-5 shadow-xl"
          style={{
            background: "var(--gradient-card)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Step 1: Trip Direction Selector */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              1. Sentido da Viagem
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDirection("to_campus")}
                className="p-3 rounded-2xl border text-left transition-all"
                style={{
                  backgroundColor:
                    direction === "to_campus"
                      ? "rgba(99, 102, 241, 0.16)"
                      : "var(--color-surface-2)",
                  borderColor:
                    direction === "to_campus" ? "var(--color-primary)" : "var(--color-border)",
                }}
              >
                <span className="text-xs font-extrabold block" style={{ color: "var(--color-text)" }}>
                  🎓 Indo para a UFRGS
                </span>
                <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Saindo de casa/bairro rumo ao Campus
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDirection("from_campus")}
                className="p-3 rounded-2xl border text-left transition-all"
                style={{
                  backgroundColor:
                    direction === "from_campus"
                      ? "rgba(99, 102, 241, 0.16)"
                      : "var(--color-surface-2)",
                  borderColor:
                    direction === "from_campus" ? "var(--color-primary)" : "var(--color-border)",
                }}
              >
                <span className="text-xs font-extrabold block" style={{ color: "var(--color-text)" }}>
                  🏠 Saindo da UFRGS
                </span>
                <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Partindo do Campus rumo ao seu destino
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Campus Selection */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              2. {direction === "to_campus" ? "Campus de Destino (UFRGS)" : "Campus de Partida (UFRGS)"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {UFRGS_CAMPUS.map((c) => {
                const active = campusId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCampusId(c.id)}
                    className="px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all"
                    style={{
                      backgroundColor: active ? "var(--color-primary)" : "var(--color-surface-2)",
                      borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                      color: active ? "#ffffff" : "var(--color-text)",
                    }}
                  >
                    {c.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Custom Origin or Destination Address */}
          <LocationField
            label={
              direction === "to_campus"
                ? "3. Endereço de Partida (Sua Origem)"
                : "3. Endereço de Chegada (Seu Destino)"
            }
            placeholder="Digite rua, número ou bairro em Porto Alegre / Região..."
            value={customPoint}
            onChange={setCustomPoint}
            dotColor={direction === "to_campus" ? "#10b981" : "#6366f1"}
            showCampusShortcuts={false}
            isPickingOnMap={pickOnMap}
            onTogglePickOnMap={() => setPickOnMap((prev) => !prev)}
          />

          {/* Step 4: Schedule & Seats */}
          <div className="pt-2 border-t space-y-4" style={{ borderColor: "var(--color-border)" }}>
            <label
              className="block text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--color-text-secondary)" }}
            >
              4. Horário, Vagas e Preferências
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Input
                  label="Data e Hora de Saída"
                  type="datetime-local"
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                  required
                />
              </div>

              <div>
                <Input
                  label="Assentos Livres (1–6)"
                  type="number"
                  min={1}
                  max={6}
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <Input
                  label="Tolerância (min)"
                  type="number"
                  min={0}
                  max={60}
                  value={delayTolerance}
                  onChange={(e) => setDelayTolerance(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <label
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border cursor-pointer transition-colors"
              style={{
                backgroundColor: womenOnly ? "rgba(236, 72, 153, 0.12)" : "var(--color-surface-2)",
                borderColor: womenOnly ? "#ec4899" : "var(--color-border)",
              }}
            >
              <div className="text-xs">
                <span className="font-bold block" style={{ color: "var(--color-text)" }}>
                  ♀ Carona exclusiva para mulheres
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  Visível apenas para passageiras verificadas na busca com filtro "Só Mulheres"
                </span>
              </div>
              <input
                type="checkbox"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
                className="w-4 h-4 accent-pink-500 shrink-0"
              />
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            <CarIcon size={18} />
            <span>Publicar Oferta de Carona</span>
          </Button>
        </form>

        {/* Right Column: Live Route Preview Map */}
        <div className="lg:col-span-5 space-y-3">
          <div
            className="rounded-3xl p-4 border space-y-3"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-text-secondary)" }}>
                <NavigationIcon size={14} className="text-indigo-400" />
                Pré-visualização da Rota
              </span>
              {routePreview && (
                <span className="text-xs font-bold text-emerald-400">
                  {formatDistance(routePreview.distanceMeters)} • ~
                  {formatDuration(routePreview.durationSeconds)}
                </span>
              )}
            </div>

            <InteractiveMap
              height="320px"
              origin={
                originLocation
                  ? {
                      lat: originLocation.lat,
                      lng: originLocation.lng,
                      label: originLocation.label,
                    }
                  : null
              }
              destination={
                destinationLocation
                  ? {
                      lat: destinationLocation.lat,
                      lng: destinationLocation.lng,
                      label: destinationLocation.label,
                    }
                  : null
              }
              routeGeoJson={routePreview?.geometry ?? null}
              interactivePickMode={
                pickOnMap ? (direction === "to_campus" ? "origin" : "destination") : null
              }
              onMapClick={handleMapClick}
            />

            {/* Route Summary Footer */}
            <div
              className="p-3 rounded-2xl border text-xs space-y-1.5"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate" style={{ color: "var(--color-text)" }}>
                  <strong>Saída:</strong> {originLocation?.label ?? "Não definida"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="truncate" style={{ color: "var(--color-text)" }}>
                  <strong>Chegada:</strong> {destinationLocation?.label ?? "Não definida"}
                </span>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                <span className="flex items-center gap-1">
                  <UsersIcon size={12} /> {totalSeats} vagas
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon size={12} /> Tolerância ±{delayTolerance} min
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheckIcon size={12} /> Rota OSRM
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
