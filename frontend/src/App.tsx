import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Navbar } from "@/components/layout/Navbar";
import { HomePage } from "@/pages/HomePage";
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

// ─── Protected Route Wrapper ──────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          returnTo: location.pathname,
          message: "Faça login com seu e-mail institucional @ufrgs.br para acessar esta funcionalidade.",
        }}
      />
    );
  }

  if (user && !user.profile_complete && location.pathname !== "/profile/complete") {
    return <Navigate to="/profile/complete" replace />;
  }

  return <>{children}</>;
};

// ─── App Panel Shell (aplicativo projetado sobre o site) ──────────────────────
const AppPanelShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-stage">
      <div className="app-panel">
        <div className="app-panel__body">{children}</div>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { fetchUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchUser();
  }, [fetchUser, isAuthenticated]);

  return (
    <BrowserRouter>
      {/* Top Navbar present across all screens */}
      <Navbar />

      <main style={{ minHeight: "calc(100vh - var(--header-height, 68px))" }}>
        <Routes>
          {/* Public Home Page (BlaBlaCar style landing page) */}
          <Route path="/" element={<HomePage />} />

          {/* Auth Pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected Application Views (rendered inside projected AppPanelShell) */}
          <Route
            path="/find"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <FindRidePage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/offer"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <OfferRidePage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rides"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <MyRidesPage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rides/history"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <HistoryPage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <ProfilePage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/complete"
            element={
              <ProtectedRoute>
                <AppPanelShell>
                  <ProfileCompletePage />
                </AppPanelShell>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
