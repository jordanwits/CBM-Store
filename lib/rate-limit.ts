import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Counts one more request against `key` and says whether it is still within `max` per
 * `windowSeconds`. The counting is hit_rate_limit (migration 046), which only the service
 * role can call.
 *
 * Fails open: if the count can't be read (the migration not yet run, a database hiccup),
 * the request goes ahead as it did before there was a limit, rather than locking people
 * out of signing in or asking for access.
 */
export async function allowRequest(key: string, windowSeconds: number, max: number): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('hit_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) {
      console.error('[Rate limit] Could not check, allowing:', error.message);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error('[Rate limit] Could not check, allowing:', error);
    return true;
  }
}

/** The caller's address as the host reports it (Vercel puts the client first). */
export async function requesterIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
