import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-[15px]",
  lg: "px-8 py-4 text-base",
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-primary text-white shadow-[0_4px_15px_rgba(99,102,241,0.4)] enabled:hover:-translate-y-px enabled:hover:shadow-[0_6px_20px_rgba(99,102,241,0.55)]",
  secondary:
    "bg-surface-2 text-text border border-border enabled:hover:bg-surface-hover",
  ghost:
    "bg-transparent text-primary-light enabled:hover:bg-indigo-500/10",
  danger:
    "bg-danger text-white shadow-[0_4px_15px_rgba(239,68,68,0.3)] enabled:hover:-translate-y-px enabled:hover:shadow-[0_6px_20px_rgba(239,68,68,0.45)]",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}) => {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-150 whitespace-nowrap tracking-[0.01em] disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        loading ? "cursor-wait" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
};
