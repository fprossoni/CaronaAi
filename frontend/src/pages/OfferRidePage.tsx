import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { addMinutes, format, startOfMinute } from "date-fns";
import { ridesApi } from "@/api/rides";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { TripRouteFields } from "@/components/rides/TripRouteFields";
import { getInitialTripRoute, hasTripCampus, type TripPrefill, type TripRoute } from "@/lib/tripRoute";
import { formatCarPlate, isValidCarPlate } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export const OfferRidePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state as TripPrefill | null;

  const { user, setUser } = useAuthStore();
  const canOfferWomenOnly = user?.gender === "female";
  const toast = useToastStore();

  const [carModel, setCarModel] = useState(user?.car_model ?? "");
  const [carColor, setCarColor] = useState(user?.car_color ?? "");
  const [carPlate, setCarPlate] = useState(user?.car_plate ?? "");
  const [activatingDriver, setActivatingDriver] = useState(false);

  const [route, setRoute] = useState<TripRoute>(() => getInitialTripRoute(prefill));
  const [departureAt, setDepartureAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [departureEdited, setDepartureEdited] = useState(false);
  const [totalSeats, setTotalSeats] = useState(3);
  const [womenOnly, setWomenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { origin: originLocation, destination: destinationLocation } = route;

  const handleActivateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carPlate.trim() && !isValidCarPlate(carPlate)) {
      toast.error("Placa inválida", "Use ABC1234 ou ABC1C34.");
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
      toast.success("Modo motorista ativado");
    } catch (err: unknown) {
      toast.error("Erro ao ativar", getErrorMessage(err));
    } finally {
      setActivatingDriver(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!originLocation || !destinationLocation) {
      setError("Confirme origem e destino.");
      return;
    }
    if (!hasTripCampus(route)) return;

    if (!departureAt) {
      setError("Informe data e horário de saída.");
      return;
    }

    const departure = departureEdited
      ? new Date(departureAt)
      : addMinutes(startOfMinute(new Date()), 1);

    setLoading(true);
    try {
      await ridesApi.create({
        origin_campus_id: originLocation.campusId,
        destination_campus_id: destinationLocation.campusId,
        origin_address_id: originLocation.addressId,
        destination_address_id: destinationLocation.addressId,
        origin_label: originLocation.label,
        origin_lat: originLocation.lat,
        origin_lng: originLocation.lng,
        destination_label: destinationLocation.label,
        destination_lat: destinationLocation.lat,
        destination_lng: destinationLocation.lng,
        departure_at: departure.toISOString(),
        total_seats: Number(totalSeats),
        women_only: canOfferWomenOnly && womenOnly,
      });
      toast.success("Carona publicada");
      navigate("/rides");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao publicar carona."));
    } finally {
      setLoading(false);
    }
  };

  if (user && !user.is_driver) {
    return (
      <div className="max-w-lg mx-auto py-6 animate-fade-in">
        <div className="rounded-[10px] p-6 border border-border-strong bg-surface shadow-md space-y-5">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold text-text">Ativar modo motorista</h1>
            <p className="text-xs text-text-muted">
              Informe os dados opcionais do veículo para publicar caronas.
            </p>
          </div>

          <form onSubmit={handleActivateDriver} className="space-y-4">
            <Input
              label="Modelo (opcional)"
              placeholder="Chevrolet Onix 2021"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Cor (opcional)"
                placeholder="Prata"
                value={carColor}
                onChange={(e) => setCarColor(e.target.value)}
              />
              <Input
                label="Placa (opcional)"
                placeholder="ABC1C34"
                maxLength={7}
                value={carPlate}
                onChange={(e) => setCarPlate(formatCarPlate(e.target.value))}
              />
            </div>

            <Button type="submit" fullWidth loading={activatingDriver}>
              <span>Ativar e continuar</span>
              <KineticChevrons />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold tracking-tight text-text">Oferecer carona</h1>
      <TripRouteFields
        route={route}
        onChange={(update) => {
          setRoute(update);
          setError("");
        }}
        onSubmit={handleSubmit}
        disabled={loading}
        showRoutePreview
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Saída"
            type="datetime-local"
            value={departureAt}
            onChange={(event) => {
              setDepartureEdited(true);
              setDepartureAt(event.target.value);
            }}
            required
          />
          <Input
            label="Vagas livres"
            type="number"
            min={1}
            max={6}
            value={totalSeats}
            onChange={(event) => setTotalSeats(Number(event.target.value))}
            required
          />
        </div>
        {canOfferWomenOnly && (
          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary w-4 h-4 rounded-[2px]"
              checked={womenOnly}
              onChange={(event) => setWomenOnly(event.target.checked)}
            />
            <span>Carona exclusiva para mulheres</span>
          </label>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          <span>Publicar carona</span>
          <KineticChevrons />
        </Button>
      </TripRouteFields>
    </section>
  );
};
