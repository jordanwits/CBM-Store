'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeE164Phone } from '@/lib/auth/phone';

export async function signInWithPhonePassword(input: {
  phone: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeE164Phone(input.phone);
  if (!normalized) {
    return {
      ok: false,
      error: 'Enter a valid 10-digit US phone number (optional leading 1).',
    };
  }
  if (!input.password) {
    return { ok: false, error: 'Password is required.' };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder')) {
    return { ok: false, error: 'Sign-in is not configured.' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Phone sign-in is not available (missing service role key on server).' };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('phone', normalized)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: 'Invalid phone number or password.' };
  }

  let email = profile.email?.trim() ?? '';
  if (!email) {
    const { data: authData, error: getUserError } = await admin.auth.admin.getUserById(profile.id);
    if (getUserError || !authData.user?.email) {
      return { ok: false, error: 'Invalid phone number or password.' };
    }
    email = authData.user.email.trim();
  }

  const supabase = await createClient();
  const { error: signError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signError) {
    return { ok: false, error: signError.message };
  }

  return { ok: true };
}
