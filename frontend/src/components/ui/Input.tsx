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
          className="text-[13px] font-medium tracking-[0.02em] text-text-muted"
          htmlFor={inputId}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 flex items-center text-text-muted">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={[
            "w-full rounded-xl border bg-surface-2 px-4 py-3 text-[15px] text-text placeholder:text-text-muted outline-none transition-all duration-150 disabled:opacity-60",
            leftIcon ? "pl-10.5" : "",
            error
              ? "border-danger focus:ring-3 focus:ring-red-500/20"
              : "border-border focus:border-primary focus:ring-3 focus:ring-indigo-500/20",
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
