/** Max digits: optional leading 1 (country) + 10-digit NANP. */
export const PHONE_INPUT_MAX_DIGITS = 11;

export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * US-style display as the user types: (555) 123-4567.
 * Accepts up to 11 digits; leading 1 is treated as +1 country code and not shown in the grouped part.
 */
export function formatPhoneFieldDisplay(digitsOnly: string): string {
  let d = stripPhoneDigits(digitsOnly).slice(0, PHONE_INPUT_MAX_DIGITS);
  if (d.length === 0) return '';
  if (d.length === 11 && d.startsWith('1')) {
    d = d.slice(1);
  }
  d = d.slice(0, 10);
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** True when digits form a full US number (10 digits, or 11 with leading country code 1). */
export function isCompleteNanpDigits(digits: string): boolean {
  const d = stripPhoneDigits(digits);
  return d.length === 10 || (d.length === 11 && d.startsWith('1'));
}

/** Pretty-print stored E.164 when it is a US +1 number; otherwise return the original string. */
export function formatStoredPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164?.trim()) return '';
  const d = stripPhoneDigits(e164);
  if (d.length === 11 && d.startsWith('1')) {
    return formatPhoneFieldDisplay(d);
  }
  return e164.trim();
}
