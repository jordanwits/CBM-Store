import { stripPhoneDigits } from 'core/lib/phone-format';

/**
 * Reserved domain for phone-based logins (no Supabase Phone/SMS provider).
 * RFC 2606 — not routable; used only as auth.users email + profile.email.
 */
export const PHONE_LOGIN_EMAIL_DOMAIN = 'phone-login.invalid';

/**
 * Normalize to E.164. Accepts formatted NANP input (555) 123-4567, 10 digits, or 11 with leading 1.
 * Other 10–15 digit strings are treated as international (leading + implied).
 */
export function normalizeE164Phone(input: string): string | null {
  const digits = stripPhoneDigits(input);
  if (digits.length === 0) return null;
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

/** Deterministic synthetic email for a normalized E.164 phone (email-provider auth under the hood). */
export function syntheticEmailFromNormalizedPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return `p${digits}@${PHONE_LOGIN_EMAIL_DOMAIN}`;
}

export function isReservedPhoneLoginEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PHONE_LOGIN_EMAIL_DOMAIN}`);
}
