'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

export async function updateProfile(input: {
  fullName?: string;
}): Promise<UpdateProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'Profile updates require Supabase to be configured.' };
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  if (typeof input.fullName === 'string') {
    const trimmed = input.fullName.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Full name is too long (max 200 characters).' };
    }
    updates.full_name = trimmed.length ? trimmed : null;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No updates provided' };
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }

  revalidatePath('/profile');
  revalidatePath('/dashboard');

  return { success: true };
}
