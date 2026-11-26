import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { BrandMark, KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { getErrorMessage } from "@/lib/errors";
import { isValidUfrgsEmail } from "@/lib/validators";
import { useToastStore } from "@/store/toastStore";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = form.email.trim().toLowerCase();

    if (!isValidUfrgsEmail(cleanEmail)) {
      setError("Use um e-mail institucional UFRGS (@ufrgs.br ou @*.ufrgs.br).");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: cleanEmail,
        password: form.password,
      });
      toast.success(
        "Conta criada",
        res.data.dev_token
          ? "Modo de desenvolvimento: código disponível na próxima tela, sem envio de e-mail."
          : "Enviamos um código de verificação para seu e-mail UFRGS."
      );
      navigate("/verify-email", {
        state: {
          email: cleanEmail,
          devToken: res.data.dev_token,
        },
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro no cadastro. Verifique os dados."));
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
               UFRGS
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-text pt-1">
            Criar conta
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome completo"
            type="text"
            placeholder="Pedro Silva"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="space-y-2">
            <Input
              label="E-mail institucional"
              type="email"
              placeholder="nome@ufrgs.br ou @inf.ufrgs.br"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />

          {error && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" fullWidth loading={loading} size="lg">
              <span>Continuar</span>
              <KineticChevrons />
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-2 text-xs text-text-muted">
          <Link to="/" className="font-medium text-text-secondary hover:text-text no-underline">
            ← Início
          </Link>
          <Link to="/login" className="font-semibold text-accent-text hover:underline no-underline">
            Já tenho conta →
          </Link>
        </div>
      </div>
    </div>
  );
};
