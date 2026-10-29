/**
 * Centralized SVG Icon System
 *
 * Crisp vector icons used across mobility (Uber/BlaBlaCar) and social
 * (Instagram/LinkedIn) UI elements without adding external icon bundle weight.
 */

import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const BaseSvg: React.FC<IconProps> = ({ size = 20, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const CarIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </BaseSvg>
);

export const SearchIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </BaseSvg>
);

export const CompassIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </BaseSvg>
);

export const MapPinIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </BaseSvg>
);

export const NavigationIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </BaseSvg>
);

export const CrosshairIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="22" x2="18" y1="12" y2="12" />
    <line x1="6" x2="2" y1="12" y2="12" />
    <line x1="12" x2="12" y1="6" y2="2" />
    <line x1="12" x2="12" y1="22" y2="18" />
  </BaseSvg>
);

export const ClockIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </BaseSvg>
);

export const UsersIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </BaseSvg>
);

export const UserIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </BaseSvg>
);

export const StarIcon: React.FC<IconProps & { filled?: boolean }> = ({
  filled = false,
  ...props
}) => (
  <BaseSvg {...props} fill={filled ? "currentColor" : "none"}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </BaseSvg>
);

export const ShieldCheckIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </BaseSvg>
);

export const SunIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </BaseSvg>
);

export const MoonIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </BaseSvg>
);

export const GraduationCapIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </BaseSvg>
);

export const WhatsAppIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </BaseSvg>
);

export const InstagramIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </BaseSvg>
);

export const HistoryIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </BaseSvg>
);

export const FilterIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </BaseSvg>
);

export const CheckCircleIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </BaseSvg>
);

export const AlertTriangleIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </BaseSvg>
);

export const BanIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </BaseSvg>
);

export const EditIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </BaseSvg>
);

export const LogOutIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </BaseSvg>
);

export const XIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </BaseSvg>
);

export const ArrowRightLeftIcon: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </BaseSvg>
);
