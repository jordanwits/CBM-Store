import { formatStoredPhoneForDisplay } from 'core/lib/phone-format';
import { isReservedPhoneLoginEmail } from '@/lib/auth/phone';

/** Prefer real email; otherwise format +1 E.164 phone for tables and labels. */
export function displayProfileContact(
  email: string | null | undefined,
  phone: string | null | undefined
): string {
  const e = email?.trim();
  if (e) return e;
  const p = phone?.trim();
  if (p) return formatStoredPhoneForDisplay(p);
  return '—';
}

/** Prefer full name; fall back to email or formatted phone for labels. */
export function displayProfileName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  phone: string | null | undefined
): string {
  const n = fullName?.trim();
  if (n) return n;
  return displayProfileContact(email, phone);
}

/**
 * What to call the signed-in user in the header: their email, or for a phone account their
 * number. A phone account signs in through a reserved placeholder address
 * (p15551234567@phone-login.invalid) that was being shown to the user as if it were theirs.
 */
export function signedInLabel(
  email: string | null | undefined,
  phoneE164: string | null | undefined
): string {
  const e = email?.trim() ?? '';
  if (e && !isReservedPhoneLoginEmail(e)) return e;
  // The placeholder carries the number itself, should the metadata be missing
  const phone = phoneE164?.trim() || (e ? `+${e.slice(1, e.indexOf('@'))}` : '');
  return phone ? formatStoredPhoneForDisplay(phone) : '';
}
