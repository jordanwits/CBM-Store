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
  if (!raw.startsWith('/')) return null;
  // "//evil.com" and "/\evil.com" are protocol-relative URLs, not local paths.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Sending login back to itself would loop.
  if (raw === '/login' || raw.startsWith('/login?')) return null;
  return raw;
}
