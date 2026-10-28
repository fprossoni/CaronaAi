import React from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  rating?: number;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getColorFromName(name?: string | null): string {
  const colors = ["#2c5aa0", "#b8443b", "#3d6f8e", "#7a4e6b", "#4a6b4f", "#5a6474"];
  if (!name) return colors[0];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export const Avatar: React.FC<AvatarProps> = ({ name, photoUrl, size = "md", rating }) => {
  const initials = getInitials(name);
  const bg = getColorFromName(name);

  return (
    <div className={[styles.wrapper, styles[size]].join(" ")}>
      {photoUrl ? (
        <img src={photoUrl} alt={name ?? "User"} className={styles.img} />
      ) : (
        <div className={styles.placeholder} style={{ background: bg }}>
          {initials}
        </div>
      )}
      {rating !== undefined && (
        <span className={styles.badge}>
          <Icon name="star" size={10} fill="#d4a017" stroke="#d4a017" /> {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};
