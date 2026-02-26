'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail, getSiteUrl } from '@/lib/email/resend';

type UserRole = 'user' | 'admin';

export interface UpdateUserProfileResult {
  success: boolean;
  error?: string;
  /** True only when invite email was actually sent. False when skipped or failed. */
  emailSent?: boolean;
  /** Error message when email failed (not when skipped). */
  emailError?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

export async function updateUserProfile(input: {
  userId: string;
  fullName?: string;
  role?: UserRole;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User updates require Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent locking yourself out of admin
  if (input.userId === currentUser.id && input.role && input.role !== 'admin') {
    return { success: false, error: 'You cannot remove your own admin role.' };
  }

  const updates: Record<string, any> = {};

  if (typeof input.fullName === 'string') {
    const trimmed = input.fullName.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Full name is too long (max 200 characters).' };
    }
    updates.full_name = trimmed.length ? trimmed : null;
  }

  if (input.role) {
    if (input.role !== 'user' && input.role !== 'admin') {
      return { success: false, error: 'Invalid role' };
    }
    updates.role = input.role;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No updates provided' };
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', input.userId);
  if (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: 'Failed to update user' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');

  return { success: true };
}

export async function setUserActive(input: {
  userId: string;
  active: boolean;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User updates require Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent locking yourself out
  if (input.userId === currentUser.id && input.active === false) {
    return { success: false, error: 'You cannot deactivate your own account.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ active: input.active })
    .eq('id', input.userId);

  if (error) {
    console.error('Error updating user active status:', error);
    return { success: false, error: 'Failed to update user status' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function deleteUser(input: {
  userId: string;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User deletion requires Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent deleting yourself
  if (input.userId === currentUser.id) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  // Get user's email before deletion (for resetting access requests)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', input.userId)
    .single();

  const userEmail = profile?.email;

  // Check if user has any orders
  const { data: orders, error: checkError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', input.userId)
    .limit(1);

  if (checkError) {
    console.error('Error checking user orders:', checkError);
    return { success: false, error: 'Failed to check user history' };
  }

  if (orders && orders.length > 0) {
    return {
      success: false,
      error: 'Cannot delete user with order history. Consider deactivating instead.',
    };
  }

  // Delete from auth.users (this will cascade to profiles via trigger)
  const { error: authError } = await supabase.auth.admin.deleteUser(input.userId);

  if (authError) {
    console.error('Error deleting user from auth:', authError);
    return { success: false, error: authError.message || 'Failed to delete user' };
  }

  // Reset any access requests for this email so they can request again
  if (userEmail) {
    const trimmedEmail = userEmail.trim().toLowerCase();
    const { error: requestError } = await supabase
      .from('access_requests')
      .update({
        status: 'rejected',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('email', trimmedEmail)
      .in('status', ['pending', 'approved']); // Only update pending or approved requests

    if (requestError) {
      console.error('Error resetting access requests:', requestError);
      // Don't fail the operation, just log it
    } else {
      console.log(`[Delete User] Reset access requests for ${trimmedEmail}`);
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');

  return { success: true };
}

export async function createUser(input: {
  email: string;
  fullName?: string;
  role?: UserRole;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User creation requires Supabase to be configured.' };
  }

  if (!input?.email) {
    return { success: false, error: 'Email is required' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    return { success: false, error: 'Invalid email address' };
  }

  const { supabase, user: currentAdmin } = await requireAdmin();

  // Create the user first (unconfirmed, they'll confirm via the invite link)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email.trim(),
    email_confirm: false, // Don't confirm - they'll confirm via invite link
    user_metadata: {
      full_name: input.fullName?.trim() || null,
    },
  });

  if (authError) {
    console.error('Error creating user:', authError);
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return { success: false, error: 'A user with this email already exists' };
    }
    return { success: false, error: authError.message || 'Failed to create user' };
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Generate invite link for the newly created user
  const siteUrl = getSiteUrl();
  const redirectTo = `${siteUrl}/update-password`;
  
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: input.email.trim(),
    options: {
      redirectTo,
    },
  });

  if (linkError) {
    console.error('Error generating invite link:', linkError);
    console.error('Link error details:', JSON.stringify(linkError, null, 2));
    // If link generation fails, try to delete the user and return error
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: `Failed to generate invite link: ${linkError.message || 'Please try again.'}` };
  }

  if (!linkData?.properties?.action_link) {
    console.error('Link data missing action_link:', linkData);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: 'Failed to generate invite link. Please try again.' };
  }

  // Send invite email via Resend (using verified domain)
  const inviteLink = linkData.properties.action_link;
  const emailResult = await sendInviteEmail({
    email: input.email.trim(),
    fullName: input.fullName?.trim() || null,
    inviteLink,
  });

  const emailSent = emailResult.success && !emailResult.skipped;
  if (!emailSent) {
    console.error('[Create User] Invite email not sent:', {
      success: emailResult.success,
      skipped: emailResult.skipped,
      error: emailResult.error,
    });
  }

  // Update the profile role if specified (default is 'user' from schema)
  if (input.role && input.role !== 'user') {
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: input.role })
      .eq('id', authData.user.id);

    if (roleError) {
      console.error('Error setting user role:', roleError);
      // Don't fail the whole operation, just log it
    }
  }

  // Mark any pending access request for this email as approved
  const trimmedEmail = input.email.trim().toLowerCase();
  const { error: requestError } = await supabase
    .from('access_requests')
    .update({
      status: 'approved',
      reviewed_by: currentAdmin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('email', trimmedEmail)
    .eq('status', 'pending');

  if (requestError) {
    console.error('Error updating access request status:', requestError);
    // Don't fail the whole operation, just log it
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');

  return {
    success: true,
    emailSent,
    emailError: !emailSent && emailResult.error ? emailResult.error : undefined,
  };
}

async function sendInviteEmail(params: {
  email: string;
  fullName: string | null;
  inviteLink: string;
}) {
  const siteUrl = getSiteUrl();

  const displayName = params.fullName || 'there';
  const subject = 'Welcome to CBM Plastics Rewards - Set Your Password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0;">Welcome to CBM Plastics Rewards!</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">Your account has been created. Please set your password to get started.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <p style="margin: 0 0 15px 0;">Hi ${displayName},</p>
    <p style="margin: 0 0 15px 0;">
      Your account has been created for the CBM Plastics Rewards platform. To get started, please click the button below to set your password.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.inviteLink}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Set Your Password</a>
    </div>
    
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 5px 0 0 0; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${params.inviteLink}
    </p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      <strong>Note:</strong> This link will expire in 24 hours. If you didn't request this account, you can safely ignore this email.
    </p>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">
      CBM Plastics Rewards<br>
      <a href="${siteUrl}" style="color: #2563eb; text-decoration: none;">${siteUrl}</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to CBM Plastics Rewards!

Hi ${displayName},

Your account has been created for the CBM Plastics Rewards platform. To get started, please visit the link below to set your password.

${params.inviteLink}

Note: This link will expire in 24 hours. If you didn't request this account, you can safely ignore this email.

CBM Plastics Rewards
${siteUrl}
  `.trim();

  return await sendEmail({
    to: params.email,
    subject,
    html,
    text,
  });
}
