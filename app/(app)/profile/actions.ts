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
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): Promise<UpdateProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'Profile updates require Supabase to be configured.' };
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  const updates: Record<string, any> = {};

  if (typeof input.fullName === 'string') {
    const trimmed = input.fullName.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Full name is too long (max 200 characters).' };
    }
    updates.full_name = trimmed.length ? trimmed : null;
  }

  if (typeof input.addressLine1 === 'string') {
    const trimmed = input.addressLine1.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Address line 1 is too long (max 200 characters).' };
    }
    updates.address_line1 = trimmed.length ? trimmed : null;
  }

  if (typeof input.addressLine2 === 'string') {
    const trimmed = input.addressLine2.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Address line 2 is too long (max 200 characters).' };
    }
    updates.address_line2 = trimmed.length ? trimmed : null;
  }

  if (typeof input.city === 'string') {
    const trimmed = input.city.trim();
    if (trimmed.length > 100) {
      return { success: false, error: 'City is too long (max 100 characters).' };
    }
    updates.city = trimmed.length ? trimmed : null;
  }

  if (typeof input.state === 'string') {
    const trimmed = input.state.trim();
    if (trimmed.length > 100) {
      return { success: false, error: 'State is too long (max 100 characters).' };
    }
    updates.state = trimmed.length ? trimmed : null;
  }

  if (typeof input.zip === 'string') {
    const trimmed = input.zip.trim();
    if (trimmed.length > 20) {
      return { success: false, error: 'ZIP code is too long (max 20 characters).' };
    }
    updates.zip = trimmed.length ? trimmed : null;
  }

  if (typeof input.country === 'string') {
    const trimmed = input.country.trim();
    if (trimmed.length > 100) {
      return { success: false, error: 'Country is too long (max 100 characters).' };
    }
    updates.country = trimmed.length ? trimmed : null;
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
  revalidatePath('/checkout');

  return { success: true };
}
