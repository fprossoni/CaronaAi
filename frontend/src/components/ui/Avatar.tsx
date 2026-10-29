import React from "react";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  rating?: number;
  ring?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getColorFromName(name?: string | null): string {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9"];
  if (!name) return colors[0];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  photoUrl,
  size = "md",
  rating,
  ring = false,
  onClick,
}) => {
  const initials = getInitials(name);
  const bg = getColorFromName(name);

  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
  }[size];

  return (
    <div
      className={[
        styles.wrapper,
        onClick ? "cursor-pointer transition-transform hover:scale-105" : "",
      ].join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`rounded-full p-[2px] ${
          ring ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500" : ""
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name ?? "Usuário"}
            className={`${sizeClasses} rounded-full object-cover block border-2`}
            style={{ borderColor: "var(--color-surface)" }}
          />
        ) : (
          <div
            className={`${sizeClasses} rounded-full flex items-center justify-center font-bold text-white select-none border-2`}
            style={{ background: bg, borderColor: "var(--color-surface)" }}
          >
            {initials}
          </div>
        )}
      </div>
      {rating !== undefined && (
        <span className={styles.badge}>★ {rating.toFixed(1)}</span>
      )}
    </div>
  );
};
