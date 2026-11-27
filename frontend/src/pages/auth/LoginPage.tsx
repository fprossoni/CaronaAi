import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { BrandMark, KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { getErrorMessage } from "@/lib/errors";

interface LoginLocationState {
  returnTo?: string;
  message?: string;
  prefill?: unknown;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as LoginLocationState | null) ?? null;

  const { setTokens, fetchUser } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setTokens(data.access_token, data.refresh_token);
      const user = await fetchUser();
      if (user && !user.profile_complete) {
        navigate("/profile/complete", {
          state: { returnTo: navState?.returnTo, prefill: navState?.prefill },
        });
      } else {
        navigate(navState?.returnTo || "/find", {
          state: navState?.prefill,
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Credenciais inválidas."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[10px] p-7 sm:p-8 border border-border-strong bg-surface bg-topo-pattern shadow-lg animate-fade-in">
        <div className="flex flex-col items-start mb-7 space-y-3">
          <div className="flex items-center justify-between w-full">
            <Link to="/" className="no-underline inline-flex items-center gap-2.5">
              <BrandMark size="md" />
              <span className="font-display font-bold text-base text-text">Carona Aí</span>
            </Link>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-semibold uppercase tracking-wider bg-surface-2 text-accent-text border border-border">
               @ufrgs.br
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-text pt-1">
            Entrar
          </h1>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail institucional"
            type="email"
            placeholder="nome@ufrgs.br"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <Link
            to="/forgot-password"
            className="block text-right text-xs font-semibold text-accent-text hover:underline"
          >
            Esqueci minha senha
          </Link>

          {error && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" fullWidth loading={loading} size="lg">
              <span>Entrar</span>
              <KineticChevrons />
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-2 text-xs text-text-muted">
          <Link to="/" className="font-medium text-text-secondary hover:text-text no-underline">
            ← Início
          </Link>
          <Link to="/register" className="font-semibold text-accent-text hover:underline no-underline">
            Criar conta →
          </Link>
        </div>
      </div>
    </div>
  );
};
