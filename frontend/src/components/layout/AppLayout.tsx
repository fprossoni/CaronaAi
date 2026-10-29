/**
 * AppLayout Component
 *
 * Provides the responsive application shell combining:
 * - Top sticky glass header with brand identity, desktop navigation,
 *   UFRGS institutional affiliation badge (e.g. `INF • UFRGS`), and Dark/Light theme switcher.
 * - Mobile bottom navigation bar with vector icons.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { extractUfrgsAffiliation } from "@/lib/validators";
import { Avatar } from "@/components/ui/Avatar";
import {
  CarIcon,
  CompassIcon,
  HistoryIcon,
  MoonIcon,
  SearchIcon,
  ShieldCheckIcon,
  SunIcon,
  UserIcon,
} from "@/components/ui/Icons";

const AUTH_PATHS = ["/login", "/register", "/verify-email", "/profile/complete"];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p));
  const isDevRoute = location.pathname.startsWith("/dev");
  const affiliation = extractUfrgsAffiliation(user?.email);

  const navItems = [
    { path: "/find", label: "Pedir Carona", shortLabel: "Pedir", icon: SearchIcon },
    { path: "/offer", label: "Oferecer", shortLabel: "Oferecer", icon: CarIcon },
    { path: "/rides", label: "Minhas Caronas", shortLabel: "Caronas", icon: CompassIcon },
    { path: "/rides/history", label: "Histórico", shortLabel: "Histórico", icon: HistoryIcon },
    { path: "/profile", label: "Meu Perfil", shortLabel: "Perfil", icon: UserIcon },
  ];

  const isPathActive = (itemPath: string) => {
    if (itemPath === "/rides") {
      return location.pathname === "/rides";
    }
    return location.pathname.startsWith(itemPath);
  };

  if (isAuthPage || (!isAuthenticated && !isDevRoute)) {
    return (
      <div className="min-h-screen relative flex flex-col">
        {/* Floating Controls on Auth Pages */}
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border shadow-md backdrop-blur-md transition-transform hover:scale-105"
            style={{
              backgroundColor: "var(--glass-bg)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
            title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          >
            {theme === "dark" ? (
              <>
                <SunIcon size={15} className="text-amber-400" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <MoonIcon size={15} className="text-indigo-500" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>

          {import.meta.env.DEV && (
            <Link
              to="/dev"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border shadow-md backdrop-blur-md no-underline transition-transform hover:scale-105 bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
              title="Abrir Playground de Componentes (/dev)"
            >
              <span>🛠️ /dev</span>
            </Link>
          )}
        </div>
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-8">
      {/* Top Sticky Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl transition-colors"
        style={{
          backgroundColor: "var(--glass-bg)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link to="/find" className="flex items-center gap-2.5 no-underline group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105"
              style={{ background: "var(--gradient-primary)" }}
            >
              <CarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight" style={{ color: "var(--color-text)" }}>
                  Carona Aí
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  {affiliation.shortBadge}
                </span>
              </div>
              <p className="text-[11px] hidden sm:block leading-none" style={{ color: "var(--color-text-muted)" }}>
                Mobilidade Acadêmica Colaborativa
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl border" style={{ backgroundColor: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold no-underline transition-all"
                  style={{
                    backgroundColor: active ? "var(--color-primary)" : "transparent",
                    color: active ? "#ffffff" : "var(--color-text-secondary)",
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Dev Shortcut + Theme Toggle + User Pill */}
          <div className="flex items-center gap-2.5">
            {import.meta.env.DEV && (
              <Link
                to="/dev"
                className={`px-3 py-2 rounded-xl text-xs font-bold border no-underline transition-all ${
                  isDevRoute
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25"
                }`}
                title="Playground de Componentes e Estados (/dev)"
              >
                🛠️ /dev
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border transition-colors hover:border-indigo-500/50"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <SunIcon size={17} className="text-amber-400" />
              ) : (
                <MoonIcon size={17} className="text-indigo-500" />
              )}
            </button>

            {user && (
              <Link
                to="/profile"
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border no-underline transition-colors hover:border-indigo-500/50"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                }}
              >
                <Avatar name={user.name} photoUrl={user.photo_url} size="sm" ring />
                <div className="hidden sm:block text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold leading-none" style={{ color: "var(--color-text)" }}>
                      {user.name?.split(" ")[0] ?? "Estudante"}
                    </span>
                    <ShieldCheckIcon size={12} className="text-emerald-400" />
                  </div>
                  <span className="text-[10px] block truncate max-w-[110px]" style={{ color: "var(--color-text-muted)" }}>
                    {user.course ?? affiliation.domain}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl flex items-center justify-around py-1.5 px-2"
        style={{
          backgroundColor: "var(--glass-bg)",
          borderColor: "var(--color-border)",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isPathActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl no-underline transition-all"
              style={{
                color: active ? "var(--color-primary-light)" : "var(--color-text-muted)",
              }}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${
                  active ? "bg-indigo-500/15" : ""
                }`}
              >
                <Icon size={20} />
              </div>
              <span className={`text-[10px] mt-0.5 ${active ? "font-bold" : "font-medium"}`}>
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
