import React, { useEffect, useRef, useState } from "react";
import { addressesApi } from "@/api/addresses";
import type { AddressCreate, AddressPublic } from "@/types/address";
import { getErrorMessage } from "@/lib/errors";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const EMPTY_FORM: AddressCreate = {
  label: "",
  postal_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "Porto Alegre",
  state: "RS",
  country: "Brasil",
};

function formatCepInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

interface SavedAddressFormProps {
  onSaved: (address: AddressPublic) => void;
  onCancel: () => void;
  initialValues?: Partial<AddressCreate>;
}

export function SavedAddressForm({ onSaved, onCancel, initialValues }: SavedAddressFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepHint, setCepHint] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<AddressCreate>(() => ({
    ...EMPTY_FORM,
    ...initialValues,
  }));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() =>
    initialValues?.lat != null && initialValues?.lng != null
      ? { lat: initialValues.lat, lng: initialValues.lng }
      : null
  );
  const [manualOverride, setManualOverride] = useState<boolean>(
    () => initialValues?.lat != null && initialValues?.lng != null
  );
  const [geocoding, setGeocoding] = useState(false);
  const latestCep = useRef("");
  const canAutoGeocode = Boolean(form.street.trim() && form.number.trim() && form.city.trim());
  const effectiveCoords = manualOverride || canAutoGeocode ? coords : null;

  useEffect(() => {
    if (manualOverride || !canAutoGeocode) return;
    const street = form.street.trim();
    const number = form.number.trim();
    const city = form.city.trim();

    let active = true;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const { data } = await addressesApi.geocode({
          street,
          number,
          city,
          state: form.state,
          country: form.country,
          postal_code: form.postal_code,
        });
        if (active) {
          setCoords({ lat: data.lat, lng: data.lng });
          if (!form.neighborhood?.trim() && data.neighborhood) {
            setForm((prev) => ({
              ...prev,
              neighborhood: prev.neighborhood || data.neighborhood,
            }));
          }
        }
      } catch {
        // User can click on map
      } finally {
        if (active) setGeocoding(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    form.street,
    form.number,
    form.city,
    form.state,
    form.country,
    form.postal_code,
    form.neighborhood,
    manualOverride,
    canAutoGeocode,
  ]);

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    latestCep.current = cleanCep;
    setCepLoading(cleanCep.length === 8);
    setCepHint("");
    if (cleanCep.length !== 8) return;

    try {
      const { data } = await addressesApi.lookupCep(cleanCep);
      if (latestCep.current !== cleanCep) return;
      setForm((prev) => ({
        ...prev,
        postal_code: data.postal_code || formatCepInput(cleanCep),
        street: data.street || prev.street,
        neighborhood: data.neighborhood || prev.neighborhood,
        city: data.city || prev.city,
        state: data.state || prev.state,
      }));
      setManualOverride(false);
      setCepHint("");
    } catch {
      if (latestCep.current !== cleanCep) return;
      setCepHint("CEP não localizado; preencha manualmente.");
    } finally {
      if (latestCep.current === cleanCep) setCepLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    if (
      !form.street.trim() ||
      !form.number.trim() ||
      form.postal_code.replace(/\D/g, "").length !== 8
    ) {
      setError("Informe CEP (8 dígitos), rua e número.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: created } = await addressesApi.create({
        ...form,
        label: form.label.trim() || "Casa",
        lat: effectiveCoords?.lat ?? null,
        lng: effectiveCoords?.lng ?? null,
      });
      onSaved(created);

      setForm(EMPTY_FORM);
      setCoords(null);
      setManualOverride(false);
      setCepHint("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao salvar endereço."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Apelido"
          placeholder="Casa, Trabalho..."
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          required
        />
        <Input
          label={cepLoading ? "CEP (buscando…)" : "CEP"}
          placeholder="90035-191"
          maxLength={9}
          value={form.postal_code}
          onChange={(e) => {
            const formatted = formatCepInput(e.target.value);
            setForm({ ...form, postal_code: formatted });
            void handleCepLookup(formatted);
          }}
          hint={cepHint || undefined}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            label="Rua / Avenida"
            placeholder="Av. Osvaldo Aranha"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            required
          />
        </div>
        <Input
          label="Número"
          placeholder="1020"
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Complemento"
          placeholder="Apto, bloco..."
          value={form.complement ?? ""}
          onChange={(e) => setForm({ ...form, complement: e.target.value })}
        />
        <Input
          label="Bairro"
          placeholder="Bom Fim"
          value={form.neighborhood ?? ""}
          onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
        />
        <Input
          label="Cidade"
          placeholder="Porto Alegre"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {geocoding ? "Localizando…" : "Mapa (ajuste o pino se precisar)"}
          </span>
          {manualOverride && (
            <button
              type="button"
              onClick={() => setManualOverride(false)}
              className="text-xs font-semibold text-accent-text hover:underline"
            >
              Recalcular
            </button>
          )}
        </div>
        <InteractiveMap
          height="210px"
          origin={
            effectiveCoords
              ? {
                  lat: effectiveCoords.lat,
                  lng: effectiveCoords.lng,
                  label: form.street.trim()
                    ? `${form.street}${form.number.trim() ? `, ${form.number}` : ""}`
                    : form.label || "Endereço",
                }
              : null
          }
          interactivePickMode="origin"
          onMapClick={(lat, lng) => {
            setManualOverride(true);
            setCoords({ lat, lng });
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting} disabled={cepLoading}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
