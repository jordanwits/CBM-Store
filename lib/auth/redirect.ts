export const LOGIN_REDIRECT_PARAM = 'redirect' as const;

/**
 * Validates a post-login destination taken from the query string.
 *
 * Only same-origin, path-relative destinations are accepted, so a crafted
 * `?redirect=` can't bounce someone off to another site after they sign in.
 * Returns null when the value can't be trusted; callers fall back to /dashboard.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Browsers drop tabs and line breaks from a URL before reading it and treat a backslash
  // as a slash, so "/\t/evil.com" or "/\evil.com" ends up as "//evil.com". No real path here
  // contains any of them, so they are refused rather than cleaned up.
  if (/[\u0000-\u001F\u007F\\]/.test(raw)) return null;
  if (!raw.startsWith('/')) return null;
  // "//evil.com" is a protocol-relative URL, not a local path.
  if (raw.startsWith('//')) return null;
  // Whatever is left has to resolve to this site, however a browser reads it
  try {
    const base = 'https://this-site.invalid';
    if (new URL(raw, base).origin !== base) return null;
  } catch {
    return null;
  }
  // Sending login back to itself would loop.
  if (raw === '/login' || raw.startsWith('/login?')) return null;
  return raw;
}
