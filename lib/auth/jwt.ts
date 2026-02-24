/**
 * Minimal JWT helpers (server-only).
 *
 * We intentionally avoid using `session.user` from `supabase.auth.getSession()` on the server
 * to prevent Supabase Auth SDK warning spam and to avoid an extra network roundtrip to `getUser()`.
 *
 * NOTE: This does NOT verify JWT signatures. Only use the decoded `sub` as a convenience
 * identifier alongside Supabase RLS-enforced queries.
 */
export function getJwtSubject(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    const payload = parts[1];
    if (!payload) return null;

    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const data = JSON.parse(json) as { sub?: unknown };

    return typeof data.sub === 'string' ? data.sub : null;
  } catch {
    return null;
  }
}

