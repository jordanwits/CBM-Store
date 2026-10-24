'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MUST_CHANGE_PASSWORD_META_KEY, userMustChangePassword } from '@/lib/auth/must-change-password';

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Sets the signed-in user's new password, then lifts the must-change-password flag.
 *
 * The flag is in app_metadata, which only the service role can write, and it comes off here
 * and only after the new password has been accepted. Supabase refuses a "new" password equal
 * to the current one, so keeping the temporary password the admin saw is no longer possible.
 */
export async function changePassword(password: string): Promise<ChangePasswordResult> {
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Your session has expired. Open the link again or sign in.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (userMustChangePassword(user)) {
    try {
      const admin = createAdminClient();
      const { error: flagError } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { [MUST_CHANGE_PASSWORD_META_KEY]: false },
      });
      if (flagError) throw flagError;
    } catch (error) {
      console.error('[Update Password] Password changed but the flag could not be cleared:', error);
      return {
        success: false,
        error: 'Your new password is saved, but we could not finish setting up your account. Sign in again with it.',
      };
    }
  }

  return { success: true };
}
