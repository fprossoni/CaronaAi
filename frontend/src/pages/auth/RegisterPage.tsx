import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CarIcon, ShieldCheckIcon } from "@/components/ui/Icons";
import { getErrorMessage } from "@/lib/errors";
import { extractUfrgsAffiliation, isValidUfrgsEmail } from "@/lib/validators";
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

  const isUfrgsValid = useMemo(() => isValidUfrgsEmail(form.email), [form.email]);
  const affiliation = useMemo(
    () => (isUfrgsValid ? extractUfrgsAffiliation(form.email) : null),
    [form.email, isUfrgsValid]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = form.email.trim().toLowerCase();

    if (!isValidUfrgsEmail(cleanEmail)) {
      setError(
        "Use um e-mail institucional da rede UFRGS (ex.: @ufrgs.br, @inf.ufrgs.br, @ece.ufrgs.br)."
      );
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas digitadas não coincidem.");
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
        "Conta criada!",
        "Enviamos um código de verificação para o seu e-mail institucional."
      );
      navigate("/verify-email", {
        state: {
          email: cleanEmail,
          devToken: res.data.dev_token,
        },
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro no cadastro. Verifique os dados informados."));
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-2">
            <ShieldCheckIcon size={14} /> Comunidade Exclusiva UFRGS
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-text)" }}>
            Criar conta no Carona Aí
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Aceita <code className="text-indigo-400">@ufrgs.br</code> e subdomínios de institutos como{" "}
            <code className="text-indigo-400">@inf.ufrgs.br</code>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome completo"
            type="text"
            placeholder="Ex.: Pedro Silva"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <Input
              label="E-mail institucional UFRGS"
              type="email"
              placeholder="seu.nome@ufrgs.br ou @inf.ufrgs.br"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            {affiliation && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <ShieldCheckIcon size={14} className="shrink-0" />
                <span>Vínculo reconhecido: {affiliation.fullBadge}</span>
              </div>
            )}
          </div>

          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo de 8 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita sua senha"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Continuar com e-mail UFRGS
          </Button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-text-muted)" }}>
          Já faz parte da comunidade?{" "}
          <Link to="/login" className="font-bold text-indigo-400 hover:underline">
            Entrar na conta
          </Link>
        </p>
      </div>
    </div>
  );
};
