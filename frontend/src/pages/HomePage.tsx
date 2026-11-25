/**
 * HomePage (`/`)
 *
 * Technical minimal landing page with topographic hero, dual-tone typography,
 * coupled Origin/Destination search bar, Bento differentiators, and UFRGS campus grid.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import {
  campusToLocation,
  geocodingService,
  type GeocodingSuggestion,
  type LocationValue,
} from "@/lib/geocoding";
import type { TripPrefill } from "@/lib/tripRoute";
import { Button } from "@/components/ui/Button";
import { KineticChevrons, RouteTelemetryBar } from "@/components/ui/BrandMotifs";
import {
  ArrowUpRightIcon,
  CarIcon,
  GraduationCapIcon,
  LockIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  ShieldCheckIcon,
  SwapIcon,
} from "@/components/ui/Icons";
import heroImg from "@/assets/hero-carona.jpg";

const DEFAULT_CAMPUS_SUGGESTIONS: GeocodingSuggestion[] = UFRGS_CAMPUS.map((c) => ({
  id: `campus-${c.id}`,
  label: `UFRGS — ${c.name}`,
  subtitle: "Campus UFRGS",
  region: c.name,
  lat: c.lat,
  lng: c.lng,
  campusId: c.id,
  isCampus: true,
}));

interface HeroLocationInputProps {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelectLocation: (loc: LocationValue) => void;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  className?: string;
}

const HeroLocationInput: React.FC<HeroLocationInputProps> = ({
  label,
  placeholder,
  query,
  onQueryChange,
  onSelectLocation,
  Icon,
  iconColor,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [remoteResult, setRemoteResult] = useState<{
    query: string;
    items: GeocodingSuggestion[];
  } | null>(null);
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!isOpen || trimmedQuery.length < 2) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearchingQuery(trimmedQuery);
      try {
        const res = await geocodingService.searchAddress(trimmedQuery);
        if (active) setRemoteResult({ query: trimmedQuery, items: res });
      } finally {
        if (active) setSearchingQuery(null);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery, isOpen]);

  const suggestions =
    trimmedQuery.length < 2
      ? DEFAULT_CAMPUS_SUGGESTIONS
      : remoteResult?.query === trimmedQuery
      ? remoteResult.items
      : [];
  const searching = trimmedQuery.length >= 2 && searchingQuery === trimmedQuery;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="flex items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 focus-within:border-primary transition-colors">
        <Icon size={16} className={`${iconColor} shrink-0`} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsOpen(false);
            }}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setIsOpen(true);
            }}
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </span>
        {isOpen && searching && (
          <span className="font-mono text-[11px] text-text-muted animate-pulse shrink-0">…</span>
        )}
      </label>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-md border border-border-strong bg-surface shadow-lg">
          {suggestions.map((item) => (
            <li key={item.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onSelectLocation({
                    label: item.label,
                    region: item.region,
                    lat: item.lat,
                    lng: item.lng,
                    campusId: item.campusId,
                    mapAddress: item.mapAddress,
                  });
                  setIsOpen(false);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className={`mt-0.5 shrink-0 ${item.isCampus ? "text-accent-text" : "text-secondary"}`}>
                  {item.isCampus ? <GraduationCapIcon size={14} /> : <NavigationIcon size={14} />}
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
  );
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originLocation, setOriginLocation] = useState<LocationValue | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationValue | null>(null);

  const handleSwapHero = () => {
    setOriginQuery(destinationQuery);
    setDestinationQuery(originQuery);
    setOriginLocation(destinationLocation);
    setDestinationLocation(originLocation);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prefill: TripPrefill = {
      origin: originLocation,
      destination: destinationLocation,
      originQuery: originQuery.trim() || undefined,
      destinationQuery: destinationQuery.trim() || undefined,
    };

    if (isAuthenticated) {
      navigate("/find", { state: prefill });
    } else {
      navigate("/login", {
        state: {
          returnTo: "/find",
          prefill,
          message:
            "Entre com seu e-mail institucional UFRGS (@ufrgs.br) para pesquisar caronas.",
        },
      });
    }
  };

  const handleProtectedAction = (path: string, message: string, selectedCampus?: CampusId) => {
    const prefill: TripPrefill | undefined = selectedCampus
      ? { campus: selectedCampus, destination: campusToLocation(selectedCampus) }
      : undefined;
    if (isAuthenticated) {
      navigate(path, prefill ? { state: prefill } : undefined);
    } else {
      navigate("/login", {
        state: {
          returnTo: path,
          prefill,
          message,
        },
      });
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      {/* ─── Hero Section ────────────────────────────────────────────────── */}
      <section className="rounded-[10px] p-5 sm:p-8 border border-border-strong bg-surface bg-topo-pattern relative shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[11px] font-semibold uppercase tracking-wider bg-surface-2 text-accent-text border border-border-strong">
              <ShieldCheckIcon size={13} />
              <span>REDE EXCLUSIVA · @UFRGS.BR</span>
            </span>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08]">
              <span className="text-text block">Mobilidade universitária</span>
              <span className="text-text-secondary block">entre campi UFRGS.</span>
            </h1>

            <RouteTelemetryBar
              items={["06 CAMPI", "≤ 3 KM DESVIO", "PRIVACIDADE DE BAIRRO"]}
              className="pt-1"
            />
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-[10px] overflow-hidden border border-border-strong shadow-md relative aspect-16/10 bg-bg-elevated">
              <img
                src={heroImg}
                alt="Estudantes da UFRGS compartilhando carona"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-[4px] bg-[#0b0c0d]/85 backdrop-blur-md border border-white/15 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#f4f5f2]">
                <span>PORTO ALEGRE · UFRGS</span>
                <span className="text-[#fa952d]">VERIFICADO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coupled Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="mt-7 p-2.5 rounded-md border border-border-strong bg-bg-elevated flex flex-col md:flex-row items-stretch md:items-center gap-2"
        >
          <HeroLocationInput
            label="Origem"
            placeholder="Rua, bairro ou campus"
            query={originQuery}
            onQueryChange={(q) => {
              setOriginQuery(q);
              setOriginLocation(null);
            }}
            onSelectLocation={(loc) => {
              setOriginLocation(loc);
              setOriginQuery(loc.label);
            }}
            Icon={MapPinIcon}
            iconColor="text-accent-text"
            className="flex-1 min-w-0"
          />

          <div className="flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={handleSwapHero}
              aria-label="Inverter origem e destino"
              title="Inverter origem e destino"
              className="w-8 h-8 rounded-full border border-border-strong bg-surface flex items-center justify-center text-text-secondary hover:text-text hover:border-primary transition-colors"
            >
              <SwapIcon size={14} />
            </button>
          </div>

          <HeroLocationInput
            label="Destino"
            placeholder="Campus, rua ou bairro"
            query={destinationQuery}
            onQueryChange={(q) => {
              setDestinationQuery(q);
              setDestinationLocation(null);
            }}
            onSelectLocation={(loc) => {
              setDestinationLocation(loc);
              setDestinationQuery(loc.label);
            }}
            Icon={NavigationIcon}
            iconColor="text-secondary"
            className="flex-1 min-w-0"
          />

          <div className="md:w-44 shrink-0">
            <Button type="submit" variant="primary" size="lg" fullWidth>
              <SearchIcon size={15} />
              <span>Procurar</span>
              <KineticChevrons />
            </Button>
          </div>
        </form>

        {!isAuthenticated && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2 text-xs text-text-muted">
            <span>Acesso exclusivo com e-mail @ufrgs.br ou institutos.</span>
            <Link
              to="/login"
              className="font-semibold text-accent-text hover:underline no-underline"
            >
              Entrar com @ufrgs.br →
            </Link>
          </div>
        )}
      </section>

      {/* ─── Bento Differentiators ──────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {[
          {
            code: "01 · VÍNCULO UFRGS",
            icon: <ShieldCheckIcon size={18} />,
            desc: "Acesso restrito a e-mails @ufrgs.br e institutos.",
          },
          {
            code: "02 · MULTI-MATCHING",
            icon: <NavigationIcon size={18} />,
            desc: "Peça várias caronas; o primeiro aceite encerra as demais.",
          },
          {
            code: "03 · ENDEREÇO OCULTO",
            icon: <LockIcon size={18} />,
            desc: "Apenas seu bairro é exibido até a confirmação da vaga.",
          },
        ].map((feat) => (
          <div
            key={feat.code}
            className="rounded-[10px] border border-border bg-surface p-5 flex flex-col justify-between gap-3 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold tracking-wider text-accent-text">
                {feat.code}
              </span>
              <span className="text-text-muted">{feat.icon}</span>
            </div>
            <p className="text-sm text-text-secondary leading-snug">{feat.desc}</p>
          </div>
        ))}
      </section>

      {/* ─── Campi UFRGS Grid ──────────────────────────────────────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-text">
            Campi UFRGS
          </h2>
          <span className="font-mono text-[11px] text-text-muted">06 DESTINOS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {UFRGS_CAMPUS.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                handleProtectedAction(
                  "/find",
                  `Entre para ver caronas conectadas ao ${c.name}.`,
                  c.id
                )
              }
              className="group p-3.5 rounded-md border border-border bg-surface text-left flex items-center justify-between gap-3 transition-colors hover:border-primary/70 hover:bg-surface-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-text-muted group-hover:text-accent-text shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold truncate text-text">{c.name}</span>
              </div>
              <ArrowUpRightIcon
                size={15}
                className="text-text-muted group-hover:text-accent-text shrink-0 transition-colors"
              />
            </button>
          ))}
        </div>
      </section>

      {/* ─── Driver CTA Strip ──────────────────────────────────────────── */}
      <section className="rounded-[10px] p-5 sm:p-6 border border-border-strong bg-surface bg-dot-matrix flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold text-text">
            Vai de carro para o campus?
          </h3>
          <p className="text-xs text-text-muted">Publique seu trajeto em segundos.</p>
        </div>

        <Button
          size="lg"
          variant="primary"
          onClick={() =>
            handleProtectedAction(
              "/offer",
              "Entre com seu e-mail UFRGS para oferecer uma carona."
            )
          }
        >
          <CarIcon size={16} />
          <span>Oferecer carona</span>
          <KineticChevrons />
        </Button>
      </section>
    </div>
  );
};
