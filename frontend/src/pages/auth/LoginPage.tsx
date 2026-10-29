import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CarIcon, ShieldCheckIcon } from "@/components/ui/Icons";
import { getErrorMessage } from "@/lib/errors";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
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
      navigate(user && !user.profile_complete ? "/profile/complete" : "/find");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao fazer login. Verifique suas credenciais."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-3xl p-8 border shadow-2xl animate-fade-in"
        style={{
          background: "var(--gradient-card)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg mb-3"
            style={{ background: "var(--gradient-primary)" }}
          >
            <CarIcon size={28} />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mb-2">
            <ShieldCheckIcon size={14} /> Rede Universitária Verificada
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Carona Aí
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Compartilhe rotas com colegas dos campi da UFRGS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail institucional"
            type="email"
            placeholder="seu.nome@ufrgs.br ou @inf.ufrgs.br"
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

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Entrar
          </Button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-text-muted)" }}>
          Ainda não tem conta?{" "}
          <Link to="/register" className="font-bold text-indigo-400 hover:underline">
            Cadastre-se com seu e-mail UFRGS
          </Link>
        </p>
      </div>
    </div>
  );
};
