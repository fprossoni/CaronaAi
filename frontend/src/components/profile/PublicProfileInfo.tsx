import React from "react";
import type { UserPublic } from "@/types/user";
import { Icon, type IconName } from "@/components/ui/Icon";
import styles from "./PublicProfileInfo.module.css";

interface PublicProfileInfoProps {
  user: UserPublic;
  /** Compact = single row of chips (lists); full = labelled grid (modals). */
  variant?: "compact" | "full";
}

function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** Public info shown to the other side of a potential match:
 *  email, course, age, instagram and phone. */
export const PublicProfileInfo: React.FC<PublicProfileInfoProps> = ({ user, variant = "compact" }) => {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const items: { key: string; icon: IconName; label: string; value: React.ReactNode }[] = [];

  if (user.age != null) {
    items.push({ key: "age", icon: "cake", label: "Idade", value: `${user.age} anos` });
  }
  if (user.course) {
    items.push({ key: "course", icon: "book", label: "Curso", value: user.course });
  }
  items.push({
    key: "email",
    icon: "mail",
    label: "E-mail",
    value: (
      <a href={`mailto:${user.email}`} onClick={stop} className={styles.link}>
        {user.email}
      </a>
    ),
  });
  if (user.instagram) {
    items.push({
      key: "instagram",
      icon: "instagram",
      label: "Instagram",
      value: (
        <a href={instagramUrl(user.instagram)} target="_blank" rel="noreferrer" onClick={stop} className={styles.link}>
          {user.instagram}
        </a>
      ),
    });
  }
  if (user.phone) {
    items.push({
      key: "phone",
      icon: "phone",
      label: "Telefone",
      value: (
        <a href={whatsappUrl(user.phone)} target="_blank" rel="noreferrer" onClick={stop} className={styles.link}>
          {user.phone}
        </a>
      ),
    });
  }

  if (variant === "full") {
    return (
      <dl className={styles.grid}>
        {items.map((it) => (
          <div key={it.key} className={styles.gridItem}>
            <dt className={styles.gridLabel}>
              <Icon name={it.icon} size={12} /> {it.label}
            </dt>
            <dd className={styles.gridValue}>{it.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <ul className={styles.chips}>
      {items
        .filter((it) => it.key !== "course")
        .map((it) => (
          <li key={it.key} className={styles.chip} title={it.label}>
            <Icon name={it.icon} size={13} />
            <span className={styles.chipValue}>{it.value}</span>
          </li>
        ))}
    </ul>
  );
};
