/**
 * Domain validators for Carona Aí.
 *
 * Centralizes validation rules so that forms, stores, and services share a
 * single source of truth that is easy to extend as backend requirements evolve.
 */

import { UFRGS_CAMPUS } from "@/types/ride";

/**
 * Matches any valid UFRGS institutional email address, including:
 * - Root domain: `aluno@ufrgs.br`
 * - Academic unit subdomains: `aluno@inf.ufrgs.br`, `prof@ece.ufrgs.br`, `med@hcpa.ufrgs.br`
 *
 * Rejects non-UFRGS domains and spoofed suffixes such as `user@fakeufrgs.br`.
 */
export const UFRGS_EMAIL_REGEX = /^[^\s@]+@(?:[a-zA-Z0-9-]+\.)*ufrgs\.br$/i;

/**
 * Known UFRGS academic unit subdomains mapped to human-readable badges.
 */
const KNOWN_UFRGS_UNITS: Record<string, string> = {
  inf: "INF • Instituto de Informática",
  ece: "EE • Escola de Engenharia",
  delae: "DELAE • Engenharia Elétrica",
  demec: "DEMEC • Engenharia Mecânica",
  dequi: "DEQUI • Engenharia Química",
  if: "IF • Instituto de Física",
  iq: "IQ • Instituto de Química",
  mat: "IME • Matemática e Estatística",
  famed: "FAMED • Faculdade de Medicina",
  hcpa: "HCPA • Hospital de Clínicas",
  ea: "EA • Escola de Administração",
  fce: "FCE • Ciências Econômicas",
  fabico: "FABICO • Biblioteconomia e Comunicação",
  arq: "FAU • Arquitetura e Urbanismo",
  direito: "Faculdade de Direito",
  esefid: "ESEFID • Educação Física",
  agro: "Faculdade de Agronomia",
};

/**
 * Validates whether an email belongs to the official UFRGS network
 * (`@ufrgs.br` or any subdomain `@*.ufrgs.br`).
 */
export function isValidUfrgsEmail(email: string): boolean {
  const clean = email.trim();
  if (!clean) return false;
  return UFRGS_EMAIL_REGEX.test(clean);
}

/**
 * Extracts institutional unit metadata from a UFRGS email address
 * for display in social/community profile badges (LinkedIn-style).
 */
export function extractUfrgsAffiliation(email?: string | null): {
  domain: string;
  subdomain: string | null;
  shortBadge: string;
  fullBadge: string;
} {
  if (!email || !email.includes("@")) {
    return {
      domain: "ufrgs.br",
      subdomain: null,
      shortBadge: "UFRGS",
      fullBadge: "Comunidade UFRGS",
    };
  }

  const domain = email.split("@")[1].toLowerCase().trim();
  if (domain === "ufrgs.br") {
    return {
      domain,
      subdomain: null,
      shortBadge: "UFRGS",
      fullBadge: "Verificado @ufrgs.br",
    };
  }

  const subParts = domain.replace(/\.ufrgs\.br$/i, "").split(".");
  const primarySub = subParts[subParts.length - 1];
  const unitName = KNOWN_UFRGS_UNITS[primarySub];

  return {
    domain,
    subdomain: primarySub.toUpperCase(),
    shortBadge: `${primarySub.toUpperCase()} • UFRGS`,
    fullBadge: unitName ? `${unitName} (@${domain})` : `Unidade ${primarySub.toUpperCase()} (@${domain})`,
  };
}

/**
 * Checks whether given coordinates are within ~600m of any official UFRGS campus.
 */
export function findMatchingCampus(lat: number, lng: number) {
  const THRESHOLD_DEG = 0.006; // ~600m
  return (
    UFRGS_CAMPUS.find(
      (c) => Math.abs(c.lat - lat) <= THRESHOLD_DEG && Math.abs(c.lng - lng) <= THRESHOLD_DEG
    ) ?? null
  );
}
