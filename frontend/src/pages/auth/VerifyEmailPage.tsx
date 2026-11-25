import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { KineticChevrons } from "@/components/ui/BrandMotifs";
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
      setError("Informe os 6 dígitos do código.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyEmail({ email, token });
      setTokens(res.data.access_token, res.data.refresh_token);
      const user = await fetchUser();
      toast.success("E-mail verificado");
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
      toast.info("Código reenviado", "Verifique sua caixa de entrada.");
    } catch (err: unknown) {
      toast.error("Erro ao reenviar", getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[10px] p-7 sm:p-8 border border-border-strong bg-surface bg-topo-pattern shadow-lg animate-fade-in">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-11 h-11 rounded-md bg-secondary/15 border border-secondary/30 text-secondary flex items-center justify-center mb-4">
            <ShieldCheckIcon size={22} />
          </div>
          <h1 className="font-display text-2xl font-bold text-text">
            Verificar e-mail
          </h1>
          <p className="font-mono text-xs mt-2 text-accent-text">
            {email || "seu e-mail institucional"}
          </p>
        </div>

        {devToken && (
          <div className="mb-5 p-2.5 rounded-md bg-primary/10 border border-primary/30 font-mono text-xs text-center text-text">
            DEV · Código: <strong className="text-accent-text">{devToken}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
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
                className={`w-11 h-13 rounded-md text-center font-mono text-xl font-bold border bg-surface-2 text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 ${
                  d ? "border-primary" : "border-border"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger text-center">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} disabled={token.length < 6} size="lg">
            <span>Confirmar</span>
            <KineticChevrons />
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-border text-center text-xs text-text-muted">
          Não recebeu?{" "}
          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="font-semibold text-accent-text hover:underline disabled:opacity-50"
          >
            {resending ? "Reenviando..." : "Reenviar código"}
          </button>
        </div>
      </div>
    </div>
  );
};
