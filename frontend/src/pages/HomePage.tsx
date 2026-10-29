/**
 * HomePage (`/`)
 *
 * Public & Authenticated Landing Page inspired by BlaBlaCar & Uber,
 * built in Tailwind CSS v4 with full Dark Mode and Light Mode support.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import { Button } from "@/components/ui/Button";
import {
  CarIcon,
  CompassIcon,
  GraduationCapIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/Icons";
import heroImg from "@/assets/hero-carona.jpg";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [campusPoint, setCampusPoint] = useState<CampusId>(UFRGS_CAMPUS[0].id);
  const [direction, setDirection] = useState<"to_campus" | "from_campus">("to_campus");
  const [addressInput, setAddressInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAuthenticated) {
      navigate("/find", {
        state: {
          campus: campusPoint,
          direction,
          addressQuery: addressInput.trim() || undefined,
        },
      });
    } else {
      navigate("/login", {
        state: {
          returnTo: "/find",
          prefill: { campus: campusPoint, direction, addressQuery: addressInput.trim() || undefined },
          message:
            "Faça login com seu e-mail institucional UFRGS (@ufrgs.br ou @*.ufrgs.br) para pesquisar e solicitar caronas.",
        },
      });
    }
  };

  const handleProtectedAction = (path: string, message: string, selectedCampus?: CampusId) => {
    if (isAuthenticated) {
      navigate(path, selectedCampus ? { state: { campus: selectedCampus } } : undefined);
    } else {
      navigate("/login", {
        state: {
          returnTo: path,
          prefill: selectedCampus ? { campus: selectedCampus } : undefined,
          message,
        },
      });
    }
  };

  return (
    <div className="space-y-12 pb-12 animate-fade-in">
      {/* ─── Hero Section + BlaBlaCar Search Bar ──────────────────────────── */}
      <section
        className="rounded-3xl p-6 sm:p-10 border relative overflow-hidden shadow-2xl"
        style={{
          background: "var(--gradient-cover)",
          borderColor: "var(--color-border-strong)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <ShieldCheckIcon size={15} />
              <span>Rede Exclusiva Comunidade UFRGS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Viaje inteligente:{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-purple-200 to-emerald-300 bg-clip-text text-transparent">
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
            <div className="rounded-3xl overflow-hidden border-2 border-white/15 shadow-2xl relative aspect-[16/10]">
              <img
                src={heroImg}
                alt="Estudantes da UFRGS compartilhando carona"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
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
          className="mt-8 p-3 rounded-2xl border shadow-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border-strong)",
          }}
        >
          {/* Origem */}
          <div
            className="md:col-span-4 flex items-center gap-3 px-3.5 py-2.5 rounded-xl border"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <MapPinIcon size={18} className="text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
                {direction === "to_campus" ? "Sua Partida" : "Campus Origem"}
              </label>
              {direction === "to_campus" ? (
                <input
                  type="text"
                  placeholder="Seu bairro ou rua..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium outline-none"
                  style={{ color: "var(--color-text)" }}
                />
              ) : (
                <select
                  value={campusPoint}
                  onChange={(e) => setCampusPoint(e.target.value as CampusId)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                  style={{ color: "var(--color-text)" }}
                >
                  {UFRGS_CAMPUS.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Destino */}
          <div
            className="md:col-span-4 flex items-center gap-3 px-3.5 py-2.5 rounded-xl border"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <NavigationIcon size={18} className="text-indigo-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
                {direction === "to_campus" ? "Campus Destino" : "Seu Destino"}
              </label>
              {direction === "to_campus" ? (
                <select
                  value={campusPoint}
                  onChange={(e) => setCampusPoint(e.target.value as CampusId)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                  style={{ color: "var(--color-text)" }}
                >
                  {UFRGS_CAMPUS.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Seu bairro ou rua..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium outline-none"
                  style={{ color: "var(--color-text)" }}
                />
              )}
            </div>
          </div>

          {/* Sentido */}
          <div
            className="md:col-span-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <CompassIcon size={17} className="text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
                Sentido
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "to_campus" | "from_campus")}
                className="w-full bg-transparent text-xs font-bold outline-none"
                style={{ color: "var(--color-text)" }}
              >
                <option value="to_campus" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}>
                  Indo p/ UFRGS
                </option>
                <option value="from_campus" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)" }}>
                  Saindo da UFRGS
                </option>
              </select>
            </div>
          </div>

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
        <div
          className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
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
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Como funciona o Carona Aí?
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
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
              className="rounded-3xl border p-6 space-y-3 transition-transform hover:-translate-y-1"
              style={{
                background: "var(--gradient-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${feat.accent}`}>
                {feat.icon}
              </div>
              <h3 className="text-base font-extrabold" style={{ color: "var(--color-text)" }}>
                {feat.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
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
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
              6 Campi da UFRGS Atendidos
            </h2>
          </div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
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
              className="p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all hover:border-indigo-500/60 hover:-translate-y-0.5"
              style={{
                background: "var(--gradient-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
                <GraduationCapIcon size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>
                  {c.name}
                </h4>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Pesquisar rotas →
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Driver CTA Banner ────────────────────────────────────────────── */}
      <section
        className="rounded-3xl p-6 sm:p-8 border flex flex-col md:flex-row md:items-center justify-between gap-6"
        style={{
          background: "var(--gradient-card)",
          borderColor: "var(--color-border-strong)",
        }}
      >
        <div className="space-y-1.5 max-w-xl">
          <h3 className="text-xl font-extrabold" style={{ color: "var(--color-text)" }}>
            Você vai de carro para a UFRGS?
          </h3>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
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
