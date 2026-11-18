/**
 * HomePage (`/`)
 *
 * Public & Authenticated Landing Page inspired by BlaBlaCar & Uber,
 * built in Tailwind CSS v4 with full Dark Mode and Light Mode support.
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
import {
  CarIcon,
  GraduationCapIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/Icons";
import heroImg from "@/assets/hero-carona.jpg";

const DEFAULT_CAMPUS_SUGGESTIONS: GeocodingSuggestion[] = UFRGS_CAMPUS.map((c) => ({
  id: `campus-${c.id}`,
  label: `UFRGS — ${c.name}`,
  subtitle: "Campus Oficial da UFRGS",
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
}

const HeroLocationInput: React.FC<HeroLocationInputProps> = ({
  label,
  placeholder,
  query,
  onQueryChange,
  onSelectLocation,
  Icon,
  iconColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>(DEFAULT_CAMPUS_SUGGESTIONS);
  const [searching, setSearching] = useState(false);
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

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen) return;
    if (trimmed.length < 2) {
      setSuggestions(DEFAULT_CAMPUS_SUGGESTIONS);
      setSearching(false);
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
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  return (
    <div ref={containerRef} className="relative md:col-span-5">
      <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 focus-within:border-primary transition-colors">
        <Icon size={18} className={`${iconColor} shrink-0`} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-text-muted">{label}</span>
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
          <span className="text-[11px] text-text-muted animate-pulse shrink-0">Buscando…</span>
        )}
      </label>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-xl border border-border-strong bg-surface shadow-2xl">
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
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-indigo-500/10"
              >
                <span className={`mt-0.5 shrink-0 ${item.isCampus ? "text-indigo-400" : "text-emerald-400"}`}>
                  {item.isCampus ? <GraduationCapIcon size={15} /> : <NavigationIcon size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-text">{item.label}</p>
                  <p className="text-xs truncate text-text-muted">{item.subtitle}</p>
                </div>
                {item.isCampus && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 shrink-0">
                    Campus UFRGS
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prefill: TripPrefill = {
      origin: originLocation,
      destination: destinationLocation,
      originQuery: originQuery.trim() || undefined,
      destinationQuery: destinationQuery.trim() || undefined,
    };

    if (isAuthenticated) {
      navigate("/find", {
        state: prefill,
      });
    } else {
      navigate("/login", {
        state: {
          returnTo: "/find",
          prefill,
          message:
            "Faça login com seu e-mail institucional UFRGS (@ufrgs.br ou @*.ufrgs.br) para pesquisar e solicitar caronas.",
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
    <div className="space-y-12 pb-12 animate-fade-in">
      {/* ─── Hero Section + BlaBlaCar Search Bar ──────────────────────────── */}
      <section className="rounded-3xl p-6 sm:p-10 border border-border-strong bg-gradient-cover relative shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <ShieldCheckIcon size={15} />
              <span>Rede Exclusiva Comunidade UFRGS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Viaje inteligente:{" "}
              <span className="bg-linear-to-r from-indigo-300 via-purple-200 to-emerald-300 bg-clip-text text-transparent">
                carona universitária
              </span>
              , segura e colaborativa
            </h1>

            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed max-w-xl">
              Conecte sua rota diária a outros estudantes e servidores da UFRGS. Menos trânsito,
              privacidade de endereço garantida e caronas com desvio mínimo calculado por rota real.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl overflow-hidden border-2 border-white/15 shadow-2xl relative aspect-16/10">
              <img
                src={heroImg}
                alt="Estudantes da UFRGS compartilhando carona"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/95 font-semibold px-3 py-2 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15">
                <span>6 Campi Conectados</span>
                <span className="text-emerald-300">Desvio máx. 3 km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="mt-8 p-3 rounded-2xl border border-border-strong bg-surface shadow-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
        >
          <HeroLocationInput
            label="Origem"
            placeholder="Rua, bairro ou campus da UFRGS"
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
            iconColor="text-emerald-400"
          />

          <HeroLocationInput
            label="Destino"
            placeholder="Campus da UFRGS, rua ou bairro"
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
            iconColor="text-indigo-400"
          />

          {/* Submit */}
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" fullWidth>
              <SearchIcon size={16} />
              <span>Procurar</span>
            </Button>
          </div>
        </form>
      </section>

      {/* ─── Unauthenticated Institutional Notice ─────────────────────────── */}
      {!isAuthenticated && (
        <div className="p-4 rounded-2xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <ShieldCheckIcon size={20} className="text-emerald-400 shrink-0" />
            <p>
              Plataforma exclusiva para a comunidade acadêmica. Aceitamos{" "}
              <code className="text-indigo-400 font-semibold">@ufrgs.br</code> e subdomínios de institutos (ex:{" "}
              <code className="text-indigo-400 font-semibold">@inf.ufrgs.br</code>).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/login" className="no-underline">
              <Button size="sm" variant="secondary">Entrar</Button>
            </Link>
            <Link to="/register" className="no-underline">
              <Button size="sm" variant="primary">Criar conta</Button>
            </Link>
          </div>
        </div>
      )}

      {/* ─── Vantagens / Diferenciais ─────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
            Vantagens
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
            Como funciona o Carona Aí?
          </h2>
          <p className="text-sm text-text-muted">
            Desenvolvido com roteamento OSRM, PostGIS e Multi-Matching sob medida para os campi da UFRGS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <ShieldCheckIcon size={22} />,
              accent: "bg-emerald-500/15 text-emerald-400",
              title: "100% Comunidade UFRGS",
              desc: "Todos os usuários validam seu vínculo institucional antes de oferecer ou pedir carona, trazendo confiança real entre colegas.",
            },
            {
              icon: <NavigationIcon size={22} />,
              accent: "bg-indigo-500/15 text-indigo-400",
              title: "Multi-Matching com Menor Desvio",
              desc: "Solicite carona para várias opções da lista de uma só vez. Assim que um motorista aceitar, as demais são atualizadas automaticamente.",
            },
            {
              icon: <MapPinIcon size={22} />,
              accent: "bg-amber-500/15 text-amber-400",
              title: "Privacidade de Endereço",
              desc: "Seu endereço exato nunca fica exposto nas buscas públicas: o motorista vê apenas o bairro até confirmar sua vaga na viagem.",
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="rounded-3xl border border-border bg-gradient-card p-6 space-y-3 transition-transform hover:-translate-y-1"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${feat.accent}`}>
                {feat.icon}
              </div>
              <h3 className="text-base font-extrabold text-text">
                {feat.title}
              </h3>
              <p className="text-xs leading-relaxed text-text-muted">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Campi Conectados ─────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Destinos Oficiais
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text">
              6 Campi da UFRGS Atendidos
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            Toque em um campus para buscar caronas disponíveis
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {UFRGS_CAMPUS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                handleProtectedAction(
                  "/find",
                  `Faça login para ver caronas conectadas ao ${c.name}.`,
                  c.id
                )
              }
              className="p-4 rounded-2xl border border-border bg-gradient-card text-left flex items-center gap-3.5 transition-all hover:border-indigo-500/60 hover:-translate-y-0.5"
            >
              <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
                <GraduationCapIcon size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate text-text">
                  {c.name}
                </h4>
                <p className="text-[11px] text-text-muted">
                  Pesquisar rotas →
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Driver CTA Banner ────────────────────────────────────────────── */}
      <section className="rounded-3xl p-6 sm:p-8 border border-border-strong bg-gradient-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h3 className="text-xl font-extrabold text-text">
            Você vai de carro para a UFRGS?
          </h3>
          <p className="text-sm text-text-muted">
            Divida os custos do trajeto, ajude colegas do seu instituto e publique sua oferta de
            carona em menos de 1 minuto usando seus endereços salvos.
          </p>
        </div>

        <div className="shrink-0">
          <Button
            size="lg"
            variant="primary"
            onClick={() =>
              handleProtectedAction(
                "/offer",
                "Entre com seu e-mail institucional UFRGS para oferecer uma carona."
              )
            }
          >
            <CarIcon size={18} />
            <span>Oferecer uma carona</span>
          </Button>
        </div>
      </section>
    </div>
  );
};
