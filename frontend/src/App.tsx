import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { FindRidePage } from "@/pages/FindRidePage";
import { OfferRidePage } from "@/pages/OfferRidePage";
import { MyRidesPage } from "@/pages/MyRidesPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileCompletePage } from "@/pages/ProfileCompletePage";
import "./index.css";

// ─── Protected Route ─────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user && !user.profile_complete && location.pathname !== "/profile/complete") {
    return <Navigate to="/profile/complete" replace />;
  }

  return <>{children}</>;
};

// ─── Bottom Navigation ────────────────────────────────────────────────────────
const BottomNav: React.FC = () => {
  const location = useLocation();
  const authPaths = ["/login", "/register", "/verify-email", "/profile/complete"];
  if (authPaths.some((p) => location.pathname.startsWith(p))) return null;

  const items = [
    { path: "/offer", label: "Oferecer", icon: "🚗" },
    { path: "/find", label: "Pedir", icon: "🔍" },
    { path: "/rides", label: "Caronas", icon: "📋" },
    { path: "/profile", label: "Perfil", icon: "👤" },
  ];

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--color-surface)",
      borderTop: "1px solid var(--color-border)",
      display: "flex",
      zIndex: 100,
    }}>
      {items.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 4px",
            textDecoration: "none",
            color: location.pathname.startsWith(item.path) ? "var(--color-primary-light)" : "var(--color-text-muted)",
            fontSize: "11px",
            gap: "2px",
            fontWeight: location.pathname.startsWith(item.path) ? 600 : 400,
            transition: "color 0.15s ease",
          }}
        >
          <span style={{ fontSize: "22px" }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
};


// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { fetchUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchUser();
  }, [fetchUser, isAuthenticated]);

  return (
    <BrowserRouter>
      <div style={{ paddingBottom: "64px", minHeight: "100vh" }}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/find" replace /></ProtectedRoute>} />
          <Route path="/find" element={<ProtectedRoute><FindRidePage /></ProtectedRoute>} />
          <Route path="/offer" element={<ProtectedRoute><OfferRidePage /></ProtectedRoute>} />
          <Route path="/rides" element={<ProtectedRoute><MyRidesPage /></ProtectedRoute>} />
          <Route path="/rides/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/profile/complete" element={<ProtectedRoute><ProfileCompletePage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  );
}
