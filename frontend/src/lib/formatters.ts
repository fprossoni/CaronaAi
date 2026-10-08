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
