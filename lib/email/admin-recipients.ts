import { createAdminClient } from '@/lib/supabase/admin';
import { deliverableEmail, getAdminEmails } from './resend';

/**
 * Distinct admin inboxes: `ADMIN_NOTIFICATION_EMAILS` plus every active admin profile with a
 * real email. An admin who signs in by phone has only a placeholder address, so is skipped.
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
      const e = deliverableEmail(typeof row.email === 'string' ? row.email : null);
      if (e) normalized.add(e.toLowerCase());
    }
  } catch (e) {
    console.warn('[admin-recipients] Could not load admin emails from database:', e);
  }
  return [...normalized];
}
