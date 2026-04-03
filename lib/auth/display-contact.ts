import { formatStoredPhoneForDisplay } from 'core/lib/phone-format';

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
