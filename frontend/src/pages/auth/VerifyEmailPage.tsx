import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/Button";
import styles from "./AuthPages.module.css";

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const token = digits.join("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length < 6) { setError("Digite todos os 6 dígitos."); return; }
    setError("");
    setLoading(true);
    try {
      await authApi.verifyEmail({ email, token });
      navigate("/login", { state: { verified: true } });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>📧</div>
        <h1 className={styles.title}>Verifique seu e-mail</h1>
        <p className={styles.subtitle}>
          Enviamos um código de 6 dígitos para<br />
          <strong>{email || "seu e-mail @ufrgs.br"}</strong>
        </p>

        {devToken && (
          <div style={{
            margin: "0 0 16px 0",
            padding: "8px 12px",
            borderRadius: "8px",
            backgroundColor: "#e0e7ff",
            color: "#3730a3",
            fontSize: "0.85rem",
            textAlign: "center"
          }}>
            🛠️ <strong>Modo Dev:</strong> Código preenchido automaticamente (<code>{devToken}</code>)
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.otpRow}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                className={styles.otpInput}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" fullWidth loading={loading} disabled={token.length < 6}>
            Verificar
          </Button>
        </form>

        <p className={styles.footer}>
          Não recebeu o código?{" "}
          <button
            className={styles.link}
            type="button"
            onClick={async () => {
              try { await authApi.resendVerification(); alert("Código reenviado!"); }
              catch { alert("Erro ao reenviar."); }
            }}
          >
            Reenviar
          </button>
        </p>
      </div>
    </div>
  );
};
