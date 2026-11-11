import { useEffect, useId, useRef, useState, type Dispatch, type FormEventHandler, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { addressesApi } from "@/api/addresses";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import { SavedAddressForm } from "@/components/profile/SavedAddressForm";
import { Button } from "@/components/ui/Button";
import { UFRGS_CAMPUS } from "@/types/ride";
import type { AddressPublic } from "@/types/address";
import { campusToLocation, geocodingService, type LocationValue } from "@/lib/geocoding";
import type { TripRoute } from "@/lib/tripRoute";

type Endpoint = keyof TripRoute;
const endpoints = [
  { key: "origin", label: "Origem", color: "#10b981" },
  { key: "destination", label: "Destino", color: "#6366f1" },
] as const;
const modes = [
  { key: "address", label: "Endereço avulso" },
  { key: "saved", label: "Endereço salvo" },
  { key: "campus", label: "Campus" },
] as const;
type Mode = typeof modes[number]["key"];

const selectClass = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text)]";

function SaveAddressDialog({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (address: AddressPublic) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text)] shadow-xl backdrop:bg-black/60 sm:p-6"
    >
      <h2 id={titleId} className="mb-4 text-lg font-bold">Salvar novo endereço</h2>
      <SavedAddressForm onCancel={onClose} onSaved={(address) => {
        if (dialog.current?.open) onSaved(address);
      }} />
    </dialog>,
    document.body,
  );
}

function savedLocation(address: AddressPublic): LocationValue {
  return {
    label: `${address.street}, ${address.number} · ${address.city}`,
    region: address.neighborhood ? `${address.neighborhood}, ${address.city}` : address.city,
    lat: address.lat,
    lng: address.lng,
    addressId: address.id,
  };
}

interface TripRouteFieldsProps {
  route: TripRoute;
  onChange: Dispatch<SetStateAction<TripRoute>>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  disabled: boolean;
  initialQueries?: Partial<Record<Endpoint, string>>;
  children: ReactNode;
}

export function TripRouteFields({ route, onChange, onSubmit, disabled, initialQueries, children }: TripRouteFieldsProps) {
  const [mode, setMode] = useState<Record<Endpoint, Mode>>(() => ({
    origin: route.origin?.campusId ? "campus" : "address",
    destination: route.destination?.campusId ? "campus" : "address",
  }));
  const [addresses, setAddresses] = useState<AddressPublic[] | null>(null);
  const [addressError, setAddressError] = useState(false);
  const [savingFor, setSavingFor] = useState<Endpoint | null>(null);
  const [picking, setPicking] = useState<Endpoint | null>(null);
  const mapRequest = useRef(0);
  const mapSection = useRef<HTMLElement>(null);
  const { origin, destination } = route;

  useEffect(() => {
    let active = true;
    addressesApi.list().then(({ data }) => {
      if (active) setAddresses((current) => [
        ...data,
        ...(current ?? []).filter((address) => !data.some(({ id }) => id === address.id)),
      ]);
    }).catch(() => {
      if (active) setAddressError(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (picking) mapSection.current?.scrollIntoView({ block: "nearest" });
  }, [picking]);

  function selectPoint(endpoint: Endpoint, point: LocationValue | null) {
    mapRequest.current++;
    setPicking(null);
    onChange((current) => current[endpoint] === point ? current : { ...current, [endpoint]: point });
  }

  async function pickOnMap(lat: number, lng: number) {
    if (!picking || disabled) return;
    const request = ++mapRequest.current;
    const point = await geocodingService.reverseGeocode(lat, lng);
    if (request === mapRequest.current) selectPoint(picking, point);
  }

  return (
    <>
      <form onSubmit={(event) => {
        mapRequest.current++;
        setPicking(null);
        onSubmit(event);
      }} className="min-w-0">
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {endpoints.map(({ key, label, color }) => (
              <fieldset key={key} className="min-w-0 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <legend className="flex items-center gap-2 px-2 font-bold text-[var(--color-text)]">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {modes.map(({ key: option, label: optionLabel }) => (
                    <Button key={option} type="button" size="sm" variant={mode[key] === option ? "primary" : "secondary"}
                      aria-pressed={mode[key] === option} onClick={() => {
                        if (mode[key] === option) return;
                        setMode((current) => ({ ...current, [key]: option }));
                        selectPoint(key, null);
                      }}>
                      {optionLabel}
                    </Button>
                  ))}
                </div>

                {mode[key] === "address" && (
                  <LocationField
                    label={`Endereço de ${label.toLowerCase()}`}
                    placeholder="Digite rua, número ou bairro"
                    value={route[key]}
                    initialQuery={initialQueries?.[key]}
                    onChange={(point) => selectPoint(key, point)}
                    onClear={() => selectPoint(key, null)}
                    showCampusShortcuts={false}
                    showSavedAddresses={false}
                    dotColor={color}
                    isPickingOnMap={picking === key}
                    onTogglePickOnMap={() => {
                      mapRequest.current++;
                      setPicking(picking === key ? null : key);
                    }}
                  />
                )}

                {mode[key] === "saved" && (
                  <select aria-label={`Endereço salvo de ${label.toLowerCase()}`} className={selectClass}
                    value={route[key]?.addressId ?? ""} disabled={!addresses?.length}
                    onChange={(event) => {
                      const address = addresses?.find(({ id }) => id === Number(event.target.value));
                      if (address) selectPoint(key, savedLocation(address));
                    }}>
                    <option value="" disabled>
                      {addresses?.length ? "Selecione um endereço" : addressError ? "Erro ao carregar endereços" : addresses ? "Nenhum endereço salvo" : "Carregando…"}
                    </option>
                    {addresses?.map((address) => (
                      <option key={address.id} value={address.id}>{address.label} · {address.street}, {address.number}</option>
                    ))}
                  </select>
                )}

                {mode[key] === "campus" && (
                  <select aria-label={`Campus de ${label.toLowerCase()}`} className={selectClass}
                    value={route[key]?.campusId ?? ""}
                    onChange={(event) => selectPoint(key, campusToLocation(event.target.value))}>
                    <option value="" disabled>Selecione um campus</option>
                    {UFRGS_CAMPUS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                  </select>
                )}

                {mode[key] !== "campus" && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    mapRequest.current++;
                    setPicking(null);
                    setSavingFor(key);
                  }}>Salvar novo endereço</Button>
                )}
              </fieldset>
            ))}
          </div>
          {picking && !disabled && (
            <section ref={mapSection} aria-label="Escolher ponto no mapa">
              <InteractiveMap
                height="280px"
                origin={origin}
                destination={destination}
                interactivePickMode={picking}
                onMapClick={pickOnMap}
              />
            </section>
          )}
          <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            {children}
          </div>
        </fieldset>
      </form>
      {savingFor && (
        <SaveAddressDialog onClose={() => setSavingFor(null)} onSaved={(address) => {
          setAddresses((current) => [...(current ?? []), address]);
          setMode((current) => ({ ...current, [savingFor]: "saved" }));
          selectPoint(savingFor, savedLocation(address));
          setSavingFor(null);
        }} />
      )}
    </>
  );
}
