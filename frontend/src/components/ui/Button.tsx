import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-on-primary font-bold border border-primary enabled:hover:bg-primary-light shadow-sm",
  secondary:
    "bg-surface-2 text-text border border-border enabled:hover:border-border-strong enabled:hover:bg-surface-hover",
  ghost:
    "bg-transparent text-text-secondary enabled:hover:text-text enabled:hover:bg-surface-2",
  danger:
    "bg-danger/15 text-danger border border-danger/40 enabled:hover:bg-danger enabled:hover:text-white",
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
        "inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors duration-150 whitespace-nowrap tracking-[0.01em] disabled:opacity-45 disabled:cursor-not-allowed",
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
          className="size-3.5 rounded-full border-2 border-current/25 border-t-current animate-spin"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
};
