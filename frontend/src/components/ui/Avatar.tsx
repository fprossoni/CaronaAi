import React from "react";

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
  const colors = ["#1f2329", "#282d35", "#323842", "#22262c", "#3a4049", "#171a1f"];
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
    sm: "w-8 h-8 text-[11px]",
    md: "w-11 h-11 text-xs",
    lg: "w-16 h-16 text-base",
    xl: "w-24 h-24 text-xl",
  }[size];

  return (
    <div
      className={`relative shrink-0 ${
        onClick ? "cursor-pointer transition-opacity hover:opacity-90" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`rounded-md overflow-hidden border ${
          ring ? "border-primary/70" : "border-border-strong"
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name ?? "Usuário"}
            className={`${sizeClasses} rounded-[5px] object-cover block`}
          />
        ) : (
          <div
            className={`${sizeClasses} rounded-[5px] flex items-center justify-center font-mono font-bold text-[#f4f5f2] select-none`}
            style={{ backgroundColor: bg }}
          >
            {initials}
          </div>
        )}
      </div>
      {rating !== undefined && (
        <span className="absolute -bottom-1.5 -right-1.5 rounded-[2px] border border-border-strong bg-surface px-1 py-px font-mono text-[10px] font-bold leading-none whitespace-nowrap text-text">
          ★ {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};
