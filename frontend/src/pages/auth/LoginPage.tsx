import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { getErrorMessage } from "@/lib/errors";
import styles from "./AuthPages.module.css";

import { useLocation } from "react-router-dom";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { returnTo?: string; message?: string; prefill?: unknown } | null;
  const notice = state?.message;
  const returnTo = state?.returnTo;

  const { setTokens, fetchUser } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      setTokens(data.access_token, data.refresh_token);
      const user = await fetchUser();
      if (user && !user.profile_complete) {
        navigate("/profile/complete");
      } else if (returnTo) {
        navigate(returnTo, { state: state?.prefill });
      } else {
        navigate("/find");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao fazer login. Verifique suas credenciais."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Icon name="car" size={36} />
        </div>
        <h1 className={styles.title}>Carona Aí</h1>
        <p className={styles.subtitle}>Entre com seu e-mail da UFRGS</p>

        {notice && (
          <div
            style={{
              margin: "0 0 16px 0",
              padding: "10px 14px",
              borderRadius: "8px",
              backgroundColor: "#f0f4fa",
              color: "var(--color-primary, #2c5aa0)",
              fontSize: "0.85rem",
              lineHeight: "1.4",
              textAlign: "center",
              border: "1px solid #dce4f0",
            }}
          >
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="E-mail institucional"
            type="email"
            placeholder="seu.nome@ufrgs.br"
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

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" fullWidth loading={loading}>
            Entrar
          </Button>
        </form>

        <p className={styles.footer}>
          Não tem conta?{" "}
          <Link to="/register">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
};
