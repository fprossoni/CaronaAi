/**
 * LocationField Component
 *
 * Smart mobility address picker inspired by Uber & BlaBlaCar.
 * Allows selecting a location via:
 * 1. Typing a street/neighborhood name (autocomplete via `geocodingService`)
 * 2. One-tap UFRGS Campus shortcuts
 * 3. Browser GPS ("Usar minha localização")
 * 4. Interactive map click ("Marcar no mapa")
 */

import React, { useEffect, useRef, useState } from "react";
import { UFRGS_CAMPUS } from "@/types/ride";
import {
  campusToLocation,
  geocodingService,
  getBrowserCurrentLocation,
  type GeocodingSuggestion,
  type LocationValue,
} from "@/lib/geocoding";
import { CrosshairIcon, MapPinIcon, NavigationIcon, SearchIcon } from "@/components/ui/Icons";

interface LocationFieldProps {
  label: string;
  placeholder?: string;
  value: LocationValue | null;
  onChange: (location: LocationValue) => void;
  dotColor?: string;
  isPickingOnMap?: boolean;
  onTogglePickOnMap?: () => void;
  allowGps?: boolean;
  showCampusShortcuts?: boolean;
  helperText?: string;
}

export const LocationField: React.FC<LocationFieldProps> = ({
  label,
  placeholder = "Digite rua, número, bairro ou campus...",
  value,
  onChange,
  dotColor = "#10b981",
  isPickingOnMap = false,
  onTogglePickOnMap,
  allowGps = true,
  showCampusShortcuts = true,
  helperText,
}) => {
  const [draftText, setDraftText] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const displayedQuery = draftText !== null ? draftText : (value?.label ?? "");

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setDraftText(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Debounced address search
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
        if (active) setSuggestions(res);
      } finally {
        if (active) setSearching(false);
      }
    }, 320);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [displayedQuery, isOpen]);

  const handleSelectSuggestion = (item: GeocodingSuggestion) => {
    setDraftText(null);
    setIsOpen(false);
    onChange({
      label: item.label,
      region: item.region,
      lat: item.lat,
      lng: item.lng,
      campusId: item.campusId,
    });
  };

  const handleSelectCampus = (campusId: string) => {
    const loc = campusToLocation(campusId);
    if (!loc) return;
    setDraftText(null);
    setIsOpen(false);
    onChange(loc);
  };

  const handleUseGps = async () => {
    setGpsError("");
    setGpsLoading(true);
    try {
      const loc = await getBrowserCurrentLocation();
      setDraftText(null);
      onChange(loc);
    } catch {
      setGpsError("Não foi possível obter o GPS. Digite o endereço ou marque no mapa.");
    } finally {
      setGpsLoading(false);
    }
  };

  const visibleSuggestions = displayedQuery.trim().length >= 2 ? suggestions : [];

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:border-indigo-500/60"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
              title="Usar minha localização atual via GPS"
            >
              <CrosshairIcon
                size={13}
                className={gpsLoading ? "animate-spin text-indigo-400" : "text-indigo-400"}
              />
              <span>{gpsLoading ? "Localizando..." : "Meu GPS"}</span>
            </button>
          )}

          {onTogglePickOnMap && (
            <button
              type="button"
              onClick={onTogglePickOnMap}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
              style={{
                backgroundColor: isPickingOnMap
                  ? "rgba(99, 102, 241, 0.18)"
                  : "var(--color-surface-2)",
                borderColor: isPickingOnMap ? "var(--color-primary)" : "var(--color-border)",
                color: isPickingOnMap
                  ? "var(--color-primary-light)"
                  : "var(--color-text-secondary)",
              }}
            >
              <MapPinIcon size={13} />
              <span>{isPickingOnMap ? "Clicando no mapa..." : "Marcar no mapa"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <span
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          value={displayedQuery}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const nextVal = e.target.value;
            setDraftText(nextVal);
            setIsOpen(true);
            if (value) {
              onChange({ ...value, label: nextVal });
            }
          }}
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
          style={{
            backgroundColor: "var(--color-surface-2)",
            borderColor: value ? "var(--color-border-strong)" : "var(--color-border)",
            color: "var(--color-text)",
          }}
        />
        {searching && (
          <span
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs animate-pulse"
            style={{ color: "var(--color-text-muted)" }}
          >
            Buscando...
          </span>
        )}
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && visibleSuggestions.length > 0 && (
        <ul
          className="absolute top-[74px] left-0 right-0 z-50 rounded-xl border shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border-strong)",
          }}
        >
          {visibleSuggestions.map((item) => (
            <li
              key={item.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(item);
              }}
              className="px-3.5 py-2.5 flex items-start gap-2.5 cursor-pointer border-b last:border-b-0 transition-colors hover:bg-indigo-500/10"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span
                className={`mt-0.5 shrink-0 ${
                  item.isCampus ? "text-indigo-400" : "text-emerald-400"
                }`}
              >
                <NavigationIcon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {item.label}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                  {item.subtitle}
                </p>
              </div>
              {item.isCampus && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 shrink-0">
                  Campus UFRGS
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* UFRGS Campus Quick Pills */}
      {showCampusShortcuts && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium mr-0.5" style={{ color: "var(--color-text-muted)" }}>
            Campi:
          </span>
          {UFRGS_CAMPUS.map((c) => {
            const active =
              value?.campusId === c.id ||
              (value && Math.abs(value.lat - c.lat) < 0.001 && Math.abs(value.lng - c.lng) < 0.001);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCampus(c.id)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  backgroundColor: active ? "var(--color-primary)" : "var(--color-surface-2)",
                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                  color: active ? "#ffffff" : "var(--color-text-secondary)",
                }}
              >
                {c.shortName}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Location Metadata / Privacy Region Indicator */}
      {value && (
        <div
          className="flex items-center justify-between text-[11px] px-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>
            ✓ Região identificada:{" "}
            <strong style={{ color: "var(--color-text-secondary)" }}>{value.region}</strong>
          </span>
          <span className="font-mono opacity-75">
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
        </div>
      )}

      {helperText && !gpsError && (
        <p className="text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
          {helperText}
        </p>
      )}

      {gpsError && <p className="text-xs text-red-400 px-1">{gpsError}</p>}
    </div>
  );
};
