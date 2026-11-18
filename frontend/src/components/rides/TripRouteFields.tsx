import { useEffect, useId, useRef, useState, type Dispatch, type FormEventHandler, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { addressesApi } from "@/api/addresses";
import { ridesApi } from "@/api/rides";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import { SavedAddressForm } from "@/components/profile/SavedAddressForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircleIcon, MapPinIcon, ShieldCheckIcon } from "@/components/ui/Icons";
import { UFRGS_CAMPUS } from "@/types/ride";
import type { AddressCreate, AddressPublic } from "@/types/address";
import { campusToLocation, geocodingService, type LocationValue } from "@/lib/geocoding";
import { hasTripCampus, type TripRoute } from "@/lib/tripRoute";

type Endpoint = keyof TripRoute;
type WizardStep = 1 | 2 | 3;

const endpointMeta: Record<Endpoint, { label: string; color: string; stepTitle: string; stepSubtitle: string }> = {
  origin: {
    label: "Origem",
    color: "#10b981",
    stepTitle: "1. Qual é o ponto de origem?",
    stepSubtitle: "Escolha de onde você vai sair (endereço, local salvo ou campus da UFRGS).",
  },
  destination: {
    label: "Destino",
    color: "#6366f1",
    stepTitle: "2. Qual é o ponto de destino?",
    stepSubtitle: "Escolha para onde você vai (lembre-se: origem ou destino deve ser um campus da UFRGS).",
  },
};

const modes = [
  { key: "address", label: "Endereço avulso" },
  { key: "saved", label: "Endereço salvo" },
  { key: "campus", label: "Campus UFRGS" },
] as const;
type Mode = typeof modes[number]["key"];

const selectClass = "w-full rounded-xl border border-border bg-surface-2 p-3 text-sm text-text outline-none focus:border-primary";

function detectPointMode(point: LocationValue | null): Mode {
  if (point?.campusId) return "campus";
  if (point?.addressId) return "saved";
  return "address";
}

function getInitialStep(route: TripRoute): WizardStep {
  if (route.origin && route.destination && hasTripCampus(route)) return 3;
  if (route.origin) return 2;
  return 1;
}

function anonymizeAsMeetingPoint(point: LocationValue): LocationValue {
  const streetPart = point.mapAddress
    ? `${point.mapAddress.street} (${point.mapAddress.neighborhood})`
    : point.region || "Local próximo";
  const cleanLabel = point.label.startsWith("Ponto de encontro")
    ? point.label
    : `Ponto de encontro · ${streetPart}`;
  return {
    label: cleanLabel,
    region: point.region,
    lat: point.lat,
    lng: point.lng,
    addressId: undefined,
    campusId: undefined,
    mapAddress: undefined,
  };
}

function buildInitialAddressValues(
  point: LocationValue | null,
  typedQuery: string
): Partial<AddressCreate> | undefined {
  if (point && !point.campusId && !point.addressId) {
    if (point.mapAddress) {
      return {
        street: point.mapAddress.street,
        number: point.mapAddress.number,
        neighborhood: point.mapAddress.neighborhood,
        lat: point.lat,
        lng: point.lng,
      };
    }
    return {
      street: point.label,
      lat: point.lat,
      lng: point.lng,
    };
  }
  const trimmed = typedQuery.trim();
  if (trimmed) {
    return { street: trimmed };
  }
  return undefined;
}

function SaveAddressDialog({
  onClose,
  onSaved,
  initialValues,
}: {
  onClose: () => void;
  onSaved: (address: AddressPublic) => void;
  initialValues?: Partial<AddressCreate>;
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-text shadow-xl backdrop:bg-black/60 sm:p-6"
    >
      <h2 id={titleId} className="mb-4 text-lg font-bold">Salvar novo endereço</h2>
      <SavedAddressForm
        initialValues={initialValues}
        onCancel={onClose}
        onSaved={(address) => {
          if (dialog.current?.open) onSaved(address);
        }}
      />
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

function TripRoutePreview({ origin, destination }: { origin: LocationValue; destination: LocationValue }) {
  const [geometry, setGeometry] = useState<GeoJSON.LineString | null>();
  const { lat: originLat, lng: originLng } = origin;
  const { lat: destinationLat, lng: destinationLng } = destination;

  useEffect(() => {
    const controller = new AbortController();
    ridesApi.previewRoute(
      { lat: originLat, lng: originLng },
      { lat: destinationLat, lng: destinationLng },
      controller.signal,
    ).then(({ data }) => {
      if (!controller.signal.aborted) setGeometry(data.route_geojson);
    }).catch(() => {
      if (!controller.signal.aborted) setGeometry(null);
    });
    return () => controller.abort();
  }, [originLat, originLng, destinationLat, destinationLng]);

  return (
    <section aria-label="Prévia do trajeto" className="space-y-2">
      <h2 className="text-sm font-bold text-text">Prévia da rota calculada</h2>
      <InteractiveMap origin={origin} destination={destination} routeGeoJson={geometry}
        approximateRoute={!geometry} scrollWheelZoom={false} height="240px" />
      {geometry === undefined && <p role="status" className="text-xs text-text-muted">Calculando trajeto pelas ruas…</p>}
      {geometry === null && <p role="status" className="text-xs text-text-muted">Trajeto pelas ruas indisponível. A linha no mapa é aproximada.</p>}
    </section>
  );
}

interface TripRouteFieldsProps {
  route: TripRoute;
  onChange: Dispatch<SetStateAction<TripRoute>>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  disabled: boolean;
  showRoutePreview?: boolean;
  allowMeetingPoint?: boolean;
  initialQueries?: Partial<Record<Endpoint, string>>;
  children: ReactNode;
}

export function TripRouteFields({
  route,
  onChange,
  onSubmit,
  disabled,
  showRoutePreview = true,
  allowMeetingPoint = false,
  initialQueries,
  children,
}: TripRouteFieldsProps) {
  const [step, setStep] = useState<WizardStep>(() => getInitialStep(route));
  const [mode, setMode] = useState<Record<Endpoint, Mode>>(() => ({
    origin: detectPointMode(route.origin),
    destination: route.destination
      ? detectPointMode(route.destination)
      : route.origin && !route.origin.campusId
      ? "campus"
      : "address",
  }));
  const lastByMode = useRef<Record<Endpoint, Partial<Record<Mode, LocationValue>>>>({
    origin: route.origin ? { [detectPointMode(route.origin)]: route.origin } : {},
    destination: route.destination ? { [detectPointMode(route.destination)]: route.destination } : {},
  });
  const [addresses, setAddresses] = useState<AddressPublic[] | null>(null);
  const [addressError, setAddressError] = useState(false);
  const [savingFor, setSavingFor] = useState<Endpoint | null>(null);
  const [picking, setPicking] = useState<Endpoint | null>(null);
  const [meetingPointMode, setMeetingPointMode] = useState<Record<Endpoint, boolean>>({
    origin: false,
    destination: false,
  });
  const exactBeforeMeetingRef = useRef<Record<Endpoint, LocationValue | null>>({
    origin: null,
    destination: null,
  });
  const [typedQueries, setTypedQueries] = useState<Record<Endpoint, string>>({
    origin: initialQueries?.origin ?? "",
    destination: initialQueries?.destination ?? "",
  });
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

  // Automatically resolve text queries passed from HomePage if not yet resolved
  useEffect(() => {
    let active = true;
    (["origin", "destination"] as const).forEach((endpoint) => {
      const q = initialQueries?.[endpoint]?.trim();
      if (!q || q.length < 2 || route[endpoint]) return;

      geocodingService.searchAddress(q).then((items) => {
        if (!active || items.length === 0) return;
        const best = items[0];
        const loc: LocationValue = {
          label: best.label,
          region: best.region,
          lat: best.lat,
          lng: best.lng,
          campusId: best.campusId,
          mapAddress: best.mapAddress,
        };
        const targetMode = detectPointMode(loc);
        lastByMode.current[endpoint][targetMode] = loc;
        setMode((curr) => (curr[endpoint] === targetMode ? curr : { ...curr, [endpoint]: targetMode }));
        onChange((curr) => {
          const next = curr[endpoint] ? curr : { ...curr, [endpoint]: loc };
          if (next.origin && next.destination && hasTripCampus(next)) {
            setStep(3);
          } else if (next.origin && !next.destination) {
            setStep(2);
          }
          return next;
        });
      });
    });
    return () => {
      active = false;
    };
    // Only run on mount for initial prefill queries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (picking) mapSection.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picking]);

  function goToStep(nextStep: WizardStep) {
    mapRequest.current++;
    setPicking(null);
    if (nextStep === 2 && origin && !origin.campusId && !destination) {
      setMode((curr) => (curr.destination === "campus" ? curr : { ...curr, destination: "campus" }));
    }
    setStep(nextStep);
  }

  function selectPoint(endpoint: Endpoint, point: LocationValue | null, targetMode?: Mode) {
    mapRequest.current++;
    setPicking(null);
    const resolvedMode = targetMode ?? (point ? detectPointMode(point) : mode[endpoint]);
    if (point) {
      lastByMode.current[endpoint][resolvedMode] = point;
    } else {
      delete lastByMode.current[endpoint][resolvedMode];
    }
    if (resolvedMode !== mode[endpoint]) {
      setMode((curr) => ({ ...curr, [endpoint]: resolvedMode }));
    }
    onChange((current) => current[endpoint] === point ? current : { ...current, [endpoint]: point });
  }

  function handleSwapEndpoints() {
    mapRequest.current++;
    setPicking(null);
    lastByMode.current = {
      origin: lastByMode.current.destination,
      destination: lastByMode.current.origin,
    };
    exactBeforeMeetingRef.current = {
      origin: exactBeforeMeetingRef.current.destination,
      destination: exactBeforeMeetingRef.current.origin,
    };
    setMeetingPointMode((curr) => ({
      origin: curr.destination,
      destination: curr.origin,
    }));
    setMode((curr) => ({
      origin: curr.destination,
      destination: curr.origin,
    }));
    setTypedQueries((curr) => ({
      origin: curr.destination,
      destination: curr.origin,
    }));
    onChange((curr) => ({
      origin: curr.destination,
      destination: curr.origin,
    }));
  }

  function enableMeetingPoint(endpoint: Endpoint) {
    mapRequest.current++;
    const current = route[endpoint];
    exactBeforeMeetingRef.current[endpoint] = current;
    setMeetingPointMode((curr) => ({ ...curr, [endpoint]: true }));
    if (current && !current.campusId) {
      const anonymized = anonymizeAsMeetingPoint(current);
      onChange((prev) => ({ ...prev, [endpoint]: anonymized }));
    }
    setPicking(endpoint);
  }

  function disableMeetingPoint(endpoint: Endpoint) {
    mapRequest.current++;
    setMeetingPointMode((curr) => ({ ...curr, [endpoint]: false }));
    setPicking((curr) => (curr === endpoint ? null : curr));
    const previous = exactBeforeMeetingRef.current[endpoint];
    if (previous) {
      selectPoint(endpoint, previous, detectPointMode(previous));
    }
  }

  async function pickOnMap(lat: number, lng: number) {
    if (!picking || disabled) return;
    const targetEndpoint = picking;
    const existingPoint = route[targetEndpoint];
    const typedLabel = typedQueries[targetEndpoint]?.trim();
    const request = ++mapRequest.current;
    const point = await geocodingService.reverseGeocode(lat, lng);
    if (request !== mapRequest.current) return;

    if (meetingPointMode[targetEndpoint] && !point.campusId) {
      const anonymized = anonymizeAsMeetingPoint(point);
      selectPoint(targetEndpoint, anonymized, mode[targetEndpoint]);
      return;
    }

    const preservedLabel = existingPoint?.label?.trim() || typedLabel;
    if (preservedLabel && !point.campusId) {
      selectPoint(
        targetEndpoint,
        {
          ...point,
          label: preservedLabel,
          region: existingPoint?.region || point.region,
          addressId: existingPoint?.addressId,
          mapAddress: existingPoint?.mapAddress ?? point.mapAddress,
        },
        mode[targetEndpoint]
      );
    } else {
      selectPoint(targetEndpoint, point);
    }
  }

  const activeKey: Endpoint = step === 1 ? "origin" : "destination";
  const activeMeta = endpointMeta[activeKey];
  const activePoint = route[activeKey];
  const canGoStep2 = Boolean(origin);
  const canGoStep3 = Boolean(origin && destination && hasTripCampus(route));

  return (
    <>
      <form
        onSubmit={(event) => {
          mapRequest.current++;
          setPicking(null);
          if (step === 1) {
            event.preventDefault();
            if (canGoStep2) goToStep(2);
            return;
          }
          if (step === 2) {
            event.preventDefault();
            if (canGoStep3) goToStep(3);
            return;
          }
          onSubmit(event);
        }}
        className="min-w-0"
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-5">
          {/* ─── Stepper Progress Bar ────────────────────────────────────────── */}
          <nav
            aria-label="Etapas do preenchimento"
            className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-2"
          >
            {(
              [
                { id: 1 as const, label: "1. Origem", done: Boolean(origin), enabled: true },
                { id: 2 as const, label: "2. Destino", done: Boolean(destination), enabled: canGoStep2 },
                { id: 3 as const, label: "3. Horário e Dia", done: false, enabled: canGoStep3 },
              ]
            ).map((item) => {
              const isCurrent = step === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled}
                  onClick={() => item.enabled && goToStep(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-primary text-white shadow-sm"
                      : item.done
                      ? "bg-surface-2 text-emerald-400 hover:bg-surface-hover"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {item.done && !isCurrent && <CheckCircleIcon size={14} className="shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ─── STEP 1 & STEP 2: Origin or Destination Selection ───────────── */}
          {(step === 1 || step === 2) && (
            <div className="space-y-5 animate-fade-in">
              {/* When on Step 2, show compact summary of confirmed Origin */}
              {step === 2 && origin && (
                <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0 text-xs">
                    <span className="size-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-text-muted font-semibold">Origem confirmada:</span>
                    <strong className="text-text truncate">{origin.label}</strong>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-xs font-semibold text-indigo-400 hover:underline"
                    >
                      Editar origem
                    </button>
                    {destination && (
                      <button
                        type="button"
                        onClick={handleSwapEndpoints}
                        className="text-xs font-semibold text-text-secondary hover:text-text"
                      >
                        · ⇄ Inverter
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Active Step Card */}
              <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 space-y-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <h2 className="text-lg font-extrabold text-text flex items-center gap-2">
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: activeMeta.color }}
                      />
                      <span>{activeMeta.stepTitle}</span>
                    </h2>
                    <p className="text-xs text-text-muted">{activeMeta.stepSubtitle}</p>
                  </div>

                  {/* Mode Switcher Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {modes.map(({ key: option, label: optionLabel }) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={mode[activeKey] === option ? "primary" : "secondary"}
                        aria-pressed={mode[activeKey] === option}
                        onClick={() => {
                          if (mode[activeKey] === option) return;
                          setMeetingPointMode((curr) => ({ ...curr, [activeKey]: false }));
                          const remembered = lastByMode.current[activeKey][option] ?? null;
                          setMode((current) => ({ ...current, [activeKey]: option }));
                          selectPoint(activeKey, remembered, option);
                        }}
                      >
                        {optionLabel}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Mode Content */}
                {mode[activeKey] === "address" && !meetingPointMode[activeKey] && (
                  <LocationField
                    label={`Endereço de ${activeMeta.label.toLowerCase()}`}
                    placeholder="Digite rua, número, bairro ou campus"
                    value={activePoint}
                    initialQuery={initialQueries?.[activeKey]}
                    onQueryChange={(q) => setTypedQueries((prev) => ({ ...prev, [activeKey]: q }))}
                    onChange={(point) => {
                      setTypedQueries((prev) => ({ ...prev, [activeKey]: point.label }));
                      selectPoint(activeKey, point);
                    }}
                    onClear={() => selectPoint(activeKey, null, "address")}
                    showCampusShortcuts={false}
                    showSavedAddresses={false}
                    dotColor={activeMeta.color}
                  />
                )}

                {mode[activeKey] === "saved" && !meetingPointMode[activeKey] && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Escolha um endereço salvo ({activeMeta.label.toLowerCase()})
                    </label>
                    <select
                      aria-label={`Endereço salvo de ${activeMeta.label.toLowerCase()}`}
                      className={selectClass}
                      value={activePoint?.addressId ?? ""}
                      disabled={!addresses?.length}
                      onChange={(event) => {
                        const address = addresses?.find(({ id }) => id === Number(event.target.value));
                        if (address) selectPoint(activeKey, savedLocation(address), "saved");
                      }}
                    >
                      <option value="" disabled>
                        {addresses?.length
                          ? "Selecione um endereço"
                          : addressError
                          ? "Erro ao carregar endereços"
                          : addresses
                          ? "Nenhum endereço salvo"
                          : "Carregando…"}
                      </option>
                      {addresses?.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} · {address.street}, {address.number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {mode[activeKey] === "campus" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Escolha o Campus da UFRGS ({activeMeta.label.toLowerCase()})
                    </label>
                    <select
                      aria-label={`Campus de ${activeMeta.label.toLowerCase()}`}
                      className={selectClass}
                      value={activePoint?.campusId ?? ""}
                      onChange={(event) =>
                        selectPoint(activeKey, campusToLocation(event.target.value), "campus")
                      }
                    >
                      <option value="" disabled>
                        Selecione um campus
                      </option>
                      {UFRGS_CAMPUS.map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Meeting Point Privacy Box (Passenger only) */}
                {mode[activeKey] !== "campus" && meetingPointMode[activeKey] && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-start gap-2">
                        <ShieldCheckIcon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-emerald-400 block">
                            Ponto de encontro próximo (Endereço residencial oculto)
                          </span>
                          <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                            Seu endereço exato, número e complemento não serão compartilhados. Toque no mapa abaixo para posicionar o ponto de encontro em uma esquina ou local próximo.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => disableMeetingPoint(activeKey)}
                        className="text-xs font-semibold text-text-muted hover:text-text hover:underline"
                      >
                        Voltar ao endereço exato
                      </button>
                    </div>

                    {activePoint ? (
                      <Input
                        label={`Referência do ponto de encontro (${activeMeta.label.toLowerCase()})`}
                        placeholder="Ex.: Ponto de encontro · Esquina Av. Osvaldo Aranha (em frente à farmácia)"
                        value={activePoint.label}
                        onChange={(e) => {
                          onChange((prev) => ({
                            ...prev,
                            [activeKey]: {
                              ...activePoint,
                              label: e.target.value,
                              addressId: undefined,
                              mapAddress: undefined,
                            },
                          }));
                        }}
                      />
                    ) : (
                      <p className="text-xs font-medium text-amber-400">
                        📍 Toque em um ponto no mapa abaixo para definir o local de encontro.
                      </p>
                    )}
                  </div>
                )}

                {/* Secondary Actions Row (Meeting Point toggle + Save new address) */}
                {mode[activeKey] !== "campus" && !meetingPointMode[activeKey] && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {allowMeetingPoint ? (
                      <button
                        type="button"
                        onClick={() => enableMeetingPoint(activeKey)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline text-left"
                      >
                        <ShieldCheckIcon size={14} className="shrink-0" />
                        <span>Marcar ponto de encontro próximo (esconder meu endereço)</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        mapRequest.current++;
                        setPicking(null);
                        setSavingFor(activeKey);
                      }}
                    >
                      + Salvar novo endereço
                    </Button>
                  </div>
                )}

                {/* ─── Map & "Ajustar no Mapa" Button Positioned Right Next to the Map ─── */}
                <section ref={mapSection} aria-label="Mapa de localização" className="space-y-2.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                        {picking === activeKey
                          ? `Toque no mapa para definir ${activeMeta.label.toLowerCase()}`
                          : `Visualização de ${activeMeta.label.toLowerCase()} no mapa`}
                      </h3>
                      {activePoint && (
                        <p className="text-xs text-text truncate max-w-md mt-0.5">
                          Selecionado: <strong>{activePoint.label}</strong>
                        </p>
                      )}
                    </div>

                    {mode[activeKey] !== "campus" && (
                      <Button
                        type="button"
                        size="sm"
                        variant={picking === activeKey ? "primary" : "secondary"}
                        onClick={() => {
                          mapRequest.current++;
                          setPicking(picking === activeKey ? null : activeKey);
                        }}
                      >
                        <MapPinIcon size={14} />
                        <span>
                          {picking === activeKey
                            ? "Concluir / Cancelar ajuste no mapa"
                            : activePoint
                            ? "Ajustar no mapa"
                            : "Marcar no mapa"}
                        </span>
                      </Button>
                    )}
                  </div>

                  <InteractiveMap
                    height="260px"
                    origin={step === 1 ? origin : origin}
                    destination={step === 2 ? destination : null}
                    interactivePickMode={picking}
                    onMapClick={picking === activeKey ? pickOnMap : undefined}
                    approximateRoute={Boolean(step === 2 && origin && destination)}
                    scrollWheelZoom={picking === activeKey}
                  />
                </section>

                {/* Validation Alert on Step 2 if neither Origin nor Destination is a UFRGS campus */}
                {step === 2 && origin && destination && !hasTripCampus(route) && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 font-medium"
                  >
                    Selecione pelo menos um <strong>Campus da UFRGS</strong> como origem ou destino para prosseguir.
                  </div>
                )}

                {/* Step Navigation Footer */}
                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                  {step === 2 ? (
                    <Button type="button" variant="secondary" onClick={() => goToStep(1)}>
                      ← Voltar para Origem
                    </Button>
                  ) : (
                    <span />
                  )}

                  {step === 1 ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canGoStep2}
                      onClick={() => goToStep(2)}
                    >
                      Confirmar origem e escolher destino →
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canGoStep3}
                      onClick={() => goToStep(3)}
                    >
                      Confirmar destino e definir horário →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Schedule & Final Action ────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              {/* Confirmed Route Summary Card */}
              <div className="rounded-3xl border border-border bg-surface p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-text">
                    Trajeto confirmado
                  </h2>
                  <Button type="button" size="sm" variant="secondary" onClick={handleSwapEndpoints}>
                    ⇄ Inverter origem e destino
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl border border-border bg-surface-2 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="size-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Origem (A)
                        </span>
                        <p className="text-sm font-semibold text-text wrap-anywhere">
                          {origin?.label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-xs font-semibold text-indigo-400 hover:underline shrink-0"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-border bg-surface-2 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="size-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Destino (B)
                        </span>
                        <p className="text-sm font-semibold text-text wrap-anywhere">
                          {destination?.label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="text-xs font-semibold text-indigo-400 hover:underline shrink-0"
                    >
                      Editar
                    </button>
                  </div>
                </div>

                {showRoutePreview && origin && destination && hasTripCampus(route) && (
                  <TripRoutePreview
                    key={`${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`}
                    origin={origin}
                    destination={destination}
                  />
                )}
              </div>

              {/* Step 3 Schedule & Submit Card */}
              <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 space-y-5 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border pb-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-text">
                      3. Data, Horário e Detalhes
                    </h2>
                    <p className="text-xs text-text-muted">
                      Defina o dia e o horário para concluir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-xs font-semibold text-text-secondary hover:text-text hover:underline"
                  >
                    ← Voltar para Destino
                  </button>
                </div>

                <div className="space-y-4">
                  {children}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      </form>
      {savingFor && (
        <SaveAddressDialog
          initialValues={buildInitialAddressValues(route[savingFor], typedQueries[savingFor])}
          onClose={() => setSavingFor(null)}
          onSaved={(address) => {
            setAddresses((current) => [...(current ?? []), address]);
            setMode((current) => ({ ...current, [savingFor]: "saved" }));
            selectPoint(savingFor, savedLocation(address), "saved");
            setSavingFor(null);
          }}
        />
      )}
    </>
  );
}
