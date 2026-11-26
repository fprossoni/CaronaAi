import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type FormEventHandler,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { addressesApi } from "@/api/addresses";
import { ridesApi } from "@/api/rides";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import { SavedAddressForm } from "@/components/profile/SavedAddressForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CheckCircleIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SwapIcon,
} from "@/components/ui/Icons";
import { UFRGS_CAMPUS } from "@/types/ride";
import type { AddressCreate, AddressPublic } from "@/types/address";
import { campusToLocation, hasCompleteLocation, geocodingService, type LocationValue } from "@/lib/geocoding";
import { hasTripCampus, type TripRoute } from "@/lib/tripRoute";

type Endpoint = keyof TripRoute;
type WizardStep = 1 | 2 | 3;

const endpointMeta: Record<Endpoint, { label: string; color: string; stepTitle: string }> = {
  origin: {
    label: "Origem",
    color: "#fa952d",
    stepTitle: "Origem",
  },
  destination: {
    label: "Destino",
    color: "#22c55e",
    stepTitle: "Destino",
  },
};

const modes = [
  { key: "address", label: "Endereço" },
  { key: "saved", label: "Salvos" },
  { key: "campus", label: "Campus" },
] as const;
type Mode = (typeof modes)[number]["key"];

const selectClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";

function detectPointMode(point: LocationValue | null): Mode {
  if (point?.campusId) return "campus";
  if (point?.addressId) return "saved";
  return "address";
}

function getInitialStep(route: TripRoute): WizardStep {
  if (hasCompleteLocation(route.origin) && hasCompleteLocation(route.destination) && hasTripCampus(route)) return 3;
  if (hasCompleteLocation(route.origin)) return 2;
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[10px] border border-border-strong bg-surface p-5 text-text shadow-lg backdrop:bg-black/70 sm:p-6"
    >
      <h2 id={titleId} className="mb-4 font-display text-lg font-bold">
        Salvar endereço
      </h2>
      <SavedAddressForm
        initialValues={initialValues}
        onCancel={onClose}
        onSaved={(address) => {
          if (dialog.current?.open) onSaved(address);
        }}
      />
    </dialog>,
    document.body
  );
}

function savedLocation(address: AddressPublic): LocationValue {
  return {
    label: `${address.street}, ${address.number} · ${address.city}`,
    region: address.neighborhood ? `${address.neighborhood}, ${address.city}` : address.city,
    lat: address.lat,
    lng: address.lng,
    addressId: address.id,
    mapAddress: { street: address.street, number: address.number, neighborhood: address.neighborhood || address.city },
  };
}

function useTripRouteGeometry(origin: LocationValue | null, destination: LocationValue | null) {
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const destinationLat = destination?.lat;
  const destinationLng = destination?.lng;
  const key = `${originLat},${originLng}:${destinationLat},${destinationLng}`;
  const [result, setResult] = useState<{ key: string; geometry: GeoJSON.LineString | null }>();

  useEffect(() => {
    if (originLat == null || originLng == null || destinationLat == null || destinationLng == null) return;
    const controller = new AbortController();
    ridesApi
      .previewRoute(
        { lat: originLat, lng: originLng },
        { lat: destinationLat, lng: destinationLng },
        controller.signal
      )
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ key, geometry: data.route_geojson });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, geometry: null });
      });
    return () => controller.abort();
  }, [originLat, originLng, destinationLat, destinationLng, key]);

  return result?.key === key ? result.geometry : undefined;
}

