import React from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import styles from "./ProfilePage.module.css";

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Meu Perfil</h2>
      
      <div className={styles.card}>
        <div className={styles.avatar}>
          {user?.name?.charAt(0).toUpperCase() || "?"}
        </div>
        
        <div className={styles.infoGroup}>
          <label>Nome</label>
          <div className={styles.value}>{user.name}</div>
        </div>

        <div className={styles.infoGroup}>
          <label>Email Institucional</label>
          <div className={styles.value}>{user.email}</div>
        </div>

        <div className={styles.infoGroup}>
          <label>Telefone</label>
          <div className={styles.value}>{user.phone || "Não informado"}</div>
        </div>

        <div className={styles.stats}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>⭐ {user.avg_rating.toFixed(1)}</span>
            <span className={styles.statLabel}>Avaliação</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{user.rating_count}</span>
            <span className={styles.statLabel}>Corridas Totais</span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" fullWidth onClick={() => alert("Em breve...")}>
            Editar Perfil
          </Button>
          <Button variant="danger" fullWidth onClick={logout}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};
