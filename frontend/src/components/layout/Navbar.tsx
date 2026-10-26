import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Icon } from "@/components/ui/Icon";
import styles from "./Navbar.module.css";

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleProtectedNavigation = (targetPath: string, message: string) => {
    if (isAuthenticated) {
      navigate(targetPath);
    } else {
      navigate("/login", {
        state: {
          returnTo: targetPath,
          message,
        },
      });
    }
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/");
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        {/* Brand Logo */}
        <Link to="/" className={styles.brand} aria-label="Carona Aí - Início">
          <div className={styles.brandIcon}>
            <Icon name="car" size={20} strokeWidth={2.2} />
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>
              Carona <span className={styles.brandAccent}>Aí</span>
            </span>
            <span className={styles.brandTag}>UFRGS</span>
          </div>
        </Link>

        {/* Center / Top Navigation Links */}
        <nav aria-label="Navegação principal">
          <ul className={styles.navLinks}>
            <li>
              <button
                type="button"
                className={[
                  styles.navLink,
                  location.pathname === "/find" ? styles.navLinkActive : "",
                ].join(" ")}
                onClick={() =>
                  handleProtectedNavigation(
                    "/find",
                    "Entre com seu e-mail institucional @ufrgs.br para pedir carona."
                  )
                }
              >
                <Icon name="search" size={17} />
                <span>Pedir carona</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Right Actions: Offer button + User profile/login dropdown */}
        <div className={styles.rightActions} ref={dropdownRef}>
          {/* Quick Offer CTA (desktop) */}
          <button
            type="button"
            className={styles.offerBtn}
            onClick={() =>
              handleProtectedNavigation(
                "/offer",
                "Entre com seu e-mail institucional @ufrgs.br para oferecer carona."
              )
            }
          >
            <Icon name="plus" size={15} strokeWidth={2.5} />
            <span>Oferecer carona</span>
          </button>

          {/* User Menu Trigger */}
          <button
            type="button"
            className={styles.userMenuTrigger}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-label="Menu do usuário"
          >
            {isAuthenticated ? (
              <>
                <div className={styles.userAvatar}>{userInitial}</div>
                <span className={styles.userName}>{user?.name?.split(" ")[0] || "Perfil"}</span>
              </>
            ) : (
              <>
                <div className={styles.userAvatar} style={{ background: "#677387" }}>
                  <Icon name="user" size={16} strokeWidth={2} />
                </div>
                <span className={styles.userName}>Entrar</span>
              </>
            )}
            <span
              className={[
                styles.chevronIcon,
                dropdownOpen ? styles.chevronOpen : "",
              ].join(" ")}
            >
              <Icon name="chevronDown" size={14} />
            </span>
          </button>

          {/* User Dropdown */}
          {dropdownOpen && (
            <div className={styles.dropdown} role="menu">
              {isAuthenticated ? (
                <>
                  <div className={styles.dropdownHeader}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#17233a" }}>
                      {user?.name || "Estudante UFRGS"}
                    </p>
                    <p className={styles.dropdownUserEmail}>{user?.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="user" size={16} />
                      <span>Meu perfil</span>
                    </div>
                    <Icon name="chevronRight" size={14} />
                  </Link>

                  <Link
                    to="/rides"
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="list" size={16} />
                      <span>Minhas caronas</span>
                    </div>
                    <Icon name="chevronRight" size={14} />
                  </Link>

                  <Link
                    to="/rides/history"
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="calendar" size={16} />
                      <span>Histórico</span>
                    </div>
                    <Icon name="chevronRight" size={14} />
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={[styles.dropdownItem, styles.dropdownItemDanger].join(" ")}
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="logout" size={16} />
                      <span>Sair da conta</span>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={[styles.dropdownItem, styles.dropdownItemPrimary].join(" ")}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="user" size={16} />
                      <span>Entre</span>
                    </div>
                    <Icon name="chevronRight" size={14} />
                  </Link>

                  <Link
                    to="/register"
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className={styles.dropdownItemContent}>
                      <Icon name="plus" size={16} />
                      <span>Cadastre-se</span>
                    </div>
                    <Icon name="chevronRight" size={14} />
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <div
                    style={{
                      padding: "8px 18px",
                      fontSize: "12px",
                      color: "var(--color-text-muted, #677387)",
                      lineHeight: "1.4",
                    }}
                  >
                    Acesso exclusivo com e-mail institucional @ufrgs.br
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
