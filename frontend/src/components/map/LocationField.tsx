import React, { useEffect, useId, useRef, useState } from "react";
import { UFRGS_CAMPUS } from "@/types/ride";
import type { AddressPublic } from "@/types/address";
import { addressesApi } from "@/api/addresses";
import { useAuthStore } from "@/store/authStore";
import {
  campusToLocation,
  formatMapAddress,
  geocodingService,
  resolveNumberedLocation,
  getBrowserCurrentLocation,
  type GeocodingSuggestion,
  type LocationValue,
} from "@/lib/geocoding";
import { CrosshairIcon, MapPinIcon, NavigationIcon, SearchIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";

interface LocationFieldProps {
  label: string;
  placeholder?: string;
  value: LocationValue | null;
  onChange: (location: LocationValue) => void;
  onClear?: () => void;
  onQueryChange?: (query: string) => void;
  initialQuery?: string;
  dotColor?: string;
  isPickingOnMap?: boolean;
  onTogglePickOnMap?: () => void;
  allowGps?: boolean;
  showCampusShortcuts?: boolean;
  showSavedAddresses?: boolean;
  helperText?: string;
  requireNumber?: boolean;
}

export const LocationField: React.FC<LocationFieldProps> = ({
  label,
  placeholder = "Rua, bairro ou campus...",
  value,
  onChange,
  onClear,
  onQueryChange,
  initialQuery,
  dotColor = "#fa952d",
  isPickingOnMap = false,
  onTogglePickOnMap,
  allowGps = true,
  showCampusShortcuts = true,
  showSavedAddresses = true,
  helperText,
  requireNumber = false,
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const inputId = useId();
  const [draft, setDraft] = useState<{ forValue: LocationValue | null; text: string } | null>(
    () => (initialQuery != null ? { forValue: value, text: initialQuery } : null)
  );
  const [suggestions, setSuggestions] = useState<{ query: string; items: GeocodingSuggestion[] } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<AddressPublic[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [numberError, setNumberError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const displayedQuery = draft && draft.forValue === value ? draft.text : (value?.label ?? "");
  const mapAddress = value?.mapAddress;

  useEffect(() => {
    if (!showSavedAddresses || !isAuthenticated) return;

    let active = true;
    addressesApi
      .list()
      .then((res) => {
        if (active) setSavedAddresses(res.data);
      })
      .catch(() => {
        // Ignore if backend is offline
      });
    return () => {
      active = false;
    };
  }, [showSavedAddresses, isAuthenticated, user?.id]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  useEffect(() => {
    const trimmed = displayedQuery.trim();
    if (!isOpen || trimmed.length < 2) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocodingService.searchAddress(trimmed);
        if (active) setSuggestions({ query: trimmed, items: res });
      } finally {
        if (active) setSearching(false);
      }
    }, 320);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [displayedQuery, isOpen]);

  useEffect(() => {
    if (!value || value.coordinatesVerified !== false || !value.mapAddress?.number.trim()) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const resolved = await resolveNumberedLocation(value);
        if (!active) return;
        if (resolved) {
          setNumberError("");
          onChange(resolved);
        } else {
          setNumberError("Endereço não localizado. Selecione uma sugestão ou marque no mapa.");
        }
      } catch {
        if (active) setNumberError("Não foi possível localizar o endereço. Tente novamente.");
      }
    }, 320);
    return () => { active = false; clearTimeout(timer); };
  }, [value, onChange]);

  const handleSelectSuggestion = (item: GeocodingSuggestion) => {
    setDraft(null);
    setIsOpen(false);
    onChange({
      label: item.label,
      region: item.region,
      lat: item.lat,
      lng: item.lng,
      campusId: item.campusId,
      mapAddress: item.mapAddress,
    });
  };

  const handleSelectCampus = (campusId: string) => {
    const loc = campusToLocation(campusId);
    if (!loc) return;
    setDraft(null);
    setIsOpen(false);
    onChange(loc);
  };

  const handleUseGps = async () => {
    setGpsError("");
    setGpsLoading(true);
    try {
      const loc = await getBrowserCurrentLocation();
      setDraft(null);
      onChange(loc);
    } catch {
      setGpsError("GPS indisponível. Digite o endereço ou marque no mapa.");
    } finally {
      setGpsLoading(false);
    }
  };

  const visibleSuggestions =
    suggestions?.query === displayedQuery.trim() ? suggestions.items : [];

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-text-secondary"
        >
          <span
            className="w-2 h-2 rounded-full inline-block shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          {label}
        </label>

        <div className="flex items-center gap-1.5">
          {allowGps && (
            <button
              type="button"
              onClick={handleUseGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-surface-2 text-text-secondary transition-colors hover:border-border-strong hover:text-text"
              title="Usar localização atual via GPS"
            >
              <CrosshairIcon
                size={13}
                className={gpsLoading ? "animate-spin text-accent-text" : "text-accent-text"}
              />
              <span>{gpsLoading ? "Localizando..." : "GPS"}</span>
            </button>
          )}

          {onTogglePickOnMap && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onTogglePickOnMap();
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                isPickingOnMap
                  ? "border-primary bg-primary/15 text-accent-text"
                  : "border-border bg-surface-2 text-text-secondary hover:border-border-strong"
              }`}
            >
              <MapPinIcon size={13} />
              <span>
                {isPickingOnMap
                  ? "Clicando..."
                  : value
                  ? "Ajustar no mapa"
                  : "Mapa"}
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
          <SearchIcon size={15} />
        </span>
        <input
          id={inputId}
          type="text"
          value={displayedQuery}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && isOpen) {
              setIsOpen(false);
            }
          }}
          onChange={(e) => {
            const nextVal = e.target.value;
            setNumberError("");
            setDraft({ forValue: onClear ? null : value, text: nextVal });
            onQueryChange?.(nextVal);
            setIsOpen(true);
            if (onClear) onClear();
            else if (value) onChange({ ...value, label: nextVal, coordinatesVerified: false });
          }}
          className={`w-full pl-9 pr-4 py-2.5 rounded-md text-sm border bg-surface-2 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 ${
            value ? "border-border-strong" : "border-border"
          }`}
        />
        {isOpen && displayedQuery.trim().length >= 2 && searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted animate-pulse">
            Buscando…
          </span>
        )}
        {isOpen && visibleSuggestions.length > 0 && (
          <ul className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 rounded-md border border-border-strong bg-surface shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {visibleSuggestions.map((item) => (
              <li key={item.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <span
                    className={`mt-0.5 shrink-0 ${
                      item.isCampus ? "text-accent-text" : "text-secondary"
                    }`}
                  >
                    <NavigationIcon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-text">{item.label}</p>
                    <p className="text-xs truncate text-text-muted">{item.subtitle}</p>
                  </div>
                  {item.isCampus && (
                    <span className="px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold uppercase bg-primary/15 text-accent-text border border-primary/30 shrink-0">
                      UFRGS
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {showSavedAddresses && savedAddresses.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium mr-0.5 text-text-muted">Salvos:</span>
          {savedAddresses.map((addr) => {
            const active = value?.addressId === addr.id;
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => {
                  setDraft(null);
                  setIsOpen(false);
                  onChange({
                    label: `${addr.label} (${addr.street}, ${addr.number})`,
                    region: addr.neighborhood ? `${addr.neighborhood}, ${addr.city}` : addr.city,
                    lat: addr.lat,
                    lng: addr.lng,
                    addressId: addr.id,
                  });
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors inline-flex items-center gap-1 ${
                  active
                    ? "bg-primary border-primary text-on-primary"
                    : "bg-surface-2 border-border text-text-secondary hover:border-border-strong"
                }`}
                title={`${addr.street}, ${addr.number} — CEP ${addr.postal_code}`}
              >
                <MapPinIcon size={12} />
                <span>{addr.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {showCampusShortcuts && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium mr-0.5 text-text-muted">Campi:</span>
          {UFRGS_CAMPUS.map((c) => {
            const active =
              value?.campusId === c.id ||
              (value && Math.abs(value.lat - c.lat) < 0.001 && Math.abs(value.lng - c.lng) < 0.001);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCampus(c.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary border-primary text-on-primary font-semibold"
                    : "bg-surface-2 border-border text-text-secondary hover:border-border-strong"
                }`}
              >
                {c.shortName}
              </button>
            );
          })}
        </div>
      )}
      {value && (
        <div className="flex items-center font-mono text-[11px] px-0.5 text-text-muted">
          <span>
            Bairro: <strong className="text-text-secondary">{value.region}</strong>
          </span>
        </div>
      )}

      {helperText && !gpsError && (
        <p className="text-xs px-0.5 text-text-muted">{helperText}</p>
      )}

      {gpsError && <p className="text-xs text-danger px-0.5">{gpsError}</p>}

      {value && !value.campusId && mapAddress && (
        <Input
          id={`${inputId}-number`}
          label="Número"
          value={mapAddress.number}
          placeholder={requireNumber ? "Informe o número" : "Número (se houver)"}
          required={requireNumber}
          maxLength={20}
          error={value.coordinatesVerified === false ? numberError : undefined}
          hint={value.coordinatesVerified === false && !numberError ? "Localizando endereço…" : undefined}
          onChange={(event) => {
            setNumberError("");
            const address = { ...mapAddress, number: event.target.value };
            onChange({ ...value, campusId: undefined, addressId: undefined, coordinatesVerified: false, mapAddress: address, label: formatMapAddress(address) });
          }}
        />
      )}
    </div>
  );
};
