/** Max digits: optional leading 1 (country) + 10-digit NANP. */
export const PHONE_INPUT_MAX_DIGITS = 11;

export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * The digits a phone field keeps: 11 when the first is the country code 1, otherwise 10.
 * Capping every number at 11 let a 10-digit number pick up an 11th digit (pasting
 * "555 123 4567 ext 2", say) that the display never showed, so the field looked complete
 * while sign-in stayed disabled and the first backspace seemed to do nothing.
 */
export function limitPhoneDigits(input: string): string {
  const digits = stripPhoneDigits(input);
  return digits.slice(0, digits.startsWith('1') ? PHONE_INPUT_MAX_DIGITS : 10);
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
