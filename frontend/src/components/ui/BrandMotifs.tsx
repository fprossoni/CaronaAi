import React from "react";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const MARK_SIZES = {
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-12 h-12",
} as const;

export const BrandMark: React.FC<BrandMarkProps> = ({ size = "md", className = "" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-md border border-border-strong bg-[#0b0c0d] ${MARK_SIZES[size]} ${className}`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 32 32" fill="none" className="w-[70%] h-[70%]">
      <circle cx="7.5" cy="23.5" r="2.5" fill="#F4F5F2" />
      <path
        d="M9.5 21.5L15 16H21.5L24.5 8.5"
        stroke="#FA952D"
        strokeWidth="2.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M18.5 8.5H24.5V14.5"
        stroke="#FA952D"
        strokeWidth="2.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  </span>
);

interface SeatMeterProps {
  available: number;
  total: number;
  label?: string;
  className?: string;
}

export const SeatMeter: React.FC<SeatMeterProps> = ({
  available,
  total,
  label,
  className = "",
}) => {
  const safeTotal = Math.max(1, total);
  const safeAvailable = Math.max(0, Math.min(available, safeTotal));

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      title={`${safeAvailable} de ${safeTotal} vagas livres`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: safeTotal }).map((_, idx) => {
          const isFree = idx < safeAvailable;
          return (
            <span
              key={idx}
              className={`w-1.5 h-3.5 rounded-[1px] transition-colors ${
                isFree
                  ? "bg-primary"
                  : "bg-border-strong/50"
              }`}
            />
          );
        })}
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums text-text">
        {safeAvailable}/{safeTotal}
        {label ? <span className="font-sans font-normal text-text-muted ml-1">{label}</span> : null}
      </span>
    </span>
  );
};

interface RouteTelemetryBarProps {
  items: string[];
  className?: string;
}

export const RouteTelemetryBar: React.FC<RouteTelemetryBarProps> = ({
  items,
  className = "",
}) => (
  <div
    className={`flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-text-muted ${className}`}
  >
    {items.map((item, idx) => (
      <React.Fragment key={item}>
        {idx > 0 && <span className="text-border-strong" aria-hidden="true">/</span>}
        <span>{item}</span>
      </React.Fragment>
    ))}
  </div>
);

export const KineticChevrons: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span className={`font-mono text-xs tracking-[-0.15em] opacity-80 ${className}`} aria-hidden="true">
    &gt;&gt;&gt;
  </span>
);
