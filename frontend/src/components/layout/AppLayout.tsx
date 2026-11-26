import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { extractUfrgsAffiliation } from "@/lib/validators";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/ui/BrandMotifs";

const AUTH_PATHS = ["/login", "/register", "/verify-email", "/profile/complete"];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p));
  const isTripPage = location.pathname === "/find" || location.pathname === "/offer";
  const isDevRoute = location.pathname.startsWith("/dev");
  const isPublicWithHeader = location.pathname === "/" || isDevRoute;
  const affiliation = extractUfrgsAffiliation(user?.email);

  const navItems = [
    { path: "/find", label: "Pedir" },
    { path: "/offer", label: "Oferecer" },
    { path: "/rides", label: "Caronas" },
    { path: "/messages", label: "Mensagens" },
    { path: "/rides/history", label: "Histórico" },
  ];

  const publicMobileItems = [
    { path: "/", label: "Início" },
    { path: "/find", label: "Pedir" },
    { path: "/offer", label: "Oferecer" },
    { path: "/login", label: "Entrar" },
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
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  const mobileNavList = isAuthenticated
    ? [
        { path: "/find", label: "Pedir" },
        { path: "/offer", label: "Oferecer" },
        { path: "/rides", label: "Caronas" },
        { path: "/messages", label: "Mensagens" },
        { path: "/profile", label: "Perfil" },
      ]
    : publicMobileItems;

  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-border bg-glass backdrop-blur-xl transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-15 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <BrandMark size="md" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base tracking-tight text-text">
                Carona Aí
              </span>
            </div>
          </Link>
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-1 p-1 rounded-md border border-border bg-surface-2"
          >
            {navItems.map((item) => {
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
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">

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
      <main className={`flex-1 w-full mx-auto px-4 py-6 ${isTripPage ? "max-w-[1536px] lg:px-8" : "max-w-5xl"}`}>{children}</main>
      <nav
        aria-label="Navegação mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-glass backdrop-blur-xl flex items-center justify-around py-1.5 px-2"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {mobileNavList.map((item) => {
          const active = isPathActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center min-h-11 py-2 px-2.5 rounded-md no-underline transition-colors ${
                active ? "text-accent-text" : "text-text-muted"
              }`}
            >
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
