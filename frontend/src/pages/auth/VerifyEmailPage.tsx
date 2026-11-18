import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { ShieldCheckIcon } from "@/components/ui/Icons";
import { getErrorMessage } from "@/lib/errors";

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastStore();
  const { setTokens, fetchUser } = useAuthStore();
  const state = location.state as { email?: string; devToken?: string } | null;
  const email = state?.email ?? "";
  const devToken = state?.devToken ?? "";

  const [digits, setDigits] = useState<string[]>(() => {
    if (devToken && devToken.length === 6) {
      return devToken.split("");
    }
    return ["", "", "", "", "", ""];
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setDigits(pasted.split(""));
    }
  };

  const token = digits.join("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length < 6) {
      setError("Digite todos os 6 dígitos do código.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyEmail({ email, token });
      setTokens(res.data.access_token, res.data.refresh_token);
      const user = await fetchUser();
      toast.success("E-mail verificado com sucesso!");
      navigate(user && !user.profile_complete ? "/profile/complete" : "/find");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Código inválido ou expirado."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.info("Novo código enviado!", "Verifique sua caixa de entrada e spam.");
    } catch (err: unknown) {
      toast.error("Não foi possível reenviar o código", getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl p-8 sm:p-10 border border-border bg-gradient-card shadow-lg animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
            <ShieldCheckIcon size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text">
            Confirme seu vínculo UFRGS
          </h1>
          <p className="text-xs sm:text-sm mt-2 leading-relaxed text-text-muted">
            Enviamos um código de 6 dígitos para
            <br />
            <strong className="text-indigo-400">{email || "seu e-mail institucional"}</strong>
          </p>
        </div>

        {devToken && (
          <div className="mb-6 p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-xs text-center text-text">
            🛠️ <strong>Ambiente de Desenvolvimento:</strong> Código preenchido automaticamente (
            <code className="font-mono font-bold text-indigo-400">{devToken}</code>)
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-center gap-2.5" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className={`w-12 h-14 rounded-2xl text-center text-xl font-extrabold border bg-surface-2 text-text outline-none transition-all focus:ring-2 focus:ring-indigo-500 ${
                  d ? "border-primary" : "border-border"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400 text-center">
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" fullWidth loading={loading} disabled={token.length < 6} size="lg">
              Confirmar Código
            </Button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-text-muted">
          Não recebeu o código?{" "}
          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="font-bold text-indigo-400 hover:underline disabled:opacity-50"
          >
            {resending ? "Reenviando..." : "Reenviar código"}
          </button>
        </div>
      </div>
    </div>
  );
};
