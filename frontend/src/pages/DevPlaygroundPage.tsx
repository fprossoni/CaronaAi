/**
 * DevPlaygroundPage (`/dev`)
 *
 * Interactive Component Showcase & Developer Sandbox.
 * Allows inspecting, triggering, and testing every modal, card state, map widget,
 * notification, and authentication role in isolation without requiring multiple
 * user accounts or a running backend server.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore, DEV_MOCK_TOKEN } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useToastStore } from "@/store/toastStore";
import {
  MOCK_CONFIRMED_DETAILS,
  MOCK_DRIVER_REQUESTS,
  MOCK_DRIVER_USER,
  MOCK_FEMALE_DRIVER_PUBLIC,
  MOCK_INCOMPLETE_USER,
  MOCK_PASSENGER_USER,
  MOCK_RIDE_FULL,
  MOCK_RIDE_STANDARD,
  MOCK_RIDE_WOMEN_ONLY,
  MOCK_ROUTE_GEOJSON,
} from "@/data/devMocks";
import type { UserPublic } from "@/types/user";
import { geocodingService, type LocationValue } from "@/lib/geocoding";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangleIcon,
  CarIcon,
  CheckCircleIcon,
  CompassIcon,
  MapPinIcon,
  MoonIcon,
  ShieldCheckIcon,
  StarIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { RideCard } from "@/components/rides/RideCard";
import { RideRequestsModal } from "@/components/rides/RideRequestsModal";
import { RatingModal } from "@/components/rides/RatingModal";
import { ReportUserModal } from "@/components/rides/ReportUserModal";
import { UserProfileModal } from "@/components/users/UserProfileModal";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { LocationField } from "@/components/map/LocationField";
import { SavedAddressesManager } from "@/components/profile/SavedAddressesManager";

// ─── Reusable Section Container with Source File Badge ───────────────────────

interface SectionCardProps {
  title: string;
  subtitle: string;
  filePath: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  filePath,
  icon,
  children,
}) => (
  <section
    className="rounded-3xl border p-6 space-y-5 shadow-lg"
    style={{
      background: "var(--gradient-card)",
      borderColor: "var(--color-border)",
    }}
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            {title}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        </div>
      </div>

      <code
        className="self-start sm:self-center px-3 py-1 rounded-xl text-[11px] font-mono border shrink-0"
        style={{
          backgroundColor: "var(--color-surface-2)",
          borderColor: "var(--color-border)",
          color: "var(--color-primary-light)",
        }}
        title="Caminho do arquivo fonte no projeto"
      >
        {filePath}
      </code>
    </div>

    <div>{children}</div>
  </section>
);

// ─── Main Playground Page ────────────────────────────────────────────────────

export const DevPlaygroundPage: React.FC = () => {
  const { user, isAuthenticated, setDevSession, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const toast = useToastStore();

  // Active modal states for 1-click inspection
  const [inspectingUser, setInspectingUser] = useState<UserPublic | null>(null);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{
    id: number;
    name: string;
    course: string;
    photo_url: string | null;
    role: "driver" | "passenger";
  } | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Interactive map & location sandbox state
  const [sandboxLocation, setSandboxLocation] = useState<LocationValue | null>({
    label: "Av. Osvaldo Aranha, 1020 — Bom Fim, Porto Alegre",
    lat: -30.0365,
    lng: -51.2135,
    region: "Bom Fim / Cidade Baixa",
  });
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [approximatePrivacyCircle, setApproximatePrivacyCircle] = useState(false);

  const isMockToken = localStorage.getItem("access_token") === DEV_MOCK_TOKEN;

  const handleSandboxMapClick = async (lat: number, lng: number) => {
    const resolved = await geocodingService.reverseGeocode(lat, lng);
    setSandboxLocation(resolved);
    setPickingOnMap(false);
    toast.info("Coordenada selecionada no mapa", resolved.label);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Hero Banner */}
      <div
        className="rounded-3xl p-6 sm:p-8 border relative overflow-hidden"
        style={{
          background: "var(--gradient-cover)",
          borderColor: "var(--color-border-strong)",
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold border border-white/20">
              <ShieldCheckIcon size={14} />
              <span>Ambiente de Inspeção & Design System (/dev)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Playground de Componentes & Telas
            </h1>
            <p className="text-sm text-indigo-100/90 leading-relaxed">
              Teste qualquer modal, estado de card, mapa ou fluxo de usuário com 1 clique usando
              dados simulados — sem precisar criar contas extras ou rodar o backend. Cada seção exibe o arquivo <code className="text-white font-semibold">.tsx</code> correspondente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition"
            >
              {theme === "dark" ? (
                <>
                  <SunIcon size={16} className="text-amber-300" />
                  <span>Testar em Light Mode</span>
                </>
              ) : (
                <>
                  <MoonIcon size={16} className="text-indigo-200" />
                  <span>Testar em Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 1. Simulador de Sessão & Navegação Rápida */}
      <SectionCard
        title="1. Simulador de Sessão (Mock Auth) & Atalhos de Rotas"
        subtitle="Troque instantaneamente o papel do usuário logado para acessar páginas protegidas sem depender do backend."
        filePath="src/store/authStore.ts • src/App.tsx"
        icon={<UserIcon size={20} />}
      >
        <div className="space-y-5">
          {/* Active Session Status Bar */}
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              {user ? (
                <Avatar name={user.name} photoUrl={user.photo_url} size="md" ring />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-500/20 flex items-center justify-center text-slate-400">
                  <UserIcon size={20} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                    {isAuthenticated && user
                      ? `${user.name ?? "Sem nome"} (${user.email})`
                      : "Nenhum usuário autenticado (Visitante)"}
                  </span>
                  {isMockToken && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Sessão Simulada Ativa
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {isAuthenticated && user
                    ? `Papel: ${user.is_driver ? "Motorista & Passageiro" : "Apenas Passageiro"} • Perfil completo: ${
                        user.profile_complete ? "Sim" : "Não (Redireciona p/ completar)"
                      }`
                    : "Rotas protegidas redirecionarão para /login até que você ative uma sessão abaixo."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={user?.id === MOCK_DRIVER_USER.id ? "primary" : "secondary"}
                onClick={() => {
                  setDevSession(MOCK_DRIVER_USER);
                  toast.success("Sessão alterada: Motorista", "Logado como Pedro (Ciência da Computação).");
                }}
              >
                Simular Motorista
              </Button>
              <Button
                size="sm"
                variant={user?.id === MOCK_PASSENGER_USER.id ? "primary" : "secondary"}
                onClick={() => {
                  setDevSession(MOCK_PASSENGER_USER);
                  toast.success("Sessão alterada: Passageira", "Logada como Marina (Arquitetura).");
                }}
              >
                Simular Passageira
              </Button>
              <Button
                size="sm"
                variant={user?.id === MOCK_INCOMPLETE_USER.id ? "primary" : "secondary"}
                onClick={() => {
                  setDevSession(MOCK_INCOMPLETE_USER);
                  toast.info("Sessão alterada: Cadastro Incompleto", "Ideal para testar a tela /profile/complete.");
                }}
              >
                Simular Perfil Incompleto
              </Button>
              {isAuthenticated && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    logout();
                    toast.info("Sessão encerrada", "Você agora está como visitante deslogado.");
                  }}
                >
                  Deslogar
                </Button>
              )}
            </div>
          </div>

          {/* Direct Route Links Grid */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-text-muted)" }}>
              Saltar diretamente para qualquer página:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { to: "/", label: "Landing Page (Início)", file: "HomePage.tsx" },
                { to: "/find", label: "Pedir Carona", file: "FindRidePage.tsx" },
                { to: "/offer", label: "Oferecer Carona", file: "OfferRidePage.tsx" },
                { to: "/rides", label: "Minhas Caronas", file: "MyRidesPage.tsx" },
                { to: "/rides/history", label: "Histórico", file: "HistoryPage.tsx" },
                { to: "/profile", label: "Meu Perfil", file: "ProfilePage.tsx" },
                { to: "/profile/complete", label: "Completar Perfil", file: "ProfileCompletePage.tsx" },
                { to: "/login", label: "Tela de Login", file: "auth/LoginPage.tsx" },
                { to: "/register", label: "Tela de Cadastro", file: "auth/RegisterPage.tsx" },
                { to: "/verify-email", label: "Verificar E-mail", file: "auth/VerifyEmailPage.tsx" },
              ].map((route) => (
                <Link
                  key={route.to}
                  to={route.to}
                  className="p-3 rounded-2xl border no-underline transition-all hover:border-indigo-500/60 hover:-translate-y-0.5 flex flex-col justify-between gap-1"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                    {route.label} →
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {route.file}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Disparador de Modais (1 Clique) */}
      <SectionCard
        title="2. Catálogo de Modais Interativos (1 Clique)"
        subtitle="Abra qualquer modal diretamente com dados reais de exemplo para inspecionar layout, bordas e interações."
        filePath="src/components/users/* • src/components/rides/*"
        icon={<CompassIcon size={20} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 2A: UserProfileModal */}
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between gap-4"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  Cartão Social de Usuário
                </span>
                <code className="text-[11px] text-indigo-400">UserProfileModal.tsx</code>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Exibe capa estilo LinkedIn, foto com anel Instagram, selo UFRGS, curso, bio, campi, veículo e botão de bloquear.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setInspectingUser(MOCK_FEMALE_DRIVER_PUBLIC)}
              >
                Abrir Perfil Motorista (Beatriz)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setInspectingUser(MOCK_PASSENGER_USER)}
              >
                Abrir Perfil Passageira (Marina)
              </Button>
            </div>
          </div>

          {/* Card 2B: RideRequestsModal */}
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between gap-4"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  Gestão de Solicitações (Visão do Motorista)
                </span>
                <code className="text-[11px] text-indigo-400">RideRequestsModal.tsx</code>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Teste aceitar uma solicitação pendente e veja o endereço exato no mapa + botão de WhatsApp serem revelados na hora!
              </p>
            </div>

            <div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowRequestsModal(true)}
              >
                Abrir Modal de Solicitações (2 Passageiros)
              </Button>
            </div>
          </div>

          {/* Card 2C: RatingModal */}
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between gap-4"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  Avaliação de Viagem (1 a 5 Estrelas)
                </span>
                <code className="text-[11px] text-indigo-400">RatingModal.tsx</code>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Seletor interativo de estrelas com feedback dinâmico e comentário opcional pós-carona.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  setRatingTarget({
                    id: MOCK_DRIVER_USER.id,
                    name: MOCK_DRIVER_USER.name ?? "Pedro",
                    course: MOCK_DRIVER_USER.course ?? "Ciência da Computação",
                    photo_url: MOCK_DRIVER_USER.photo_url,
                    role: "driver",
                  })
                }
              >
                <StarIcon size={14} filled /> Avaliar Motorista
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setRatingTarget({
                    id: MOCK_PASSENGER_USER.id,
                    name: MOCK_PASSENGER_USER.name ?? "Marina",
                    course: MOCK_PASSENGER_USER.course ?? "Arquitetura",
                    photo_url: MOCK_PASSENGER_USER.photo_url,
                    role: "passenger",
                  })
                }
              >
                Avaliar Passageiro
              </Button>
            </div>
          </div>

          {/* Card 2D: ReportUserModal */}
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between gap-4"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  Relato de Ocorrência & Bloqueio
                </span>
                <code className="text-[11px] text-indigo-400">ReportUserModal.tsx</code>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Fluxo de segurança e moderação para reportar problemas na carona e bloquear preventivamente o usuário.
              </p>
            </div>

            <div>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setReportTarget({
                    id: MOCK_DRIVER_USER.id,
                    name: MOCK_DRIVER_USER.name ?? "Pedro Oliveira",
                  })
                }
              >
                <AlertTriangleIcon size={14} /> Abrir Modal de Denúncia
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 3. Sistema de Notificações & Confirmações */}
      <SectionCard
        title="3. Notificações Flutuantes (Toasts) & Diálogo de Confirmação"
        subtitle="Substitui os alert() e confirm() nativos do navegador por componentes estilizados não-bloqueantes."
        filePath="src/components/ui/ToastContainer.tsx • src/store/toastStore.ts"
        icon={<CheckCircleIcon size={20} />}
      >
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              toast.success(
                "Solicitação enviada com sucesso!",
                "O motorista receberá sua região aproximada e o desvio calculado."
              )
            }
          >
            Disparar Toast Sucesso
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              toast.error(
                "Falha ao calcular rota",
                "Não foi possível conectar ao servidor OSRM. Usando estimativa linear."
              )
            }
          >
            Disparar Toast Erro
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.info(
                "Dica de Privacidade",
                "Seu ponto exato de embarque só é revelado após o motorista aceitar a carona."
              )
            }
          >
            Disparar Toast Info
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const confirmed = await toast.confirm({
                title: "Cancelar oferta de carona?",
                description:
                  "Os passageiros já confirmados serão notificados de que esta viagem não acontecerá mais.",
                confirmLabel: "Sim, cancelar carona",
                cancelLabel: "Voltar",
                variant: "danger",
              });
              if (confirmed) {
                toast.info("Ação confirmada pelo usuário!");
              } else {
                toast.info("Ação cancelada.");
              }
            }}
          >
            Abrir Modal de Confirmação (Danger)
          </Button>
        </div>
      </SectionCard>

      {/* 4. Estados do RideCard */}
      <SectionCard
        title="4. Vitrine de Estados do Card de Carona (RideCard)"
        subtitle="Compare todos os estados visuais do card (disponível, só mulheres, aguardando aprovação, confirmado e lotado). Dica: clique no nome/foto do motorista ou em 'Ver rota no mapa'!"
        filePath="src/components/rides/RideCard.tsx"
        icon={<CarIcon size={20} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Estado A: Disponível + Desvio Baixo */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block px-1">
              A) Padrão • Desvio Baixo (+420m) • Botão Solicitar
            </span>
            <RideCard
              ride={MOCK_RIDE_STANDARD}
              passengerPickup={{
                lat: -30.0365,
                lng: -51.2135,
                label: "Bom Fim (Região aproximada)",
              }}
              onRequestMatch={(r) =>
                toast.success("Simulação: Solicitar Carona", `Você clicou para solicitar a carona #${r.id} de ${r.driver.name}.`)
              }
            />
          </div>

          {/* Estado B: Só Mulheres + Desvio Moderado */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-400 block px-1">
              B) Filtro '♀ Só Mulheres' • Desvio Moderado (+1.8 km)
            </span>
            <RideCard
              ride={MOCK_RIDE_WOMEN_ONLY}
              onRequestMatch={(r) =>
                toast.success("Simulação: Solicitar Carona", `Você clicou para solicitar a carona #${r.id} de ${r.driver.name}.`)
              }
            />
          </div>

          {/* Estado C: Já Solicitada (Pending) */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block px-1">
              C) Já Solicitada pelo Passageiro (Status: pending)
            </span>
            <RideCard
              ride={MOCK_RIDE_STANDARD}
              existingMatchStatus="pending"
              onRequestMatch={() => {}}
            />
          </div>

          {/* Estado D: Confirmada (Accepted) e Lotada */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block px-1">
              D) Carona Confirmada (Status: accepted) vs Lotada (0 vagas)
            </span>
            <div className="space-y-4">
              <RideCard
                ride={MOCK_RIDE_STANDARD}
                existingMatchStatus="accepted"
                onRequestMatch={() => {}}
              />
              <RideCard
                ride={MOCK_RIDE_FULL}
                onRequestMatch={() => {}}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 5. Sandbox de Mapa & Seletor de Endereço */}
      <SectionCard
        title="5. Sandbox de Mapa Interativo & Autocomplete de Endereço"
        subtitle="Teste a busca de endereço (OpenStreetMap Nominatim), atalhos de Campi da UFRGS, clique no mapa e o círculo de privacidade de embarque."
        filePath="src/components/map/InteractiveMap.tsx • LocationField.tsx"
        icon={<MapPinIcon size={20} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <LocationField
              label="Ponto de Embarque (Teste de Autocomplete)"
              value={sandboxLocation}
              onChange={(loc) => {
                setSandboxLocation(loc);
                setPickingOnMap(false);
              }}
              isPickingOnMap={pickingOnMap}
              onTogglePickOnMap={() => setPickingOnMap((prev) => !prev)}
              helperText="Experimente digitar uma rua de Porto Alegre, clicar em um Campus ou usar 'Mapa'."
            />

            <div
              className="p-4 rounded-2xl border space-y-3"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                  Modo de Privacidade do Embarque
                </span>
                <button
                  type="button"
                  onClick={() => setApproximatePrivacyCircle((prev) => !prev)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    approximatePrivacyCircle
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  }`}
                >
                  {approximatePrivacyCircle ? "Raio Aproximado (650m)" : "Pino Exato Liberado"}
                </button>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Alterna a propriedade <code className="text-indigo-400">pickupIsApproximate</code> no{" "}
                <code className="text-indigo-400">InteractiveMap</code> para simular a visão antes e depois do aceite do motorista.
              </p>

              {sandboxLocation && (
                <div className="pt-2 border-t text-[11px] font-mono space-y-1" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                  <div>Label: {sandboxLocation.label}</div>
                  <div>Região: {sandboxLocation.region}</div>
                  <div>
                    Coords: {sandboxLocation.lat.toFixed(5)}, {sandboxLocation.lng.toFixed(5)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <InteractiveMap
              height="340px"
              origin={{
                lat: -30.0349,
                lng: -51.2177,
                label: "Origem: Campus Centro UFRGS",
              }}
              destination={{
                lat: -30.0734,
                lng: -51.1201,
                label: "Destino: Campus do Vale UFRGS",
              }}
              pickup={
                sandboxLocation
                  ? {
                      lat: sandboxLocation.lat,
                      lng: sandboxLocation.lng,
                      label: sandboxLocation.label,
                    }
                  : null
              }
              pickupIsApproximate={approximatePrivacyCircle}
              routeGeoJson={MOCK_ROUTE_GEOJSON}
              interactivePickMode={pickingOnMap ? "pickup" : null}
              onMapClick={pickingOnMap ? handleSandboxMapClick : undefined}
            />
          </div>
        </div>
      </SectionCard>

      {/* 6. Elementos Base de UI (Avatares & Botões) */}
      <SectionCard
        title="6. Componentes Base de UI (Avatares, Anéis & Botões)"
        subtitle="Variações de tamanho e estilo dos componentes primitivos em src/components/ui/."
        filePath="src/components/ui/Avatar.tsx • Button.tsx"
        icon={<UsersIcon size={20} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
              Tamanhos de Avatar (sm, md, lg, xl) + Anel Gradiente + Nota
            </span>
            <div className="flex items-end gap-5 flex-wrap pt-2">
              <Avatar name="Pedro Oliveira" photoUrl={MOCK_DRIVER_USER.photo_url} size="sm" ring />
              <Avatar name="Marina Silveira" photoUrl={MOCK_PASSENGER_USER.photo_url} size="md" ring rating={4.8} />
              <Avatar name="Beatriz Almeida" photoUrl={MOCK_FEMALE_DRIVER_PUBLIC.photo_url} size="lg" ring rating={5.0} />
              <Avatar name="Carlos Eduardo" photoUrl={null} size="xl" ring />
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-border)",
            }}
          >
            <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: "var(--color-text-muted)" }}>
              Variantes de Botão (primary, secondary, ghost, danger, loading)
            </span>
            <div className="flex items-center gap-2.5 flex-wrap pt-2">
              <Button variant="primary" size="sm">Primary</Button>
              <Button variant="secondary" size="sm">Secondary</Button>
              <Button variant="ghost" size="sm">Ghost</Button>
              <Button variant="danger" size="sm">Danger</Button>
              <Button variant="primary" size="sm" loading>Loading</Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 7. Gestor de Endereços Pessoais (CEP / ViaCEP) */}
      <SectionCard
        title="7. Gestor de Endereços Salvos (Busca Automática por CEP)"
        subtitle="Componente integrado ao Meu Perfil e aos atalhos rápidos do LocationField. Experimente digitar um CEP real (ex.: 90035-191)!"
        filePath="src/components/profile/SavedAddressesManager.tsx"
        icon={<MapPinIcon size={20} />}
      >
        <SavedAddressesManager />
      </SectionCard>

      {/* ─── Active Modals Rendered on Demand ──────────────────────────────── */}

      {inspectingUser && (
        <UserProfileModal
          user={inspectingUser}
          onClose={() => setInspectingUser(null)}
        />
      )}

      {showRequestsModal && (
        <RideRequestsModal
          ride={MOCK_RIDE_STANDARD}
          mockRequests={MOCK_DRIVER_REQUESTS}
          mockConfirmedDetails={MOCK_CONFIRMED_DETAILS}
          onClose={() => setShowRequestsModal(false)}
          onChanged={() => {}}
        />
      )}

      {ratingTarget && (
        <RatingModal
          matchId={7001}
          ratedUser={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => {}}
        />
      )}

      {reportTarget && (
        <ReportUserModal
          targetUser={reportTarget}
          rideId={MOCK_RIDE_STANDARD.id}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};
