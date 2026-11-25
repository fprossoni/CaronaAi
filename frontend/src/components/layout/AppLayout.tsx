/**
 * AppLayout Component
 *
 * Responsive application shell with top sticky header, integrated Messages nav,
 * institutional UFRGS badge, and mobile bottom navigation bar.
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { extractUfrgsAffiliation } from "@/lib/validators";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/ui/BrandMotifs";
import {
  CarIcon,
  CompassIcon,
  HistoryIcon,
  MessageIcon,
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
  const isPublicWithHeader = location.pathname === "/" || isDevRoute;
  const affiliation = extractUfrgsAffiliation(user?.email);

  const navItems = [
    { path: "/find", label: "Pedir", icon: SearchIcon },
    { path: "/offer", label: "Oferecer", icon: CarIcon },
    { path: "/rides", label: "Caronas", icon: CompassIcon },
    { path: "/messages", label: "Mensagens", icon: MessageIcon },
    { path: "/rides/history", label: "Histórico", icon: HistoryIcon },
  ];

  const publicMobileItems = [
    { path: "/", label: "Início", icon: CompassIcon },
    { path: "/find", label: "Pedir", icon: SearchIcon },
    { path: "/offer", label: "Oferecer", icon: CarIcon },
    { path: "/login", label: "Entrar", icon: UserIcon },
  ];

  const isPathActive = (itemPath: string) => {
    if (itemPath === "/" || itemPath === "/rides") {
      return location.pathname === itemPath;
    }
    return location.pathname.startsWith(itemPath);
  };

  if (isAuthPage || (!isAuthenticated && !isPublicWithHeader)) {
    return (
      <div className="min-h-screen relative flex flex-col">
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-border bg-glass text-text shadow-sm backdrop-blur-md transition-colors hover:border-border-strong"
            title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {theme === "dark" ? (
              <>
                <SunIcon size={14} className="text-accent-text" />
                <span>Claro</span>
              </>
            ) : (
              <>
                <MoonIcon size={14} className="text-text" />
                <span>Escuro</span>
              </>
            )}
          </button>

          {import.meta.env.DEV && (
            <Link
              to="/dev"
              className="inline-flex items-center px-2.5 py-1.5 rounded-md font-mono text-xs font-bold border border-primary/40 bg-primary/15 text-accent-text backdrop-blur-md no-underline transition-colors hover:bg-primary/25"
              title="Contas de teste"
            >
              Dev
            </Link>
          )}
        </div>
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  const mobileNavList = isAuthenticated
    ? [
        { path: "/find", label: "Pedir", icon: SearchIcon },
        { path: "/offer", label: "Oferecer", icon: CarIcon },
        { path: "/rides", label: "Caronas", icon: CompassIcon },
        { path: "/messages", label: "Mensagens", icon: MessageIcon },
        { path: "/profile", label: "Perfil", icon: UserIcon },
      ]
    : publicMobileItems;

  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-8">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-glass backdrop-blur-xl transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-15 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <BrandMark size="md" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base tracking-tight text-text">
                Carona Aí
              </span>
              <span className="px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold uppercase tracking-wider bg-surface-2 text-accent-text border border-border">
                {affiliation.shortBadge}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-1 p-1 rounded-md border border-border bg-surface-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold no-underline transition-colors ${
                    active
                      ? "bg-primary text-on-primary font-bold"
                      : "text-text-secondary hover:text-text hover:bg-surface-hover/50"
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {import.meta.env.DEV && (
              <Link
                to="/dev"
                state={isAuthenticated && !isDevRoute ? { returnTo: location.pathname } : undefined}
                className={`px-2.5 py-1.5 rounded-md font-mono text-xs font-bold border no-underline transition-colors ${
                  isDevRoute
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-primary/15 text-accent-text border-primary/40 hover:bg-primary/25"
                }`}
                aria-label="Contas de teste"
              >
                Dev
              </Link>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md border border-border bg-surface-2 text-text transition-colors hover:border-border-strong"
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <SunIcon size={16} className="text-accent-text" />
              ) : (
                <MoonIcon size={16} className="text-text" />
              )}
            </button>

            {isAuthenticated && user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md border border-border bg-surface-2 no-underline transition-colors hover:border-border-strong"
              >
                <Avatar name={user.name} photoUrl={user.photo_url} size="sm" />
                <div className="hidden sm:block text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold leading-none text-text">
                      {user.name?.split(" ")[0] ?? "Estudante"}
                    </span>
                    <ShieldCheckIcon size={12} className="text-secondary" />
                  </div>
                  <span className="font-mono text-[10px] block truncate max-w-28 text-text-muted mt-0.5">
                    {user.course ?? affiliation.domain}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-md text-xs font-semibold border border-border bg-surface-2 text-text no-underline transition-colors hover:border-border-strong"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-on-primary border border-primary no-underline transition-colors hover:bg-primary-light"
                >
                  Criar conta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegação mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-glass backdrop-blur-xl flex items-center justify-around py-1.5 px-2"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {mobileNavList.map((item) => {
          const Icon = item.icon;
          const active = isPathActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-md no-underline transition-colors ${
                active ? "text-accent-text" : "text-text-muted"
              }`}
            >
              <div
                className={`p-1.5 rounded-md transition-colors ${
                  active ? "bg-primary/15" : ""
                }`}
              >
                <Icon size={19} />
              </div>
              <span className={`text-[10px] mt-0.5 ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
