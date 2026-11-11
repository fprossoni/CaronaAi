import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ridesApi } from "@/api/rides";
import { usersApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { TripRouteFields } from "@/components/rides/TripRouteFields";
import { getInitialTripRoute, type TripPrefill, type TripRoute } from "@/lib/tripRoute";
import { formatCarPlate, isValidCarPlate } from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  const prefill = location.state as TripPrefill | null;

  const { user, setUser } = useAuthStore();
  const canOfferWomenOnly = user?.gender === "female";
  const toast = useToastStore();

  // Quick driver activation state (if user registered as passenger-only)
  const [carModel, setCarModel] = useState(user?.car_model ?? "");
  const [carColor, setCarColor] = useState(user?.car_color ?? "");
  const [carPlate, setCarPlate] = useState(user?.car_plate ?? "");
  const [activatingDriver, setActivatingDriver] = useState(false);

  const [route, setRoute] = useState<TripRoute>(() => getInitialTripRoute(prefill));
  const [departureAt, setDepartureAt] = useState(getDefaultDepartureTime);
  const [totalSeats, setTotalSeats] = useState(3);
  const [womenOnly, setWomenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { origin: originLocation, destination: destinationLocation } = route;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!originLocation || !destinationLocation) {
      setError("Confirme os pontos de origem e destino.");
      return;
    }

    if (!departureAt) {
      setError("Informe a data e o horário de saída.");
      return;
    }

    setLoading(true);
    try {
      await ridesApi.create({
        campus_point: destinationLocation.campusId ?? originLocation.campusId,
        origin_address_id: originLocation.addressId,
        destination_address_id: destinationLocation.addressId,
        origin_label: originLocation.label,
        origin_lat: originLocation.lat,
        origin_lng: originLocation.lng,
        destination_label: destinationLocation.label,
        destination_lat: destinationLocation.lat,
        destination_lng: destinationLocation.lng,
        departure_at: new Date(departureAt).toISOString(),
        total_seats: Number(totalSeats),
        women_only: canOfferWomenOnly && womenOnly,
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
    <section className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Oferecer carona</h1>
      <TripRouteFields
        route={route}
        onChange={(update) => { setRoute(update); setError(""); }}
        onSubmit={handleSubmit}
        disabled={loading}
      >
        <Input label="Data e hora de saída do motorista" type="datetime-local" value={departureAt} onChange={(event) => setDepartureAt(event.target.value)} required />
        <Input label="Vagas disponíveis" type="number" min={1} max={6} value={totalSeats} onChange={(event) => setTotalSeats(Number(event.target.value))} required />
        {canOfferWomenOnly && (
          <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="mt-0.5 accent-indigo-500" checked={womenOnly} onChange={(event) => setWomenOnly(event.target.checked)} />
            Carona exclusiva para mulheres
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" fullWidth size="lg" loading={loading}>Publicar carona</Button>
      </TripRouteFields>
    </section>
  );
};
