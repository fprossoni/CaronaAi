import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  className = "",
  id,
  ...props
}) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="text-xs font-semibold uppercase tracking-wider text-text-muted"
          htmlFor={inputId}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-text-muted">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={[
            "w-full rounded-md border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted outline-none transition-colors duration-150 disabled:opacity-60",
            leftIcon ? "pl-10" : "",
            error
              ? "border-danger focus:ring-1 focus:ring-danger/30"
              : "border-border focus:border-primary focus:ring-1 focus:ring-primary/30",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
};
