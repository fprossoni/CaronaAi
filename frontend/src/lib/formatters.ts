/**
 * Formatting utilities for display and input masking across the frontend.
 */

import type { Gender } from "@/types/user";
import { UFRGS_CAMPUS } from "@/types/ride";

/**
 * Formats a raw phone string into (XX) XXXXXXXXX.
 * Maximum 11 digits: 2 for DDD and up to 9 for the mobile/phone number.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  return `(${ddd}) ${number}`;
}

/**
 * Normalizes a social media input:
 * - If the user inputs a full URL (http:// or https://), keeps it.
 * - If the user inputs a username handle (with or without '@'), ensures it starts with '@'.
 */
export function formatSocialHandle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const clean = trimmed.replace(/^@+/, "").trim();
  if (!clean) return "";
  return `@${clean}`;
}

/**
 * Converts a social handle or URL into an external clickable URL (defaults to Instagram).
 */
export function buildSocialUrl(socialLink: string): string {
  const trimmed = socialLink.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@+/, "");
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}

/**
 * Builds a direct WhatsApp deep link (`https://wa.me/55...`) from a formatted Brazilian phone number.
 */
export function buildWhatsAppUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const fullNumber = digits.startsWith("55") ? digits : `55${digits}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${fullNumber}${query}`;
}

/**
 * Normalizes a Brazilian license plate:
 * Removes non-alphanumeric characters, converts to uppercase, and limits to 7 chars.
 */
export function formatCarPlate(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

/**
 * Validates a Brazilian license plate:
 * - Traditional (cinza): ABC1234 (3 letters + 4 digits)
 * - Mercosul: ABC1C34 (3 letters + 1 digit + 1 letter A-J + 2 digits)
 * Pattern: ^[A-Z]{3}[0-9]([0-9]|[A-J])[0-9]{2}$
 */
export function isValidCarPlate(value: string): boolean {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return true;
  return /^[A-Z]{3}[0-9]([0-9]|[A-J])[0-9]{2}$/.test(clean);
}

/**
 * Formats distance in meters into a concise human-readable string (`850 m` or `3.4 km`).
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "0 m";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

/**
 * Formats duration in seconds into `12 min` or `1h 15min`.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "< 1 min";
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) {
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${m} min`;
}

/**
 * Returns the localized label for a Gender enum value.
 */
export function getGenderLabel(gender?: Gender | null): string {
  switch (gender) {
    case "male":
      return "Masculino";
    case "female":
      return "Feminino";
    case "other":
      return "Outro";
    case "prefer_not_to_say":
      return "Prefiro não informar";
    default:
      return "Não informado";
  }
}

/**
 * Resolves a campus ID (e.g. `campus_vale`) to its display metadata.
 */
export function getCampusInfo(campusId: string) {
  return (
    UFRGS_CAMPUS.find((c) => c.id === campusId) ?? {
      id: campusId,
      name: campusId,
      shortName: campusId,
      lat: -30.0349,
      lng: -51.2177,
    }
  );
}
