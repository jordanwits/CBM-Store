import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminEmails } from './resend';

/**
 * Distinct admin inboxes: `ADMIN_NOTIFICATION_EMAILS` plus every active admin profile with a non-empty email.
 */
export async function getAdminRecipientEmails(): Promise<string[]> {
  const normalized = new Set<string>();
  for (const e of getAdminEmails()) {
    const t = e.trim().toLowerCase();
    if (t) normalized.add(t);
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('active', true);
    if (error) {
      console.warn('[admin-recipients] profiles query:', error.message);
      return [...normalized];
    }
    for (const row of data ?? []) {
      const e = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      if (e) normalized.add(e);
    }
  } catch (e) {
    console.warn('[admin-recipients] Could not load admin emails from database:', e);
  }
  return [...normalized];
}