function TripRoutePreview({ origin, destination }: { origin: LocationValue; destination: LocationValue }) {
  const geometry = useTripRouteGeometry(origin, destination);

  return (
    <section aria-label="Prévia do trajeto" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Prévia do trajeto
        </h2>
        {geometry === undefined && (
          <span role="status" className="font-mono text-[11px] text-text-muted animate-pulse">
            Calculando…
          </span>
        )}
        {geometry === null && (
          <span role="status" className="font-mono text-[11px] text-text-muted">
            Linha aproximada
          </span>
        )}
      </div>
      <InteractiveMap
        origin={origin}
        destination={destination}
        routeGeoJson={geometry}
        approximateRoute={!geometry}
        scrollWheelZoom={false}
        height="var(--trip-preview-height)"
        className="[--trip-preview-height:220px] lg:[--trip-preview-height:clamp(260px,40dvh,480px)]"
      />
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
  const mapGeometry = useTripRouteGeometry(
    step === 2 && hasTripCampus(route) ? route.origin : null,
    step === 2 && hasTripCampus(route) ? route.destination : null,
  );
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
    addressesApi
      .list()
      .then(({ data }) => {
        if (active)
          setAddresses((current) => [
            ...data,
            ...(current ?? []).filter((address) => !data.some(({ id }) => id === address.id)),
          ]);
      })
      .catch(() => {
        if (active) setAddressError(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
          if (hasCompleteLocation(next.origin) && hasCompleteLocation(next.destination) && hasTripCampus(next)) {
            setStep(3);
          } else if (hasCompleteLocation(next.origin) && !hasCompleteLocation(next.destination)) {
            setStep(2);
          }
          return next;
        });
      });
    });
    return () => {
      active = false;
    };
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
    onChange((current) =>
      current[endpoint] === point ? current : { ...current, [endpoint]: point }
    );
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
    const request = ++mapRequest.current;
    const point = await geocodingService.reverseGeocode(lat, lng);
    if (request !== mapRequest.current) return;

    if (meetingPointMode[targetEndpoint] && !point.campusId) {
      const anonymized = anonymizeAsMeetingPoint(point);
      selectPoint(targetEndpoint, anonymized, mode[targetEndpoint]);
      return;
    }

    selectPoint(targetEndpoint, point);
  }

  const activeKey: Endpoint = step === 1 ? "origin" : "destination";
  const activeMeta = endpointMeta[activeKey];
  const activePoint = route[activeKey];
  const canGoStep2 = hasCompleteLocation(origin);
  const canGoStep3 = Boolean(hasCompleteLocation(origin) && hasCompleteLocation(destination) && hasTripCampus(route));

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
          if (!hasCompleteLocation(origin) || !hasCompleteLocation(destination)) {
            event.preventDefault();
            return;
          }
          onSubmit(event);
        }}
        className="min-w-0"
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
          <nav
            aria-label="Etapas do preenchimento"
            className="grid grid-cols-3 gap-1.5 rounded-md border border-border bg-surface p-1.5"
          >
            {(
              [
                { id: 1 as const, code: "01", label: "Origem", done: Boolean(origin), enabled: true },
                { id: 2 as const, code: "02", label: "Destino", done: Boolean(destination), enabled: canGoStep2 },
                { id: 3 as const, code: "03", label: "Horário", done: false, enabled: canGoStep3 },
              ]
            ).map((item) => {
              const isCurrent = step === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled}
                  onClick={() => item.enabled && goToStep(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-primary text-on-primary font-bold"
                      : item.done
                      ? "bg-surface-2 text-secondary hover:bg-surface-hover"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {item.done && !isCurrent ? (
                    <CheckCircleIcon size={13} className="shrink-0" />
                  ) : (
                    <span className="font-mono text-[11px] opacity-80">{item.code}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
          {(step === 1 || step === 2) && (
            <div className="space-y-4 animate-fade-in">
              {step === 2 && origin && (
                <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-surface px-3.5 py-2.5">
                  <div className="flex items-center gap-2 min-w-0 text-xs">
                    <span className="size-2 rounded-full bg-primary shrink-0" />
                    <span className="font-mono text-[11px] uppercase text-text-muted">Origem:</span>
                    <strong className="text-text truncate">{origin.label}</strong>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-xs font-semibold text-accent-text hover:underline"
                    >
                      Alterar
                    </button>
                    {destination && (
                      <button
                        type="button"
                        onClick={handleSwapEndpoints}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text"
                      >
                        <SwapIcon size={12} />
                        <span>Inverter</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-sm sm:p-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)] lg:gap-x-6 lg:items-start">
                <div className="min-w-0 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="font-display text-lg font-bold text-text flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: activeMeta.color }}
                      />
                      <span>{activeMeta.stepTitle}</span>
                    </h2>

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

                  {mode[activeKey] === "address" && !meetingPointMode[activeKey] && (
                    <LocationField
                      label="Endereço"
                      requireNumber
                      placeholder="Rua, número, bairro ou campus"
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
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Endereço salvo ({activeMeta.label.toLowerCase()})
                      </label>
                      <select
                        aria-label={`Endereço salvo de ${activeMeta.label.toLowerCase()}`}
                        className={selectClass}
                        value={activePoint?.addressId ?? ""}
                        disabled={!addresses?.length}
                        onChange={(event) => {
                          const address = addresses?.find(
                            ({ id }) => id === Number(event.target.value)
                          );
                          if (address) selectPoint(activeKey, savedLocation(address), "saved");
                        }}
                      >
                        <option value="" disabled>
                          {addresses?.length
                            ? "Selecione um endereço"
                            : addressError
                            ? "Erro ao carregar"
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
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Campus UFRGS ({activeMeta.label.toLowerCase()})
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
                  {mode[activeKey] !== "campus" && meetingPointMode[activeKey] && (
                    <div className="rounded-md border border-secondary/40 bg-secondary/10 p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-start gap-2">
                          <ShieldCheckIcon size={15} className="text-secondary shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-secondary block">
                              Ponto de encontro
                            </span>
                            <p className="text-[11px] text-text-secondary mt-0.5">
                              Endereço exato oculto; marque uma esquina próxima no mapa.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => disableMeetingPoint(activeKey)}
                          className="text-xs font-semibold text-text-muted hover:text-text hover:underline"
                        >
                          Usar endereço exato
                        </button>
                      </div>

                      {activePoint ? (
                        <Input
                          label="Referência"
                          placeholder="Ex.: Esquina Av. Osvaldo Aranha"
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
                        <p className="font-mono text-xs text-warning-text">
                          Toque no mapa para definir o ponto.
                        </p>
                      )}
                    </div>
                  )}
                  {mode[activeKey] !== "campus" && !meetingPointMode[activeKey] && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {allowMeetingPoint ? (
                        <button
                          type="button"
                          onClick={() => enableMeetingPoint(activeKey)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline text-left"
                        >
                          <ShieldCheckIcon size={14} className="shrink-0" />
                          <span>Ponto de encontro</span>
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
                        + Salvar endereço
                      </Button>
                    </div>
                  )}

                </div>
                <section
                  ref={mapSection}
                  aria-label="Mapa de localização"
                  className="min-w-0 space-y-2.5 pt-3 border-t border-border lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
                        {picking === activeKey
                          ? `Marcar ${activeMeta.label.toLowerCase()} no mapa`
                          : "Mapa"}
                      </h3>
                      {activePoint && (
                        <p className="text-xs text-text truncate max-w-md mt-0.5 font-medium">
                          {activePoint.label}
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
                        <MapPinIcon size={13} />
                        <span>
                          {picking === activeKey
                            ? "Concluir mapa"
                            : activePoint
                            ? "Ajustar no mapa"
                            : "Marcar no mapa"}
                        </span>
                      </Button>
                    )}
                  </div>

                  {step === 2 && origin && destination && hasTripCampus(route) && !mapGeometry && (
                    <p role="status" className="text-xs text-text-muted">
                      {mapGeometry === undefined
                        ? "Calculando trajeto…"
                        : "Não foi possível calcular o trajeto. Exibindo linha aproximada."}
                    </p>
                  )}
                  <InteractiveMap
                    height="var(--trip-map-height)"
                    className="[--trip-map-height:250px] lg:[--trip-map-height:clamp(320px,55dvh,640px)]"
                    origin={origin}
                    destination={step === 2 ? destination : null}
                    interactivePickMode={picking}
                    onMapClick={picking === activeKey ? pickOnMap : undefined}
                    routeGeoJson={mapGeometry}
                    approximateRoute={!mapGeometry}
                    scrollWheelZoom={picking === activeKey}
                  />
                </section>

                {step === 2 && origin && destination && !hasTripCampus(route) && (
                  <div
                    role="alert"
                    className="lg:col-start-1 p-3 rounded-md border border-danger/30 bg-danger/10 text-xs text-danger font-medium"
                  >
                    Origem ou destino deve ser um Campus da UFRGS.
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap lg:col-start-1">
                  {step === 2 ? (
                    <Button type="button" variant="secondary" onClick={() => goToStep(1)}>
                      ← Origem
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
                      Continuar →
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canGoStep3}
                      onClick={() => goToStep(3)}
                    >
                      Continuar →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start animate-fade-in">
              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
                    Trajeto
                  </h2>
                  <Button type="button" size="sm" variant="secondary" onClick={handleSwapEndpoints}>
                    <SwapIcon size={13} />
                    <span>Inverter</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-md border border-border bg-surface-2 flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted block">
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
                      className="text-xs font-semibold text-accent-text hover:underline shrink-0"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="p-3 rounded-md border border-border bg-surface-2 flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="size-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted block">
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
                      className="text-xs font-semibold text-accent-text hover:underline shrink-0"
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

              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border pb-3">
                  <h2 className="font-display text-lg font-bold text-text">Horário e vagas</h2>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-xs font-semibold text-text-secondary hover:text-text hover:underline"
                  >
                    ← Destino
                  </button>
                </div>

                <div className="space-y-4">{children}</div>
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
