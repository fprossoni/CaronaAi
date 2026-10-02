import React from "react";
import styles from "./Card.module.css";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick, glow }) => (
  <div
    className={[styles.card, glow ? styles.glow : "", onClick ? styles.clickable : "", className].join(" ")}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </div>
);

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardSectionProps> = ({ children, className = "" }) => (
  <div className={[styles.header, className].join(" ")}>{children}</div>
);

export const CardBody: React.FC<CardSectionProps> = ({ children, className = "" }) => (
  <div className={[styles.body, className].join(" ")}>{children}</div>
);

export const CardFooter: React.FC<CardSectionProps> = ({ children, className = "" }) => (
  <div className={[styles.footer, className].join(" ")}>{children}</div>
);
