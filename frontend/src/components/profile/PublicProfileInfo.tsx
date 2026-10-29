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

const GENDER_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  other: "Outro",
  prefer_not_to_say: "Prefiro não dizer",
};

/** Public info shown to the other side of a potential match:
 *  course, gender, age, and optional instagram.
 *  Email and phone are private and shown only after acceptance. */
export const PublicProfileInfo: React.FC<PublicProfileInfoProps> = ({ user, variant = "compact" }) => {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const items: { key: string; icon: IconName; label: string; value: React.ReactNode }[] = [];

  if (user.course) {
    items.push({ key: "course", icon: "book", label: "Curso", value: user.course });
  }

  if (user.gender) {
    items.push({
      key: "gender",
      icon: "user",
      label: "Gênero",
      value: GENDER_LABELS[user.gender] || user.gender,
    });
  }

  if (user.age != null) {
    items.push({ key: "age", icon: "cake", label: "Idade", value: `${user.age} anos` });
  }

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
      {items.map((it) => (
        <li key={it.key} className={styles.chip} title={it.label}>
          <Icon name={it.icon} size={13} />
          <span className={styles.chipValue}>{it.value}</span>
        </li>
      ))}
    </ul>
  );
};
