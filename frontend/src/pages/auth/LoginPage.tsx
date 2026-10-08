import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/errors";
import styles from "./AuthPages.module.css";

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
      const { data } = await authApi.login(form);
      setTokens(data.access_token, data.refresh_token);
      await fetchUser();
      navigate("/");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erro ao fazer login. Verifique suas credenciais."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🚗</div>
        <h1 className={styles.title}>Carona Aí</h1>
        <p className={styles.subtitle}>Entre com seu e-mail da UFRGS</p>

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
