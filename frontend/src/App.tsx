import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { AppLayout } from "@/components/layout/AppLayout";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { FindRidePage } from "@/pages/FindRidePage";
import { OfferRidePage } from "@/pages/OfferRidePage";
import { MyRidesPage } from "@/pages/MyRidesPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileCompletePage } from "@/pages/ProfileCompletePage";
import { DevPlaygroundPage } from "@/pages/DevPlaygroundPage";
import "./index.css";

// ─── Protected Route Guard ───────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user && !user.profile_complete && location.pathname !== "/profile/complete") {
    return <Navigate to="/profile/complete" replace />;
  }

  return <>{children}</>;
};

// ─── Application Root ────────────────────────────────────────────────────────
export default function App() {
  const { fetchUser, isAuthenticated } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (isAuthenticated) fetchUser();
  }, [fetchUser, isAuthenticated]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <AppLayout>
        <Routes>
          {/* Developer Playground (Active in Development Mode) */}
          {import.meta.env.DEV && <Route path="/dev" element={<DevPlaygroundPage />} />}

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected Application Routes */}
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
      </AppLayout>
    </BrowserRouter>
  );
}
