import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/api/auth";
import { BrandMark, KineticChevrons } from "@/components/ui/BrandMotifs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";

export const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);

  const requestCode = async () => {
    const { data } = await authApi.forgotPassword(email.trim().toLowerCase());
    setEmail(email.trim().toLowerCase());
    setDevToken(data.dev_token ?? "");
    setToken(data.dev_token ?? "");
    setMessage(data.dev_token ? "Modo de desenvolvimento: envio de e-mail simulado." : data.message);
    setResendAt(Date.now() + 60_000);
    setStep("reset");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (step === "email") {
        await requestCode();
      } else {
        if (password !== confirmation) {
          setError("As senhas não coincidem.");
          return;
        }
        await authApi.resetPassword({ email, token, password });
        setDevToken("");
        setToken("");
        setPassword("");
        setConfirmation("");
        setStep("done");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Não foi possível recuperar sua senha."));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    if (Date.now() < resendAt) {
      setError("Aguarde um minuto entre os envios de código.");
      return;
    }
    setLoading(true);
    try {
      await requestCode();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Não foi possível reenviar o código."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[10px] p-7 sm:p-8 border border-border-strong bg-surface bg-topo-pattern shadow-lg animate-fade-in">
        <Link to="/" className="no-underline inline-flex items-center gap-2.5 mb-6">
          <BrandMark size="md" />
          <span className="font-display font-bold text-base text-text">Carona Aí</span>
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text mb-3">
          {step === "done" ? "Senha atualizada" : "Recuperar senha"}
        </h1>
        {step === "done" ? (
          <p role="status" className="text-sm text-text-secondary">Sua senha foi alterada. Entre com a nova senha para continuar.</p>
        ) : (
          <>
            <p className="text-sm text-text-secondary mb-6">
              {step === "email" ? "Informe o e-mail da sua conta para receber um código de recuperação." : "Informe o código recebido e escolha sua nova senha."}
            </p>
            {message && <p role="status" className="text-xs text-text-secondary mb-4">{message}</p>}
            {devToken && (
              <div className="mb-5 p-2.5 rounded-md bg-primary/10 border border-primary/30 font-mono text-xs text-center text-text">
                DEV · Código: <strong className="text-accent-text">{devToken}</strong>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <Input label="E-mail institucional" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={step === "reset"} />
              {step === "reset" && (
                <>
                  <Input label="Código de recuperação" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} required />
                  <Input label="Nova senha" type="password" autoComplete="new-password" minLength={8} placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Input label="Confirmar nova senha" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
                </>
              )}
              {error && <div role="alert" className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">{error}</div>}
              <Button type="submit" fullWidth loading={loading} size="lg">
                <span>{step === "email" ? "Enviar código" : "Atualizar senha"}</span>
                <KineticChevrons />
              </Button>
            </form>
            {step === "reset" && (
              <div className="mt-5 flex justify-between text-xs text-accent-text">
                <button type="button" disabled={loading} onClick={resend} className="hover:underline disabled:opacity-50">Reenviar código</button>
                <button type="button" disabled={loading} onClick={() => { setStep("email"); setError(""); setMessage(""); setDevToken(""); setToken(""); }} className="hover:underline disabled:opacity-50">Alterar e-mail</button>
              </div>
            )}
          </>
        )}
        <div className="mt-6 pt-5 border-t border-border text-xs">
          <Link to="/login" className="font-semibold text-accent-text hover:underline no-underline">← Voltar para entrar</Link>
        </div>
      </div>
    </div>
  );
};
